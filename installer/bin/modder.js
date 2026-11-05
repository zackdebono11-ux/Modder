const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(process.env.LOCALAPPDATA, "Modder");
const backend = path.join(root, "backend");
const server = path.join(backend, "server.js");
const cli = path.join(root, "bin", "modder-cli.js");
const logDir = path.join(root, "logs");
const logFile = path.join(logDir, "server.log");
const api = "http://localhost:3000/api/mods";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function serverReady() {
    try {
        const response = await fetch(api);
        return response.ok;
    } catch {
        return false;
    }
}

async function main() {
    if (!fs.existsSync(server) || !fs.existsSync(cli)) {
        throw new Error("Modder is not fully installed. Run modder-install.");
    }

    if (!await serverReady()) {
        fs.mkdirSync(logDir, { recursive: true });

        const log = fs.openSync(logFile, "a");

        const child = spawn(process.execPath, [server], {
            cwd: backend,
            detached: true,
            stdio: ["ignore", log, log],
            windowsHide: true
        });

        child.unref();
        fs.closeSync(log);

        let ready = false;

        for (let i = 0; i < 40; i++) {
            await delay(500);

            if (await serverReady()) {
                ready = true;
                break;
            }
        }

        if (!ready) {
            const details = fs.existsSync(logFile)
                ? fs.readFileSync(logFile, "utf8").slice(-2500)
                : "No server log available.";

            throw new Error(
                "Could not start the backend. Server log:\n" + details
            );
        }
    }

    require(cli);
}

main().catch(error => {
    console.error("\nModder:", error.message);
    process.exitCode = 1;
});