
const STORAGE_KEY = "modder-v02-custom-mods";

const sampleDetails = [];

function safeHttpsUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
        return false;
    }

    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

function loadCustomMods() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];

        return Array.isArray(parsed)
            ? parsed.filter((mod) =>
                mod &&
                typeof mod.id === "string" &&
                typeof mod.name === "string"
            )
            : [];
    } catch (error) {
        console.error("Could not load saved listings:", error);
        return [];
    }
}

function setText(id, value) {
    document.getElementById(id).textContent = value || "Not specified";
}

function showDetailImage(imageUrl, alt) {
    const image = document.getElementById("detail-image");

    if (!safeHttpsUrl(imageUrl)) {
        image.hidden = true;
        return;
    }

    image.hidden = false;
    image.alt = alt;
    image.src = imageUrl;
    image.referrerPolicy = "no-referrer";

    image.onerror = () => {
        image.hidden = true;
    };
}

function renderScreenshots(screenshots) {
    const grid = document.getElementById("screenshot-grid");
    grid.replaceChildren();

    const safeImages = Array.isArray(screenshots)
        ? screenshots.filter(safeHttpsUrl).slice(0, 6)
        : [];

    if (safeImages.length === 0) {
        const message = document.createElement("p");
        message.className = "no-screenshot";
        message.textContent = "No screenshots have been added yet.";
        grid.appendChild(message);
        return;
    }

    safeImages.forEach((url, index) => {
        const image = document.createElement("img");
        image.src = url;
        image.alt = `Screenshot ${index + 1}`;
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";

        image.addEventListener("error", () => image.remove());
        grid.appendChild(image);
    });
}

function renderDetail(mod) {
    document.title = `${mod.name} — Modder`;

    document.getElementById("detail-content").hidden = false;
    document.getElementById("not-found").hidden = true;

    setText("detail-category", mod.category);
    setText("detail-title", mod.name);
    setText("detail-description", mod.description);
    setText("detail-about", mod.about || mod.description);
    setText("detail-version", mod.version);
    setText("detail-compatibility", mod.compatibility);
    setText("detail-info-category", mod.category);

    showDetailImage(mod.image, `${mod.name} preview`);
    renderScreenshots(mod.screenshots);

    const downloadButton = document.getElementById("download-button");
    const downloadNote = document.getElementById("download-note");
    const status = document.getElementById("detail-status");

    // A demo listing is not a verified real mod.
    const isSample = sampleDetails.some((item) => item.id === mod.id);

    // This checks the listing's declaration and URL format only.
    // It does NOT independently verify the file, publisher or safety.
    const downloadAllowed =
        !isSample &&
        mod.authorised === true &&
        safeHttpsUrl(mod.download);

    status.textContent = isSample
        ? "Sample — not a real mod"
        : "Community listing — not independently verified";

    downloadButton.hidden = !downloadAllowed;

    if (downloadAllowed) {
        downloadButton.href = mod.download;
        downloadNote.textContent =
            "The creator declared permission to share this link. Modder has not independently verified the file or its safety.";
    } else {
        downloadButton.removeAttribute("href");
        downloadNote.textContent =
            "No authorised download link is available for this listing.";
    }
}

function showNotFound() {
    document.title = "Mod not found — Modder";
    document.getElementById("detail-content").hidden = true;
    document.getElementById("not-found").hidden = false;
}

const params = new URLSearchParams(window.location.search);
const requestedId = params.get("id");

async function loadModDetails() {
    try {
        const response = await fetch(
            `http://localhost:3000/api/mods/${encodeURIComponent(requestedId)}`
        );

        if (!response.ok) {
            showNotFound();
            return;
        }

        const mod = await response.json();

        renderDetail(mod);

    } catch (error) {
        console.error("Could not load mod details:", error);
        showNotFound();
    }
}

if (requestedId) {
    loadModDetails();
} else {
    showNotFound();
}