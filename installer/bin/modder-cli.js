#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");

const API_URL = "http://localhost:3000";
const VERSION = "0.3.0";


function showHelp() {
    console.log(`
🌴 MODDER CLI v0.3.0

Manage your Modder community directly from PowerShell.

USAGE:
  modder <command> [options]

COMMANDS:
  upload <file>       Upload a .geode or .zip mod
  list                List all community mods
  search <name>       Search for mods
  info <id>           Display mod information
  --help, -h          Show this help menu
  --version, -v       Show the CLI version
    download <id>       Download an authorised mod

EXAMPLES:
modder download 123
  modder --help
  modder --version
  modder list
  modder search "Neon"
  modder info 1
  modder upload example.geode

API:
  ${API_URL}

🌴 Made for the Geometry Dash community.
`);
}


async function ask(rl, question) {
    const answer = await rl.question(question);
    return answer.trim();
}

async function uploadMod(filePath) {
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
        console.error("❌ File not found:", fullPath);
        process.exitCode = 1;
        return;
    }

    if (!fs.statSync(fullPath).isFile()) {
        console.error("❌ The supplied path is not a file.");
        process.exitCode = 1;
        return;
    }

    const extension = path.extname(fullPath).toLowerCase();

    if (![".geode", ".zip"].includes(extension)) {
        console.error("❌ Only .geode and .zip files are supported.");
        process.exitCode = 1;
        return;
    }

    console.log("\n🌴 MODDER UPLOAD");
    console.log("------------------------------");
    console.log("File:", path.basename(fullPath));

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        const name = await ask(rl, "\nMod name: ");
        const category = await ask(rl, "Category: ");
        const version = await ask(rl, "Version (default 1.0.0): ") || "1.0.0";
        const compatibility = await ask(rl, "GD compatibility (optional): ");
        const author = await ask(rl, "Author (optional): ");
        const description = await ask(rl, "Description: ");

        if (!name || !category || !description) {
            console.error("\n❌ Name, category and description are required.");
            process.exitCode = 1;
            return;
        }

        const confirmed = await ask(rl, "\nUpload this mod? (y/n): ");

        if (!["y", "yes"].includes(confirmed.toLowerCase())) {
            console.log("\nUpload cancelled.");
            return;
        }

        console.log("\nUploading to Modder...");

        const fileBuffer = fs.readFileSync(fullPath);
        const formData = new FormData();

        formData.append(
            "modFile",
            new Blob([fileBuffer]),
            path.basename(fullPath)
        );

        formData.append("name", name);
        formData.append("category", category);
        formData.append("version", version);
        formData.append("compatibility", compatibility);
        formData.append("author", author);
        formData.append("description", description);

        const response = await fetch(`${API_URL}/api/mods`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }

        console.log("\n✅ Mod uploaded successfully!");
        console.log("Name:", result.mod.name);
        console.log("ID:", result.mod.id);
        console.log("Status: Community listing");
        console.log("\n🌴 Thanks for contributing to Modder!");

    } catch (error) {
        console.error("\n❌ Upload failed:", error.message);
        process.exitCode = 1;
    } finally {
        rl.close();
    }
}

async function listMods() {
    try {
        const response = await fetch(`${API_URL}/api/mods`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        console.log("\n🌴 MODDER COMMUNITY MODS");
        console.log("------------------------------");

        if (!data.mods.length) {
            console.log("No mods found.");
            return;
        }

        for (const mod of data.mods) {
            console.log(`
${mod.name}
  ID: ${mod.id}
  Category: ${mod.category}
  Version: ${mod.version || "Unknown"}
  Author: ${mod.author || "Unknown"}
`);
        }

        console.log(`Total: ${data.mods.length} mods`);

    } catch (error) {
        console.error("\n❌ Could not load mods:", error.message);
        process.exitCode = 1;
    }
}

async function searchMods(searchTerm) {
    if (!searchTerm) {
        console.error('❌ Usage: modder search "mod name"');
        process.exitCode = 1;
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/mods`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        const matches = data.mods.filter(mod => {
            const searchable = [
                mod.name,
                mod.category,
                mod.description,
                mod.author
            ].join(" ").toLowerCase();

            return searchable.includes(searchTerm.toLowerCase());
        });

        console.log(`\n🔎 SEARCH RESULTS: "${searchTerm}"`);
        console.log("------------------------------");

        if (!matches.length) {
            console.log("No matching mods found.");
            return;
        }

        for (const mod of matches) {
            console.log(`
${mod.name}
  ID: ${mod.id}
  Category: ${mod.category}
  Author: ${mod.author || "Unknown"}
`);
        }

        console.log(`Found ${matches.length} matching mods.`);

    } catch (error) {
        console.error("\n❌ Search failed:", error.message);
        process.exitCode = 1;
    }
}

async function showModInfo(id) {
    if (!id) {
        console.error("❌ Usage: modder info <id>");
        process.exitCode = 1;
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/api/mods/${encodeURIComponent(id)}`
        );

        if (response.status === 404) {
            console.error("❌ Mod not found.");
            process.exitCode = 1;
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const mod = await response.json();

        console.log(`
🌴 MOD INFORMATION
------------------------------

Name: ${mod.name}
ID: ${mod.id}
Category: ${mod.category}
Version: ${mod.version || "Unknown"}
Compatibility: ${mod.compatibility || "Not verified"}
Author: ${mod.author || "Unknown"}

Description:
${mod.description}

Download: ${mod.download || "Not available"}
Screenshots: ${mod.screenshots?.length || 0}
Authorised: ${mod.authorised ? "Yes" : "No"}
Featured: ${mod.featured ? "Yes" : "No"}

------------------------------
`);
    } catch (error) {
        console.error("\n❌ Could not retrieve mod:", error.message);
        process.exitCode = 1;
    }
}

async function downloadMod(id) {
    if (!id) {
        console.error("❌ Usage: modder download <id>");
        process.exitCode = 1;
        return;
    }

    try {
        console.log("\n🌴 MODDER DOWNLOAD");
        console.log("------------------------------");

        // Retrieve mod information.
        const infoResponse = await fetch(
            `${API_URL}/api/mods/${encodeURIComponent(id)}`
        );

        if (infoResponse.status === 404) {
            throw new Error("Mod not found.");
        }

        if (!infoResponse.ok) {
            throw new Error(`API error: ${infoResponse.status}`);
        }

        const mod = await infoResponse.json();

        console.log("Mod:", mod.name);
        console.log("Author:", mod.author || "Unknown");

        // Only approved listings can be downloaded.
        if (mod.authorised !== true) {
            throw new Error(
                "This listing has not been authorised for download."
            );
        }

        if (!mod.download) {
            throw new Error("This mod has no download file.");
        }

        // Only allow downloads hosted by this Modder API.
        if (
            typeof mod.download !== "string" ||
            !mod.download.startsWith("/uploads/mods/") ||
            mod.download.includes("..") ||
            mod.download.includes("\\")
        ) {
            throw new Error("Invalid mod download path.");
        }

        const downloadUrl = new URL(
    `/api/mods/${encodeURIComponent(id)}/download`,
    API_URL
);

console.log("\nDownloading through the protected API...");

const response = await fetch(downloadUrl);

        if (!response.ok) {
            throw new Error(`Download failed: HTTP ${response.status}`);
        }

        const filename = path.basename(downloadUrl.pathname);

        if (!/\.(geode|zip)$/i.test(filename)) {
            throw new Error("The downloaded file has an unsupported extension.");
        }

        const destination = path.resolve(process.cwd(), filename);

        if (fs.existsSync(destination)) {
            throw new Error(
                `A file named "${filename}" already exists in this folder.`
            );
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        fs.writeFileSync(destination, buffer);

        console.log("\n✅ Download completed!");
        console.log("Saved to:", destination);
        console.log("\n🌴 Enjoy your mod!");
    } catch (error) {
        console.error("\n❌ Download failed:", error.message);
        process.exitCode = 1;
    }
}



async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command || command === "--help" || command === "-h") {
        showHelp();
        return;
    }

    if (command === "--version" || command === "-v") {
        console.log(`Modder CLI v${VERSION}`);
        return;

    }
    if (command === "download") {
    await downloadMod(args[1]);
    return;
}
    if (command === "list") {
    await listMods();
    return;
}

if (command === "search") {
    const searchTerm = args.slice(1).join(" ");
    await searchMods(searchTerm);
    return;
}

if (command === "info") {
    await showModInfo(args[1]);
    return;
}

    if (command === "upload") {
        if (!args[1]) {
            console.error("❌ Please specify a mod file.");
            console.log("Example: modder upload example.geode");
            process.exitCode = 1;
            return;
        }

        await uploadMod(args[1]);
        return;
    }

    // Shorthand: modder example.geode
    // Also accepts: modder upload-example.geode
    const filePath = command.startsWith("upload-")
        ? command.slice("upload-".length)
        : command;

    if (filePath.toLowerCase().endsWith(".geode") ||
        filePath.toLowerCase().endsWith(".zip")) {
        await uploadMod(filePath);
        return;
    }

    console.error(`❌ Unknown command: ${command}`);
    console.log('Run "modder --help" to see available commands.');
    process.exitCode = 1;
}

main();
