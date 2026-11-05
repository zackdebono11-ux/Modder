

const readline = require("readline/promises");
const { stdin, stdout } = require("process");
const path = require("path");
const { spawnSync } = require("child_process");

const VERSION = "0.1.0";

const rl = readline.createInterface({
    input: stdin,
    output: stdout
});

function runInstaller(mode) {
    if (process.platform !== "win32") {
        throw new Error("The Modder installer currently supports Windows only.");
    }

    const scriptPath = path.join(
        __dirname,
        "scripts",
        "install.ps1"
    );

    const result = spawnSync(
        "powershell.exe",
        [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            scriptPath,
            "-Mode",
            mode
        ],
        { stdio: "inherit" }
    );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error("The installation did not complete successfully.");
    }
}

async function main() {
    console.log("");
    console.log("================================");
    console.log("       JUNGLE MODDER");
    console.log("       MODDER INSTALLER");
    console.log("================================");
    console.log("");
    console.log("Welcome to the Modder Installer!");
    console.log("");
    console.log("1. Full Modder application");
    console.log("2. PowerShell support only");
    console.log("3. Exit");
    console.log("");

    const choice = (await rl.question("Choose an option (1-3): ")).trim();

    switch (choice) {
        case "1":
            runInstaller("Full");
            break;

        case "2":
            runInstaller("PowerShell");
            break;

        case "3":
            console.log("Installation cancelled.");
            break;

        default:
            console.log("Invalid option.");
            process.exitCode = 1;
    }
}

main()
    .catch(error => {
        console.error("\nInstaller error:", error.message);
        process.exitCode = 1;
    })
    .finally(() => {
        rl.close();
    });
