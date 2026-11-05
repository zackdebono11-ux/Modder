
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Catalogue storage.
const MODS_FILE = path.join(__dirname, "data", "mods.json");

function loadMods() {
    return JSON.parse(fs.readFileSync(MODS_FILE, "utf8"));
}

function saveMods(mods) {
    fs.writeFileSync(
        MODS_FILE,
        JSON.stringify(mods, null, 2),
        "utf8"
    );
}

// Upload directories.
const MOD_UPLOAD_DIR = path.join(__dirname, "uploads", "mods");
const SCREENSHOT_UPLOAD_DIR = path.join(
    __dirname,
    "uploads",
    "screenshots"
);

fs.mkdirSync(MOD_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOT_UPLOAD_DIR, { recursive: true });

// Generate unique filenames.
const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        if (file.fieldname === "modFile") {
            callback(null, MOD_UPLOAD_DIR);
        } else {
            callback(null, SCREENSHOT_UPLOAD_DIR);
        }
    },

    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, crypto.randomUUID() + extension);
    }
});

// Check accepted file types.
function fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === "modFile") {
        if (extension === ".geode" || extension === ".zip") {
            return callback(null, true);
        }

        return callback(
            new Error("Mod files must be .geode or .zip")
        );
    }

    if (file.fieldname === "screenshots") {
        const allowedImages = [
            ".png",
            ".jpg",
            ".jpeg",
            ".webp"
        ];

        if (allowedImages.includes(extension)) {
            return callback(null, true);
        }

        return callback(
            new Error("Screenshots must be PNG, JPG or WEBP images")
        );
    }

    callback(new Error("Unexpected upload field"));
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 6
    }
});

// Only screenshots are publicly accessible.
// Mod files must go through the protected download endpoint.
app.use(
    "/uploads/screenshots",
    express.static(SCREENSHOT_UPLOAD_DIR, {
        dotfiles: "deny",
        index: false,
        fallthrough: false
    })
);
// Backend homepage.
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Modder API</title>

            <style>
                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    min-height: 100vh;
                    display: grid;
                    place-items: center;
                    padding: 24px;
                    background: #07110b;
                    color: #f0fff4;
                    font-family: Arial, sans-serif;
                }

                .container {
                    width: 100%;
                    max-width: 650px;
                    padding: 45px;
                    background: #101e15;
                    border: 1px solid #294b35;
                    border-radius: 22px;
                    text-align: center;
                    box-shadow: 0 20px 70px #0008;
                }

                .logo {
                    font-size: 55px;
                    margin-bottom: 12px;
                }

                h1 {
                    font-size: 38px;
                    margin: 0;
                }

                h1 span {
                    color: #63f5a5;
                }

                .subtitle {
                    color: #a5b9aa;
                    margin: 14px 0 28px;
                    line-height: 1.6;
                }

                .status {
                    display: inline-block;
                    padding: 9px 16px;
                    background: #153b27;
                    color: #63f5a5;
                    border-radius: 30px;
                    font-size: 14px;
                    margin-bottom: 28px;
                }

                .links {
                    display: grid;
                    gap: 12px;
                }

                a {
                    display: block;
                    padding: 15px;
                    color: #63f5a5;
                    background: #17291d;
                    border: 1px solid #31583d;
                    border-radius: 12px;
                    text-decoration: none;
                    transition: 0.2s;
                }

                a:hover {
                    background: #20432c;
                    transform: translateY(-2px);
                }

                footer {
                    margin-top: 30px;
                    color: #718779;
                    font-size: 13px;
                }
            </style>
        </head>

        <body>
            <main class="container">
                <div class="logo">🌴</div>

                <h1><span>Modder</span> API</h1>

                <p class="subtitle">
                    The backend powering the Modder community.
                    Manage mod listings and serve uploaded files.
                </p>

                <div class="status">
                    ● All systems operational
                </div>

                <div class="links">
                    <a href="/api/health">View API Health</a>
                    <a href="/api/mods">Explore Mod Catalogue</a>
                </div>

                <footer>
                    Modder API v0.5.0 · Built for the Geometry Dash community
                </footer>
            </main>
        </body>
        </html>
    `);
});
// API health check.
app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        name: "Modder API",
        version: "0.5.0"
    });
});

// Get all mod listings.
app.get("/api/mods", (req, res) => {
    const mods = loadMods();

    res.json({
        count: mods.length,
        mods
    });
});

// Get one mod by ID.
app.get("/api/mods/:id", (req, res) => {
    const mods = loadMods();
    const mod = mods.find(item => item.id === req.params.id);

    if (!mod) {
        return res.status(404).json({
            error: "Mod not found"
        });
    }

    res.json(mod);
});

// Download an authorised mod.
app.get("/api/mods/:id/download", (req, res) => {
    try {
        const mods = loadMods();
        const mod = mods.find(item => item.id === req.params.id);

        if (!mod) {
            return res.status(404).json({
                error: "Mod not found"
            });
        }

        // Authorisation is enforced by the backend.
        if (mod.authorised !== true) {
            return res.status(403).json({
                error: "This mod has not been authorised for download."
            });
        }

        if (
            typeof mod.download !== "string" ||
            !mod.download.startsWith("/uploads/mods/")
        ) {
            return res.status(404).json({
                error: "Mod file not found."
            });
        }

        // Extract only the filename, never trust a supplied filesystem path.
        const filename = path.posix.basename(mod.download);

        if (
            filename === "." ||
            filename === ".." ||
            !/^[a-f0-9-]+\.(geode|zip)$/i.test(filename)
        ) {
            return res.status(400).json({
                error: "Invalid mod file reference."
            });
        }

        const filePath = path.join(MOD_UPLOAD_DIR, filename);

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            return res.status(404).json({
                error: "Mod file is missing from storage."
            });
        }

        res.setHeader("Cache-Control", "private, no-store");

        res.download(filePath, filename, error => {
            if (error && !res.headersSent) {
                console.error("Mod download error:", error);

                res.status(500).json({
                    error: "Could not download mod."
                });
            }
        });

    } catch (error) {
        console.error("Protected download error:", error);

        if (!res.headersSent) {
            res.status(500).json({
                error: "Could not process download."
            });
        }
    }
});


// Submit a new mod with its files.
app.post("/api/mods", (req, res, next) => {
    upload.fields([
        { name: "modFile", maxCount: 1 },
        { name: "screenshots", maxCount: 5 }
    ])(req, res, async (error) => {
        if (error) {
            return res.status(400).json({
                error: error.message
            });
        }

        const uploadedFiles = [
            ...(req.files?.modFile || []),
            ...(req.files?.screenshots || [])
        ];

        function removeUploadedFiles() {
            for (const file of uploadedFiles) {
                fs.unlink(file.path, () => {});
            }
        }

        const {
            name,
            category,
            description,
            version,
            compatibility,
            author
        } = req.body;

        if (!name || !category || !description) {
            removeUploadedFiles();

            return res.status(400).json({
                error: "Name, category and description are required"
            });
        }

        const modFile = req.files?.modFile?.[0];

        if (!modFile) {
            removeUploadedFiles();

            return res.status(400).json({
                error: "Please upload a .geode or .zip mod file"
            });
        }

        const screenshots = req.files?.screenshots || [];

        // Apply a smaller limit to screenshots.
        if (screenshots.some(file => file.size > 5 * 1024 * 1024)) {
            removeUploadedFiles();

            return res.status(400).json({
                error: "Each screenshot must be 5 MB or smaller"
            });
        }

        try {
            const mods = loadMods();

            const newMod = {
                id: crypto.randomUUID(),
                name: name.trim(),
                category: category.trim(),
                description: description.trim(),
                version: version?.trim() || "1.0.0",
                compatibility: compatibility?.trim() || "Not verified",
                author: author?.trim() || "Community",
                download: `/uploads/mods/${modFile.filename}`,
                screenshots: screenshots.map(
                    file => `/uploads/screenshots/${file.filename}`
                ),
                featured: false,
                authorised: false
            };

            mods.push(newMod);
            saveMods(mods);

            res.status(201).json({
                message: "Mod submitted successfully",
                mod: newMod
            });
        } catch (saveError) {
            removeUploadedFiles();
            next(saveError);
        }
    });
});

// Handle upload and server errors.
app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).json({
        error: "Something went wrong on the server"
    });
});
// Check Modder Guard connection.
app.get("/api/guard/status", async (req, res) => {
    try {
        const response = await fetch(
            "http://127.0.0.1:4000/health"
        );

        if (!response.ok) {
            return res.status(502).json({
                backend: "online",
                guard: "unavailable"
            });
        }

        const guard = await response.json();

        res.json({
            backend: "online",
            guard: guard
        });

    } catch (error) {
        res.status(503).json({
            backend: "online",
            guard: "offline",
            message: "Could not connect to Modder Guard."
        });
    }
});

// Start the server.
app.listen(PORT, () => {
    console.log("🌴 Modder API is running!");
    console.log(`Local address: http://localhost:${PORT}`);
});
