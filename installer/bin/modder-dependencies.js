const path = require("path");

function checkFFlate(installRoot) {
    const root = path.resolve(installRoot);
    const searchPath = path.join(root, "bin");

    try {
        const resolved = require.resolve("fflate", {
            paths: [searchPath]
        });

        return {
            installed: true,
            resolved,
            version: getVersion(resolved)
        };
    } catch (error) {
        if (error.code === "MODULE_NOT_FOUND") {
            return {
                installed: false,
                resolved: null,
                version: null
            };
        }

        throw error;
    }
}

function getVersion(resolved) {
    const fs = require("fs");
    let directory = path.dirname(resolved);

    while (true) {
        const packagePath = path.join(directory, "package.json");

        if (fs.existsSync(packagePath)) {
            const metadata = JSON.parse(
                fs.readFileSync(packagePath, "utf8")
            );

            if (metadata.name === "fflate") {
                return metadata.version;
            }
        }

        const parent = path.dirname(directory);

        if (parent === directory) {
            return "Unknown";
        }

        directory = parent;
    }
}

module.exports = { checkFFlate };
