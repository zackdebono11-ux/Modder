
const API_URL = "http://localhost:3000";

let mods = [];

const modGrid = document.getElementById("mod-grid");
const searchInput = document.getElementById("search-input");
const searchForm = document.getElementById("search-form");
const sortSelect = document.getElementById("sort-select");
const categoryButtons = document.querySelectorAll(".category-button");
const resultsCount = document.getElementById("results-count");
const modCount = document.getElementById("mod-count");
const emptyState = document.getElementById("empty-state");
const resetButton = document.getElementById("reset-button");
const addForm = document.getElementById("add-form");
const formMessage = document.getElementById("form-message");

let selectedCategory = "All";

// Load custom listings saved in this browser.
function getAllMods() {
    return mods;
}


async function loadServerMods() {
    try {
        const response = await fetch(
            `${API_URL}/api/mods`
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data.mods)) {
            throw new Error("Invalid mod catalogue response.");
        }

        mods = data.mods;

        console.log("🌴 Modder: API catalogue loaded!");
        renderMods();

    } catch (error) {
        console.error("Could not load Modder catalogue:", error);

        resultsCount.textContent =
            "Could not connect to the Modder API.";

        modGrid.replaceChildren();
        modGrid.hidden = true;
        emptyState.hidden = false;
    }
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
}

// Accept secure HTTPS links only.
function isSafeHttpsUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
        return false;
    }

    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

function createModCard(mod) {
    const card = makeElement("article", "mod-card");

    const artwork = makeElement("div", "mod-art");
    artwork.style.setProperty("--art-bg", mod.background || "#17291d");
    artwork.style.setProperty("--art-color", mod.color || "#63f5a5");

    const preview = mod.image ||
    (Array.isArray(mod.screenshots) ? mod.screenshots[0] : "");

if (preview) {
    const image = makeElement("img", "card-image");

    image.src = preview.startsWith("/")
        ? API_URL + preview
        : preview;

    image.alt = `${mod.name} preview`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";

    image.addEventListener("error", () => image.remove());
    artwork.appendChild(image);
}

    const badge = makeElement(
        "span",
        "mod-badge",
        mod.badge || "COMMUNITY"
    );

    const symbol = makeElement(
        "span",
        "mod-art-symbol",
        mod.symbol || "✦"
    );

    symbol.setAttribute("aria-hidden", "true");
    artwork.append(badge, symbol);

    const body = makeElement("div", "mod-card-body");
    const category = makeElement(
        "span", "mod-category", mod.category
    );
    const title = makeElement("h3", "", mod.name);
    const description = makeElement("p", "", mod.description);

    const footer = makeElement("div", "mod-card-footer");
    const tag = makeElement(
        "span",
        "demo-tag",
        mod.download && mod.authorised
            ? "Owner-declared link"
            : "Listing only"
    );

    const detailsLink = makeElement(
        "a",
        "details-button",
        "View details ↗"
    );

    detailsLink.href = `mod.html?id=${encodeURIComponent(mod.id)}`;

    footer.append(tag, detailsLink);
    body.append(category, title, description, footer);
    card.append(artwork, body);

    return card;
}

function renderMods() {
    const allMods = getAllMods();
    const searchTerm = searchInput.value.trim().toLowerCase();

    let filteredMods = allMods.filter((mod) => {
        const matchesCategory =
            selectedCategory === "All" ||
            mod.category === selectedCategory;

        const searchableText = [
            mod.name,
            mod.category,
            mod.description,
            mod.badge
        ].join(" ").toLowerCase();

        return matchesCategory &&
            searchableText.includes(searchTerm);
    });

    if (sortSelect.value === "name") {
        filteredMods.sort((a, b) =>
            a.name.localeCompare(b.name)
        );
    } else if (sortSelect.value === "category") {
        filteredMods.sort((a, b) =>
            a.category.localeCompare(b.category) ||
            a.name.localeCompare(b.name)
        );
    } else {
        filteredMods.sort((a, b) =>
            Number(b.featured === true) -
            Number(a.featured === true) ||
            Number(a.id) - Number(b.id)
        );
    }

    modGrid.replaceChildren();

    filteredMods.forEach((mod) => {
        modGrid.appendChild(createModCard(mod));
    });

    resultsCount.textContent =
        `Showing ${filteredMods.length} of ${allMods.length} mod listings`;

    modCount.textContent = String(allMods.length);
    emptyState.hidden = filteredMods.length !== 0;
    modGrid.hidden = filteredMods.length === 0;
}

searchInput.addEventListener("input", renderMods);

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadServerMods();
});

sortSelect.addEventListener("change", renderMods);

categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedCategory = button.dataset.category;

        categoryButtons.forEach((otherButton) => {
            const active =
                otherButton.dataset.category === selectedCategory;

            otherButton.classList.toggle("active", active);
            otherButton.setAttribute("aria-pressed", String(active));
        });

        renderMods();
    });
});

resetButton.addEventListener("click", () => {
    searchInput.value = "";
    selectedCategory = "All";
    sortSelect.value = "featured";

    categoryButtons.forEach((button) => {
        const active = button.dataset.category === "All";

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    renderMods();
    searchInput.focus();
});


// Upload a new mod to the backend.
addForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    formMessage.textContent = "";

    const formData = new FormData(addForm);
    const modFile = formData.get("modFile");
    const screenshots = formData.getAll("screenshots")
        .filter(file => file.size > 0);

    if (!modFile || modFile.size === 0) {
        formMessage.textContent = "Please select a mod file.";
        return;
    }

    if (modFile.size > 50 * 1024 * 1024) {
        formMessage.textContent = "The mod file must be 50 MB or smaller.";
        return;
    }

    if (screenshots.length > 5) {
        formMessage.textContent = "You can upload up to 5 screenshots.";
        return;
    }

    if (screenshots.some(file => file.size > 5 * 1024 * 1024)) {
        formMessage.textContent =
            "Each screenshot must be 5 MB or smaller.";
        return;
    }

    const submitButton = addForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Uploading...";

    try {
        const response = await fetch(`${API_URL}/api/mods`, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Upload failed.");
        }

        // Add the newly submitted mod to the current catalogue.
        mods.push(result.mod);

        addForm.reset();

        selectedCategory = "All";
        searchInput.value = "";
        sortSelect.value = "featured";

        categoryButtons.forEach((button) => {
            const active = button.dataset.category === "All";

            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });

        renderMods();

        formMessage.textContent =
            "Your mod was uploaded successfully! It is now a community listing.";

        document.getElementById("explore").scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {
        console.error("Mod upload failed:", error);

        formMessage.textContent =
            error.message || "Could not upload your mod. Please try again.";
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Upload mod +";
    }
});



loadServerMods();

console.log("🌿 Modder v0.2 is ready!");
