const fs = require("fs");
const path = require("path");
const os = require("os");

const {
    zipSync,
    strToU8,
    strFromU8,
    Unzip,
    UnzipInflate,
    UnzipPassThrough
} = require("../backend/node_modules/fflate");

const MAX_ARCHIVE_SIZE = 250 * 1024 * 1024;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;
const MAX_FILE_SIZE = 250 * 1024 * 1024;
const MAX_FILES = 1000;

function safeName(value) {
    return typeof value === "string" &&
        /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}

function safeArchivePath(name) {
    if (typeof name !== "string" || !name || name.includes("\0")) {
        return false;
    }

    // ZIP paths should use forward slashes.
    if (name.includes("\\")) {
        return false;
    }

    if (
        name.startsWith("/") ||
        name.startsWith("//") ||
        /^[a-zA-Z]:/.test(name)
    ) {
        return false;
    }

    const isDirectory = name.endsWith("/");
    const checkedName = isDirectory ? name.slice(0, -1) : name;

    if (!checkedName) return false;

    const parts = checkedName.split("/");

    for (const part of parts) {
        if (
            !part ||
            part === "." ||
            part === ".." ||
            /[<>:"|?*\x00-\x1F]/.test(part) ||
            /[. ]$/.test(part) ||
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(part)
        ) {
            return false;
        }
    }

    return true;
}

function isInside(parent, target) {
    const relative = path.relative(parent, target);

    return relative !== "" &&
        relative !== ".." &&
        !relative.startsWith(".." + path.sep) &&
        !path.isAbsolute(relative);
}


const CRC32_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
    let value = i;

    for (let bit = 0; bit < 8; bit++) {
        value = (value & 1)
            ? 0xEDB88320 ^ (value >>> 1)
            : value >>> 1;
    }

    CRC32_TABLE[i] = value >>> 0;
}

function crc32(data) {
    let checksum = 0xFFFFFFFF;

    for (let i = 0; i < data.length; i++) {
        checksum =
            CRC32_TABLE[(checksum ^ data[i]) & 0xFF] ^
            (checksum >>> 8);
    }

    return (checksum ^ 0xFFFFFFFF) >>> 0;
}

// Validate the ZIP directory and local headers before extracting anything.
function validateZipStructure(buffer) {
    const expectedCrcs = new Map();
    const minimumEOCD = 22;
    const maximumComment = 65535;

    if (buffer.length < minimumEOCD) {
        throw new Error("Invalid or damaged .modder archive.");
    }

    let eocd = -1;
    const searchStart = Math.max(
        0,
        buffer.length - minimumEOCD - maximumComment
    );

    for (let i = buffer.length - minimumEOCD; i >= searchStart; i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) {
            const commentLength = buffer.readUInt16LE(i + 20);

            if (i + minimumEOCD + commentLength === buffer.length) {
                eocd = i;
                break;
            }
        }
    }

    if (eocd === -1) {
        throw new Error("Invalid or damaged .modder archive.");
    }

    const diskNumber = buffer.readUInt16LE(eocd + 4);
    const centralDisk = buffer.readUInt16LE(eocd + 6);
    const diskEntries = buffer.readUInt16LE(eocd + 8);
    const totalEntries = buffer.readUInt16LE(eocd + 10);
    const centralSize = buffer.readUInt32LE(eocd + 12);
    const centralOffset = buffer.readUInt32LE(eocd + 16);

    // Modder currently supports standard single-disk ZIP archives only.
    if (
        diskNumber !== 0 ||
        centralDisk !== 0 ||
        diskEntries !== totalEntries ||
        totalEntries === 0xffff ||
        centralSize === 0xffffffff ||
        centralOffset === 0xffffffff
    ) {
        throw new Error("Unsupported or invalid ZIP structure.");
    }

    if (
        centralOffset + centralSize !== eocd ||
        centralOffset > buffer.length
    ) {
        throw new Error("Invalid or damaged .modder archive.");
    }

    let cursor = centralOffset;

    for (let i = 0; i < totalEntries; i++) {
        if (
            cursor + 46 > eocd ||
            buffer.readUInt32LE(cursor) !== 0x02014b50
        ) {
            throw new Error("Invalid ZIP central directory.");
        }

        const flags = buffer.readUInt16LE(cursor + 8);
        const expectedCrc = buffer.readUInt32LE(cursor + 16);
        const method = buffer.readUInt16LE(cursor + 10);
        const compressedSize = buffer.readUInt32LE(cursor + 20);
        const uncompressedSize = buffer.readUInt32LE(cursor + 24);
        const nameLength = buffer.readUInt16LE(cursor + 28);
        const extraLength = buffer.readUInt16LE(cursor + 30);
        const commentLength = buffer.readUInt16LE(cursor + 32);
        const startDisk = buffer.readUInt16LE(cursor + 34);
        const localOffset = buffer.readUInt32LE(cursor + 42);

        const entryEnd =
            cursor + 46 + nameLength + extraLength + commentLength;

        if (
            entryEnd > eocd ||
            startDisk !== 0 ||
            compressedSize === 0xffffffff ||
            uncompressedSize === 0xffffffff ||
            localOffset === 0xffffffff ||
            (flags & 1) !== 0 ||
            (method !== 0 && method !== 8)
        ) {
            throw new Error("Unsupported or invalid ZIP entry.");
        }

        if (
            localOffset + 30 > centralOffset ||
            buffer.readUInt32LE(localOffset) !== 0x04034b50
        ) {
            throw new Error("Invalid ZIP local file header.");
        }

        const localFlags = buffer.readUInt16LE(localOffset + 6);
        const localMethod = buffer.readUInt16LE(localOffset + 8);
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);

        const localNameStart = localOffset + 30;
        const localDataStart =
            localNameStart + localNameLength + localExtraLength;

        const centralNameStart = cursor + 46;
        const entryName = strFromU8(
            buffer.subarray(
                centralNameStart,
                centralNameStart + nameLength
            ),
            (flags & 0x0800) === 0
        );

        expectedCrcs.set(entryName, expectedCrc);

        if (
            localFlags !== flags ||
            localMethod !== method ||
            localNameLength !== nameLength ||
            localDataStart + compressedSize > centralOffset ||
            !buffer.subarray(
                localNameStart,
                localNameStart + localNameLength
            ).equals(
                buffer.subarray(
                    centralNameStart,
                    centralNameStart + nameLength
                )
            )
        ) {
            throw new Error("Invalid ZIP local file entry.");
        }

        cursor = entryEnd;
    }

    if (cursor !== centralOffset + centralSize) {
        throw new Error("Invalid ZIP central directory size.");
    }

    return expectedCrcs;
}

function readArchive(filePath) {
    if (
        !fs.existsSync(filePath) ||
        !fs.statSync(filePath).isFile()
    ) {
        throw new Error("The .modder file does not exist.");
    }

    if (path.extname(filePath).toLowerCase() !== ".modder") {
        throw new Error("Expected a .modder file.");
    }

    const archiveSize = fs.statSync(filePath).size;

    if (archiveSize > MAX_ARCHIVE_SIZE) {
        throw new Error("Archive exceeds the 250 MB limit.");
    }

    let archiveData;

    try {
        archiveData = fs.readFileSync(filePath);
    } catch {
        throw new Error("Could not read the .modder archive.");
    }

    const expectedCrcs = validateZipStructure(archiveData);

    const files = {};
    const seenNames = new Set();

    let fileCount = 0;
    let totalSize = 0;
    let failure = null;

    try {
        const unzipper = new Unzip();

        unzipper.register(UnzipPassThrough);
        unzipper.register(UnzipInflate);

        unzipper.onfile = (entry) => {
            if (failure) {
                entry.terminate();
                return;
            }

            fileCount++;

            if (fileCount > MAX_FILES) {
                failure = new Error("Archive contains too many files.");
                entry.terminate();
                return;
            }

            const name = entry.name;

            if (!safeArchivePath(name)) {
                failure = new Error("Unsafe archive path: " + name);
                entry.terminate();
                return;
            }

           // Directory entries are allowed only when they contain no data.
if (name.endsWith("/")) {
    entry.ondata = (error, data) => {
        if (error) {
            failure = new Error("Invalid or damaged .modder archive.");
            return;
        }

        if (data.length > 0) {
            failure = new Error("Directory entries must not contain file data.");
            entry.terminate();
        }
    };

    entry.start();
    return;
}

            // Windows paths are case-insensitive.
            const key = name.toLowerCase();

            if (seenNames.has(key)) {
                failure = new Error("Archive contains duplicate paths: " + name);
                entry.terminate();
                return;
            }

            seenNames.add(key);

            const chunks = [];
            let fileSize = 0;

            entry.ondata = (error, data, final) => {
                if (error) {
                    failure = new Error("Invalid or damaged .modder archive.");
                    return;
                }

                if (failure) return;

                fileSize += data.length;
                totalSize += data.length;

                // Count actual decompressed bytes, not ZIP metadata.
                if (fileSize > MAX_FILE_SIZE) {
                    failure = new Error("An archive file exceeds the 250 MB limit.");
                    entry.terminate();
                    return;
                }

                if (totalSize > MAX_TOTAL_SIZE) {
                    failure = new Error("Archive expands beyond the 500 MB limit.");
                    entry.terminate();
                    return;
                }

                if (data.length > 0) {
                    chunks.push(Buffer.from(data));
                }

                if (final) {
                    const extracted = Buffer.concat(chunks, fileSize);
                    const expectedCrc = expectedCrcs.get(name);

                    if (
                        expectedCrc === undefined ||
                        crc32(extracted) !== expectedCrc
                    ) {
                        failure = new Error(
                            "Invalid or damaged .modder archive."
                        );
                        return;
                    }

                    files[name] = extracted;
                }
            };

            entry.start();
        };

        unzipper.push(archiveData, true);

        if (failure) {
            throw failure;
        }
    } catch (error) {
        if (error && error.message && (
            error.message.startsWith("Archive") ||
            error.message.startsWith("An archive") ||
            error.message.startsWith("Unsafe archive") ||
            error.message.startsWith("Invalid or damaged")
        )) {
            throw error;
        }

        throw new Error("Invalid or damaged .modder archive.");
    }

    if (!files["manifest.json"]) {
        throw new Error("Archive is missing manifest.json.");
    }

    let manifest;

    try {
        manifest = JSON.parse(strFromU8(files["manifest.json"]));
    } catch {
        throw new Error("manifest.json is invalid.");
    }

    if (
        !manifest ||
        manifest.format !== "modder" ||
        manifest.formatVersion !== 1 ||
        !safeName(manifest.id) ||
        typeof manifest.name !== "string" ||
        !["project", "package"].includes(manifest.type)
    ) {
        throw new Error("Unsupported or invalid Modder manifest.");
    }

    return { files, manifest };
}

function createProject(name, destination = process.cwd()) {
    if (!safeName(name)) {
        throw new Error("Use a name containing letters, numbers, _ or -.");
    }

    const root = path.resolve(destination, name);

    if (fs.existsSync(root)) {
        throw new Error("That project folder already exists.");
    }

    const manifest = {
        format: "modder",
        formatVersion: 1,
        type: "project",
        id: name,
        name,
        version: "1.0.0",
        description: "A Geometry Dash mod project",
        author: "",
        gameVersion: "2.2091"
    };

    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.join(root, "assets"), { recursive: true });
    fs.mkdirSync(path.join(root, "build"), { recursive: true });

    fs.writeFileSync(
        path.join(root, "manifest.json"),
        JSON.stringify(manifest, null, 2)
    );

    fs.writeFileSync(
        path.join(root, "src", "main.cpp"),
        "// Your Geode mod source code goes here.\n"
    );

    fs.writeFileSync(
        path.join(root, "CMakeLists.txt"),
        "# Add your Geode build configuration here.\n"
    );

    fs.writeFileSync(
        path.join(root, "README.md"),
        "# " + name + "\n\nA Modder project.\n"
    );

    console.log("Created Modder project:", root);
}

function validateArchive(file) {
    const { files, manifest } = readArchive(file);

    if (manifest.type === "package" && !files["mod.geode"]) {
        throw new Error("Installable package is missing mod.geode.");
    }

    if (manifest.type === "project" && !files["src/main.cpp"]) {
        throw new Error("Project archive is missing src/main.cpp.");
    }

    console.log("Valid .modder archive!");
    console.log("Name:", manifest.name);
    console.log("Type:", manifest.type);
    console.log("Version:", manifest.version);
    console.log("Files:", Object.keys(files).length);
}

function openProject(file, destination = process.cwd()) {
    const { files, manifest } = readArchive(file);

    if (manifest.type !== "project") {
        throw new Error("Only project archives can be opened.");
    }

    if (!files["src/main.cpp"]) {
        throw new Error("Project is missing src/main.cpp.");
    }

    const root = path.resolve(destination, manifest.id);

    if (fs.existsSync(root)) {
        throw new Error("Destination already exists: " + root);
    }

    fs.mkdirSync(root, { recursive: true });

    try {
        for (const [name, data] of Object.entries(files)) {
            const target = path.resolve(root, ...name.split("/"));

            if (!isInside(root, target)) {
                throw new Error("Unsafe extraction path: " + name);
            }

            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, data);
        }
    } catch (error) {
        fs.rmSync(root, { recursive: true, force: true });
        throw error;
    }

    console.log("Project extracted to:", root);
}

function packProject(projectDirectory, outputFile) {
    const root = path.resolve(projectDirectory);

    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        throw new Error("Project folder not found.");
    }

    const manifestPath = path.join(root, "manifest.json");

    if (!fs.existsSync(manifestPath)) {
        throw new Error("Project manifest.json not found.");
    }

    let manifest;

    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
        throw new Error("Project manifest.json is invalid.");
    }

    if (
        manifest.format !== "modder" ||
        manifest.formatVersion !== 1 ||
        manifest.type !== "project" ||
        !safeName(manifest.id)
    ) {
        throw new Error("Invalid Modder project manifest.");
    }



    const files = {};
    let fileCount = 0;
    let totalSize = 0;

    function collect(folder, relativeFolder = "") {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            if ([".git", "node_modules", "build", "dist", "out"].includes(entry.name)) {
                continue;
            }

            const fullPath = path.join(folder, entry.name);
            const relativePath = path.posix.join(relativeFolder, entry.name);

            if (entry.isSymbolicLink()) {
                throw new Error("Symbolic links are not allowed: " + relativePath);
            }

            if (!safeArchivePath(relativePath)) {
                throw new Error("Unsafe project file path: " + relativePath);
            }

            if (entry.isDirectory()) {
                collect(fullPath, relativePath);
            } else if (entry.isFile()) {
                fileCount++;

                if (fileCount > MAX_FILES) {
                    throw new Error("Project contains too many files.");
                }

                const data = fs.readFileSync(fullPath);

                totalSize += data.length;

                if (data.length > MAX_FILE_SIZE || totalSize > MAX_TOTAL_SIZE) {
                    throw new Error("Project exceeds the archive size limits.");
                }

                files[relativePath] = new Uint8Array(data);
            }
        }
    }

    collect(root);

    if (!files["src/main.cpp"]) {
        throw new Error("Project is missing src/main.cpp.");
    }

    files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

    const destination = path.resolve(
        outputFile || (manifest.id + ".modder")
    );

    if (destination === root || isInside(root, destination)) {
        throw new Error("Output archive cannot be inside the project folder.");
    }

    const archive = zipSync(files);

    if (archive.length > MAX_ARCHIVE_SIZE) {
        throw new Error("Created archive exceeds the 250 MB limit.");
    }

    fs.writeFileSync(destination, archive);

    console.log("Created project archive: " + destination);
}

function buildPackage(projectDirectory, outputFile) {
    const root = path.resolve(projectDirectory);
    const manifestPath = path.join(root, "manifest.json");
    const artifact = path.join(root, "build", "mod.geode");

    if (!fs.existsSync(manifestPath)) {
        throw new Error("Project manifest.json not found.");
    }

    let manifest;

    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
        throw new Error("Project manifest.json is invalid.");
    }

    if (
        manifest.format !== "modder" ||
        manifest.formatVersion !== 1 ||
        manifest.type !== "project" ||
        !safeName(manifest.id)
    ) {
        throw new Error("Invalid Modder project manifest.");
    }

    if (!fs.existsSync(artifact) || !fs.statSync(artifact).isFile()) {
        throw new Error(
            "Build output not found. Place your compiled Geode mod at build\\mod.geode first."
        );
    }

    const artifactData = fs.readFileSync(artifact);

    if (artifactData.length > MAX_FILE_SIZE) {
        throw new Error("mod.geode exceeds the 250 MB file limit.");
    }

    const packageManifest = {
        ...manifest,
        type: "package"
    };

    const archive = {
        "manifest.json": strToU8(JSON.stringify(packageManifest, null, 2)),
        "mod.geode": artifactData
    };

    const readme = path.join(root, "README.md");

    if (fs.existsSync(readme) && fs.statSync(readme).isFile()) {
        const readmeData = fs.readFileSync(readme);

        if (readmeData.length + artifactData.length > MAX_TOTAL_SIZE) {
            throw new Error("Package exceeds the 500 MB expanded size limit.");
        }

        archive["README.md"] = readmeData;
    }

    const output = path.resolve(outputFile || (manifest.id + ".modder"));
    const packed = zipSync(archive, { level: 6 });

    if (packed.length > MAX_ARCHIVE_SIZE) {
        throw new Error("Created package exceeds the 250 MB archive limit.");
    }

    fs.writeFileSync(output, packed);

    console.log("Created installable package:", output);
}

function installPackage(file) {
    const { files, manifest } = readArchive(file);

    if (manifest.type !== "package" || !files["mod.geode"]) {
        throw new Error("This is not a valid installable package.");
    }

    const packagesDirectory = path.join(
        process.env.LOCALAPPDATA || os.homedir(),
        "Modder",
        "packages"
    );

    const root = path.join(packagesDirectory, manifest.id);

    fs.mkdirSync(packagesDirectory, { recursive: true });

    if (fs.existsSync(root)) {
        throw new Error(
            "This package is already in your Modder library. Remove it before installing a replacement."
        );
    }

    // Deliberately do not use recursive here: this prevents overwriting
    // an existing package directory.
    fs.mkdirSync(root);

    try {
        fs.writeFileSync(path.join(root, "mod.geode"), files["mod.geode"]);

        fs.writeFileSync(
            path.join(root, "manifest.json"),
            JSON.stringify(manifest, null, 2)
        );
    } catch (error) {
        fs.rmSync(root, { recursive: true, force: true });
        throw error;
    }

    console.log("Package added to Modder's local library:", root);
    console.log("No files were executed.");
}

module.exports = {
    createProject,
    validateArchive,
    openProject,
    buildPackage,
    packProject,
    installPackage
};
