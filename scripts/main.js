// State Variables
let allItems = []; // Raw list from API/manifests
let displayedItems = []; // Currently rendered items after sorting/filtering
let selectedItems = new Set(); // Tracks selected filenames
let loadedImages = new Map(); // Tracks source version for each image filename
let itemNameCache = new Map(); // Cache for formatted item names
let availableVersions = []; // List of available version folders
let currentVersion = 'latest'; // Currently selected version filter
let currentSort = 'az'; // Current sort order ('az' or 'za')
let currentModalFilename = null; // Track filename shown in modal
let supportersListDiv; // Add this variable

// Declare DOM element variables here, but assign them inside DOMContentLoaded
let gallery, searchInput, downloadAllButton, clearSelectionButton, selectVisibleButton;
let totalCountDisplay, filteredCountDisplay, versionSelect, sortSelect, themeToggleButton;
let backToTopButton, progressContainer, progressBar, progressText, modal, modalCloseButton;
let modalImg, modalItemName, modalFilename, modalVersion, modalDownloadButton;
let modalSelectButton, toggleInfoButton, infoSection;

// Constants
const RENDER_BATCH_SIZE = 100;
const BASE_PATH = window.location.pathname.includes('/MinecraftAllImages/')
    ? '/MinecraftAllImages'
    : ''; // Adjust if deployed elsewhere

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements now that the DOM is ready
    gallery = document.getElementById('gallery');
    searchInput = document.getElementById('search-input');
    downloadAllButton = document.getElementById('download-all');
    clearSelectionButton = document.getElementById('clear-selection');
    selectVisibleButton = document.getElementById('select-visible');
    totalCountDisplay = document.getElementById('total-count');
    filteredCountDisplay = document.getElementById('filtered-count');
    versionSelect = document.getElementById('version-select');
    sortSelect = document.getElementById('sort-select');
    themeToggleButton = document.getElementById('theme-toggle');
    backToTopButton = document.getElementById('back-to-top');
    progressContainer = document.getElementById('loading-progress');
    progressBar = document.getElementById('progress-bar');
    progressText = document.getElementById('progress-text');
    modal = document.getElementById('item-modal');
    modalCloseButton = document.getElementById('modal-close-button');
    modalImg = document.getElementById('modal-img');
    modalItemName = document.getElementById('modal-item-name');
    modalFilename = document.getElementById('modal-filename');
    modalVersion = document.getElementById('modal-version');
    modalDownloadButton = document.getElementById('modal-download-button');
    modalSelectButton = document.getElementById('modal-select-button');
    toggleInfoButton = document.getElementById('toggle-info-button'); 
    infoSection = document.getElementById('info-section'); 
    supportersListDiv = document.getElementById('supporters-list'); // Assign the new div

    // Initialize the application
    initializeTheme();
    setupEventListeners();
    loadVersions(); // Start the loading process
    loadSupporters(); // <<< ADD THIS LINE
    updateCopyrightYear();
});

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark
    document.body.setAttribute('data-theme', savedTheme);
    themeToggleButton.setAttribute('aria-checked', savedTheme === 'light');
}

function setupEventListeners() {
    themeToggleButton.addEventListener('click', toggleTheme);
    versionSelect.addEventListener('change', handleVersionChange);
    sortSelect.addEventListener('change', handleSortChange);
    searchInput.addEventListener('input', filterAndRenderItems);
    downloadAllButton.addEventListener('click', handleDownloadClick);
    clearSelectionButton.addEventListener('click', clearSelection);
    selectVisibleButton.addEventListener('click', selectVisibleItems);
    gallery.addEventListener('scroll', handleScroll);
    backToTopButton.addEventListener('click', scrollToTop);
    toggleInfoButton.addEventListener('click', toggleInfoSection); // Listener for info toggle

    // Delegated listener for gallery items and info buttons
    gallery.addEventListener('click', handleGalleryClick);
    gallery.addEventListener('scroll', handleScroll); // Also handles lazy load sentinel observation trigger

    // Modal listeners
    modalCloseButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        // Close modal if clicking the backdrop (outside the content)
        if (event.target === modal) {
            closeModal();
        }
    });
    // Modal action buttons listeners are assigned dynamically when modal opens
}

function updateCopyrightYear() {
    const yearSpan = document.getElementById('copyright-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

// --- Version Handling ---

async function loadVersions() {
    versionSelect.innerHTML = '<option value="loading">Loading...</option>';
    versionSelect.disabled = true;

    try {
        addVersionOption('latest', 'Latest Version');

        // Fetch versions from versions.json
        let versionsData = null;
        try {
            const response = await fetch(`${BASE_PATH}/images/versions.json`);
            if (response.ok) {
                versionsData = await response.json();
                availableVersions = versionsData.versions || [];
            } else {
                 console.warn(`versions.json not found or failed (${response.status}), using fallback.`);
                 throw new Error('versions.json fetch failed');
            }
        } catch (e) {
            console.warn('Error fetching versions.json:', e);
            availableVersions = ['1.21.5', '1.21.4']; // Hardcoded fallback
        }

        availableVersions.sort(compareVersions).reverse(); // Newest first in list
        availableVersions.forEach(version => addVersionOption(version, version));

        // Determine initial version to load
        const urlParams = new URLSearchParams(window.location.search);
        const versionParam = urlParams.get('version');
        const savedVersion = localStorage.getItem('selectedVersion');
        let initialVersion = 'latest';

        if (versionParam && (versionParam === 'latest' || availableVersions.includes(versionParam))) {
            initialVersion = versionParam;
        } else if (savedVersion && (savedVersion === 'latest' || availableVersions.includes(savedVersion))) {
            initialVersion = savedVersion;
        }

        versionSelect.value = initialVersion;
        currentVersion = initialVersion;

        await loadItemData(); // Load data for the initial version

    } catch (error) {
        console.error('Error loading versions:', error);
        versionSelect.innerHTML = '<option value="error">Error</option>';
    } finally {
        versionSelect.disabled = false;
    }
}

function addVersionOption(value, text) {
    const loadingOption = versionSelect.querySelector('option[value="loading"]');
    if (loadingOption) loadingOption.remove();
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    versionSelect.appendChild(option);
}

// Semantic Version Comparison
function compareVersions(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
        const valA = partsA[i] || 0;
        const valB = partsB[i] || 0;
        if (valA !== valB) return valA - valB;
    }
    return 0;
}

async function handleVersionChange(event) {
    currentVersion = event.target.value;
    localStorage.setItem('selectedVersion', currentVersion);
    const url = new URL(window.location.href);
    url.searchParams.set('version', currentVersion);
    window.history.pushState({ version: currentVersion }, '', url);
    await loadItemData();
}

// --- Data Loading & Processing ---

async function loadItemData() {
    gallery.innerHTML = '<div class="loading">Loading version data...</div>';
    setLoadingState(true);

    try {
        loadedImages.clear();
        allItems = [];
        //repoInfoDisplay.textContent = `Loading base images...`;
        await loadManifest(`${BASE_PATH}/images/base/manifest.json`, 'base');

        let versionsToLoad = [];
        if (currentVersion === 'latest') {
            versionsToLoad = [...availableVersions].sort(compareVersions); // Oldest to newest
        } else {
            versionsToLoad = availableVersions
                .filter(v => compareVersions(v, currentVersion) <= 0)
                .sort(compareVersions); // Oldest to newest
        }

        for (const version of versionsToLoad) {
            await loadChangeset(`${BASE_PATH}/images/${version}/changes.json`, version);
        }

        const versionLabel = currentVersion === 'latest' ? 'Latest Version' : `Version ${currentVersion}`;
        filterAndRenderItems(); // Initial sort, filter, render

    } catch (error) {
        console.error(`Error loading data for version ${currentVersion}:`, error);
        gallery.innerHTML = `<div class="no-results">Error loading item data for ${currentVersion}.<br>(${error.message})<br>Try refreshing or selecting another version.</div>`;
        totalCountDisplay.textContent = 'Total: 0 items';
        filteredCountDisplay.textContent = 'Showing: 0 items';
    } finally {
       setLoadingState(false);
    }
}

function setLoadingState(isLoading) {
    // Disable/enable controls during data loading
    [searchInput, downloadAllButton, clearSelectionButton, selectVisibleButton, versionSelect, sortSelect].forEach(el => el.disabled = isLoading);
}

async function loadManifest(manifestUrl, versionTag) {
    try {
        const response = await fetch(`${manifestUrl}?t=${Date.now()}`);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const manifest = await response.json();

        (manifest.images || []).forEach(filename => {
            if (!loadedImages.has(filename)) {
                 allItems.push(filename);
                 loadedImages.set(filename, versionTag);
            }
        });
        console.log(`Loaded ${manifest.images?.length || 0} images from ${versionTag} manifest.`);
    } catch (error) {
        console.error(`Error processing ${versionTag} manifest (${manifestUrl}):`, error);
        if (versionTag === 'base') throw error; // Base manifest failure is critical
        else console.warn(`Skipping ${versionTag} manifest due to error.`);
    }
}

async function loadChangeset(changesetUrl, versionTag) {
     try {
        const response = await fetch(`${changesetUrl}?t=${Date.now()}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`No changeset for ${versionTag}, skipping.`);
                return; // 404 is expected if no changes for a version
            }
            throw new Error(`Fetch failed: ${response.status}`);
        }
        const changes = await response.json();
        let added = 0, modified = 0, removed = 0;

        (changes.removed || []).forEach(filename => {
            const index = allItems.indexOf(filename);
            if (index > -1) { allItems.splice(index, 1); loadedImages.delete(filename); removed++; }
        });
        (changes.added || []).forEach(filename => {
             if (!loadedImages.has(filename)) { allItems.push(filename); loadedImages.set(filename, versionTag); added++; }
             else { const existing = loadedImages.get(filename); if (compareVersions(versionTag, existing) > 0) loadedImages.set(filename, versionTag); }
        });
        (changes.modified || []).forEach(filename => {
            if (!loadedImages.has(filename)) { allItems.push(filename); added++; } // Treat as added if not present
            loadedImages.set(filename, versionTag); // Always update source
            modified++;
        });
        console.log(`Changeset ${versionTag}: +${added}, ~${modified}, -${removed}`);
    } catch (error) {
        console.error(`Error processing changeset ${versionTag} (${changesetUrl}):`, error);
        console.warn(`Skipping changeset ${versionTag} due to error.`);
    }
}

// --- Sorting & Filtering ---

function handleSortChange(event) {
    currentSort = event.target.value;
    filterAndRenderItems();
}

function sortItems(itemsToSort) {
    itemsToSort.sort((a, b) => {
        const nameA = formatItemName(a);
        const nameB = formatItemName(b);

        if (currentSort === 'version') {
            // Version sort: Newest (highest version) first
            const versionA = loadedImages.get(a) || 'base'; // Default to 'base' if missing
            const versionB = loadedImages.get(b) || 'base';

            // Handle 'base' as the oldest
            if (versionA === 'base' && versionB !== 'base') return 1; // a is older
            if (versionB === 'base' && versionA !== 'base') return -1; // b is older
            if (versionA === 'base' && versionB === 'base') {
                 // If both are base, sort by name A-Z as secondary
                 return nameA.localeCompare(nameB);
            }

            // Compare versions using semantic comparison, newest first
            const comparison = compareVersions(versionB, versionA); // Note B vs A for descending
            if (comparison === 0) {
                 // If versions are the same, sort by name A-Z as secondary
                 return nameA.localeCompare(nameB);
            }
            return comparison;
        } else if (currentSort === 'length') {
             // Length sort: Longest name first
             const lengthDiff = nameB.length - nameA.length;
             if (lengthDiff === 0) {
                 // If lengths are the same, sort by name A-Z as secondary
                 return nameA.localeCompare(nameB);
             }
             return lengthDiff;
        } else {
            // Name sort (A-Z or Z-A)
            return currentSort === 'za' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
        }
    });
}

function filterItems(itemsToFilter, searchTerm) {
     if (!searchTerm) return itemsToFilter;
     const lowerTerm = searchTerm.toLowerCase();
     return itemsToFilter.filter(filename => formatItemName(filename).toLowerCase().includes(lowerTerm));
}

// --- Rendering ---

function filterAndRenderItems() {
    const searchTerm = searchInput.value;
    sortItems(allItems); // Sort the source array
    displayedItems = filterItems(allItems, searchTerm); // Filter into displayedItems

    // Update counts and button visibility
    totalCountDisplay.textContent = `Total: ${allItems.length} items`;
    filteredCountDisplay.textContent = `Showing: ${displayedItems.length} items`;
    selectVisibleButton.style.display = searchTerm && displayedItems.length > 0 ? 'inline-block' : 'none';

    renderGallery(displayedItems);
    updateSelectionControls(); // Ensure download button state reflects current view
}

function renderGallery(itemsToRender) {
    gallery.innerHTML = ''; // Clear view

    if (itemsToRender.length === 0) {
        gallery.innerHTML = '<div class="no-results">No items found matching your criteria.</div>';
        return;
    }

    // Render initial batch + setup lazy load if needed
    const initialBatch = itemsToRender.slice(0, RENDER_BATCH_SIZE);
    initialBatch.forEach(filename => gallery.appendChild(createItemElement(filename)));

    if (itemsToRender.length > RENDER_BATCH_SIZE) {
        setupLazyLoading(itemsToRender, RENDER_BATCH_SIZE);
    }
}

let observer = null; // Intersection observer instance

function setupLazyLoading(items, startIndex) {
    if (observer) observer.disconnect(); // Clean up previous observer

    const sentinel = document.createElement('div');
    sentinel.className = 'loading sentinel'; // Marker for observation
    sentinel.textContent = 'Loading more items...';

    observer = new IntersectionObserver((entries) => {
        // If sentinel is visible and more items exist
        if (entries[0].isIntersecting && startIndex < items.length) {
            const end = Math.min(startIndex + RENDER_BATCH_SIZE, items.length);
            const batch = items.slice(startIndex, end);

            batch.forEach(filename => {
                // Insert before sentinel if it's still in the DOM
                 if (sentinel.parentNode) gallery.insertBefore(createItemElement(filename), sentinel);
                 else gallery.appendChild(createItemElement(filename)); // Fallback append
            });

            startIndex = end; // Update index for next batch

            // If more items, move sentinel down; else remove it and stop observing
            if (startIndex < items.length) gallery.appendChild(sentinel);
            else { sentinel.remove(); observer.disconnect(); observer = null; }
        }
    }, { root: gallery }); // Observe scrolling within the gallery element

    if (startIndex < items.length) {
        gallery.appendChild(sentinel);
        observer.observe(sentinel);
    }
}

function createItemElement(filename) {
    const fragment = document.createDocumentFragment(); // Use fragment to reduce DOM ops
    const itemDiv = document.createElement('div');
    const displayName = formatItemName(filename); // Get formatted name (potentially cached)

    itemDiv.className = 'item';
    itemDiv.dataset.filename = filename;
    // Tooltip clarifies clicking the card selects it
    itemDiv.title = `Select/Deselect: ${displayName}
Filename: ${filename}`;

    if (selectedItems.has(filename)) itemDiv.classList.add('selected');

    // Append elements using helper functions
    itemDiv.appendChild(createItemInfoButton(filename, displayName));
    itemDiv.appendChild(createItemImage(filename, displayName));
    itemDiv.appendChild(createNameElement(displayName));
    itemDiv.appendChild(createVersionBadge(filename));

    // NO individual listener here - handled by delegation in handleGalleryClick

    fragment.appendChild(itemDiv);
    return fragment;
}

function createItemInfoButton(filename, displayName) {
    const infoButton = document.createElement('button');
    infoButton.className = 'item-info-button';
    infoButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>`;
    infoButton.setAttribute('aria-label', `Details for ${displayName}`);
    infoButton.title = 'View Details';
    // NO listener here - handled by delegation in handleGalleryClick
    return infoButton;
}

function createItemImage(filename, displayName) {
    const img = document.createElement('img');
    const itemVersion = loadedImages.get(filename) || 'unknown';
    img.src = getItemImageUrl(filename, itemVersion);
    img.alt = `Minecraft ${displayName} item texture from version ${itemVersion}`;
    img.loading = "lazy"; // Keep native lazy loading
    // Add width/height via CSS instead for better separation
    img.onerror = function() {
        console.warn(`Image load failed: ${filename} (Source: ${itemVersion})`);
        this.src = `${BASE_PATH}/assets/missing.png`;
        this.onerror = null;
    };
    return img;
}

function createNameElement(displayName) {
    const nameDiv = document.createElement('div');
    nameDiv.className = 'item-name';
    nameDiv.textContent = displayName;
    return nameDiv;
}

function createVersionBadge(filename) {
    const itemVersion = loadedImages.get(filename) || 'unknown';
    const versionBadge = document.createElement('span');
    versionBadge.className = 'item-version-badge';
    versionBadge.textContent = itemVersion === 'base' ? 'Base' : itemVersion;
    return versionBadge;
}

function getItemImageUrl(filename, version) {
     if (version === 'base') return `${BASE_PATH}/images/base/${filename}`;
     else if (version !== 'unknown') return `${BASE_PATH}/images/${version}/${filename}`;
     else return `${BASE_PATH}/assets/missing.png`; // Fallback
}

function formatItemName(filename) {
    if (itemNameCache.has(filename)) {
        return itemNameCache.get(filename);
    }

    const formattedName = filename.replace(/\.png$/i, '').replace(/_/g, ' ')
                           .replace(/\b\w/g, char => char.toUpperCase());

    itemNameCache.set(filename, formattedName); // Store in cache
    return formattedName;
}

// --- Selection Handling ---

function toggleItemSelection(itemElement, filename) {
    const wasSelected = selectedItems.has(filename);
    if (wasSelected) {
        selectedItems.delete(filename);
        itemElement?.classList.remove('selected'); // Optional chaining for safety
    } else {
        selectedItems.add(filename);
        itemElement?.classList.add('selected');
    }
    updateSelectionControls();

    // Sync modal button if it's open for the toggled item
    if (modal.style.display === 'block' && currentModalFilename === filename) {
        updateModalSelectButton();
    }
}

function clearSelection() {
    selectedItems.clear();
    // Visually deselect all currently rendered items
    gallery.querySelectorAll('.item.selected').forEach(el => {
        el.classList.remove('selected');
    });
    updateSelectionControls();

    // If modal is open, update its select button state
    if (modal.style.display === 'block' && currentModalFilename) {
        updateModalSelectButton(); // Will now show "Select Item"
    }
}


function selectVisibleItems() {
    // Select items currently visible in the gallery viewport matching filter
    const visibleItemElements = gallery.querySelectorAll('.item');
    visibleItemElements.forEach(el => {
        const filename = el.dataset.filename;
        if (filename && !selectedItems.has(filename)) {
            selectedItems.add(filename);
            el.classList.add('selected');
        }
    });
    updateSelectionControls();

    // If modal is open, update its button state if the item just got selected
    if (modal.style.display === 'block' && currentModalFilename && selectedItems.has(currentModalFilename)) {
         updateModalSelectButton();
    }
}


function updateSelectionControls() {
    const count = selectedItems.size;
    clearSelectionButton.style.display = count > 0 ? 'inline-block' : 'none';

    if (count > 0) {
        downloadAllButton.textContent = `Download Selected (${count}) as ZIP`;
        downloadAllButton.disabled = false;
    } else {
        // If nothing selected, button downloads all *visible* items
        downloadAllButton.textContent = 'Download All as ZIP';
        // Disable if no items are displayed at all
        downloadAllButton.disabled = displayedItems.length === 0;
    }
}

// --- Download Handling ---

function handleDownloadClick() {
    let itemsToDownload;
    let zipFilenameSuffix;

    if (selectedItems.size > 0) {
        itemsToDownload = Array.from(selectedItems);
        zipFilenameSuffix = 'selected';
    } else {
        // Download all currently *displayed* (filtered) items
        itemsToDownload = displayedItems;
        zipFilenameSuffix = searchInput.value ? 'filtered' : 'all'; // More descriptive suffix
    }

    if (itemsToDownload.length === 0) {
        alert('No items to download. Select items or adjust your search filter.');
        return;
    }

    const zipFilename = `minecraft-items-${currentVersion}-${zipFilenameSuffix}.zip`;

    // --- Show and reset progress bar immediately ---
    progressContainer.style.display = 'block'; 
    progressBar.style.width = '0%';
    progressBar.classList.remove('error'); // Remove previous error state
    // ---------------------------------------------

    downloadItemsAsZip(itemsToDownload, zipFilename);
}

function downloadSingleItem(filename) {
    const itemVersion = loadedImages.get(filename) || 'unknown';
    const imageUrl = getItemImageUrl(filename, itemVersion);

    fetch(imageUrl)
        .then(response => {
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            return response.blob();
        })
        .then(blob => saveAs(blob, filename)) // FileSaver.js
        .catch(error => {
             console.error(`Error downloading ${filename}:`, error);
             alert(`Could not download ${filename}. See console.`);
        });
}

async function downloadItemsAsZip(items, zipFilename) {
    const zip = new JSZip();
    const downloadButton = document.getElementById('download-all'); // Renamed for clarity
    const originalText = downloadButton.textContent;
    const progressContainer = document.getElementById('loading-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const CACHE_NAME = 'minecraft-image-cache-v1'; // Cache name

    // --- Phase 1: Gather Image Blobs (Check Cache, Fetch if Missing) ---
    console.log(`Starting Phase 1: Gathering ${items.length} items...`);
    downloadButton.textContent = "Gathering images...";
    downloadButton.disabled = true;
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressBar.classList.remove('error');
    progressText.textContent = 'Gathering: 0%';

    let completedGathering = 0;
    const totalItems = items.length;
    const imageData = []; // Array to hold { filename, blob } pairs
    let cacheHits = 0; // Counter for cache hits
    let cacheMisses = 0; // Counter for cache misses (fetches)
    const BATCH_SIZE = 10; // Keep batching for fetches

    try {
        const cache = await caches.open(CACHE_NAME); // Open cache once

        for (let i = 0; i < totalItems; i += BATCH_SIZE) {
            const batch = items.slice(i, i + BATCH_SIZE);
            console.log(`Gathering batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(totalItems / BATCH_SIZE)}`);

            const batchPromises = batch.map(async (filename) => {
                const imageVersion = loadedImages.get(filename);
                const imageUrl = getItemImageUrl(filename, imageVersion);

                // Skip known missing/placeholder images early
                if (imageUrl.endsWith('/assets/missing.png')) {
                    console.warn(`Skipping placeholder image: ${filename}`);
                    return null; // Indicate skipped
                }

                try {
                    // 1. Check Cache
                    const cachedResponse = await cache.match(imageUrl);

                    if (cachedResponse && cachedResponse.ok) {
                        // 1a. Cache Hit
                        // console.log(`Cache hit for: ${filename}`); // Removed per-item logging
                        cacheHits++;
                        const blob = await cachedResponse.blob();
                        return { filename, blob };
                    } else {
                        // 1b. Cache Miss - Fetch
                        // console.log(`Cache miss for: ${filename}. Fetching...`); // Removed per-item logging
                        cacheMisses++;
                        const fetchResponse = await fetch(imageUrl);
                        if (!fetchResponse.ok) {
                            throw new Error(`Fetch failed: ${fetchResponse.status}`);
                        }
                        const responseToCache = fetchResponse.clone(); // Clone for caching
                        const blob = await fetchResponse.blob();

                        // 2. Store in Cache
                        await cache.put(imageUrl, responseToCache);
                        // console.log(`Cached fetched response for: ${filename}`); // Removed per-item logging
                        return { filename, blob };
                    }
                } catch (error) {
                    console.error(`Error processing ${filename}:`, error);
                    return { filename, error: true }; // Mark as error to update progress but not add to zip
                }
            });

            // Wait for the current batch to finish processing (cache checks/fetches)
            const batchResults = await Promise.all(batchPromises);

            // Process results of the batch
            batchResults.forEach(result => {
                completedGathering++;
                const progress = Math.round((completedGathering / totalItems) * 100);
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `Gathering: ${progress}%`;

                if (result && !result.error) {
                    imageData.push(result); // Add successful results
                } else if (result && result.error) {
                    console.warn(`Failed to get blob for ${result.filename}, will be excluded from ZIP.`);
                    // Optionally add visual indication of partial failure
                } else {
                     // Null result means it was skipped (e.g., missing.png)
                     // console.log(`Skipped an item as planned.`); // Can be noisy, commented out
                }
            });
             // Small delay might help UI responsiveness on large batches, optional
            // await new Promise(resolve => setTimeout(resolve, 10));
        }

        console.log(`Phase 1 Complete: Gathered ${imageData.length} blobs successfully out of ${totalItems} requested.`);
        console.log(`Cache Stats: Hits = ${cacheHits}, Fetches = ${cacheMisses}`); // Added summary logging

        if (imageData.length === 0) {
             throw new Error("No images could be gathered (all failed or were skipped).");
        }

        // --- Phase 2: Create and Download ZIP ---
        console.log(`Starting Phase 2: Zipping ${imageData.length} items...`);
        progressText.textContent = 'Zipping: 0%'; // Reset progress text for zipping phase
        progressBar.style.width = '0%'; // Reset progress bar for zipping phase

        // Add gathered blobs to the zip
        imageData.forEach(data => {
            try {
                 zip.file(data.filename, data.blob);
            } catch (zipError) {
                 console.error(`Error adding file ${data.filename} to zip:`, zipError);
                 // Optionally remove it from a counter if you want to report partial success
            }
        });


        // Generate the ZIP file blob
        const zipBlob = await zip.generateAsync(
            { type: 'blob', streamFiles: true }, // streamFiles might improve performance for many files
            (metadata) => {
                const percent = metadata.percent.toFixed(0);
                // console.log(`Zipping progress: ${percent}%`);
                progressBar.style.width = `${percent}%`;
                progressText.textContent = `Zipping: ${percent}%`;
            }
        );

        console.log(`Phase 2 Complete: ZIP Blob generated, size: ${zipBlob.size} bytes.`);

        // Trigger download
        console.log(`Calling saveAs for filename: ${zipFilename}`);
        saveAs(zipBlob, zipFilename);
        console.log(`saveAs call completed for ${zipFilename}.`);
        progressText.textContent = 'Done!'; // Final status update

    } catch (error) {
        console.error('Error during ZIP creation process:', error);
        progressBar.classList.add('error');
        progressBar.style.width = '100%';
        // Show brief error message in progress bar
        const shortError = error.message.length > 40 ? error.message.substring(0, 37) + '...' : error.message;
        progressText.textContent = `Error: ${shortError}`; 
        alert(`There was an error: ${error.message}`);
    } finally {
        console.log('Restoring button state in finally block.');
        downloadButton.textContent = originalText;
        downloadButton.disabled = false;
        // Hide progress bar after a delay
        setTimeout(() => {
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressBar) progressBar.classList.remove('error');
        }, 3000); // Slightly longer delay
    }
}

// --- UI Helpers ---

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    themeToggleButton.setAttribute('aria-checked', newTheme === 'light');
    localStorage.setItem('theme', newTheme);
    console.log(`Theme changed to ${newTheme}`);
}

function handleScroll() {
    if (gallery.scrollTop > 400) backToTopButton.classList.add('visible');
    else backToTopButton.classList.remove('visible');
}

function scrollToTop() {
    gallery.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- How to Use / Info Section Toggle ---
function toggleInfoSection() {
    const isExpanded = toggleInfoButton.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
        infoSection.classList.remove('visible');
        toggleInfoButton.setAttribute('aria-expanded', 'false');
        toggleInfoButton.firstChild.textContent = ' Show Info / How to Use '; // Restore text
    } else {
        infoSection.classList.add('visible');
        toggleInfoButton.setAttribute('aria-expanded', 'true');
        toggleInfoButton.firstChild.textContent = ' Hide Info / How to Use '; // Change text
    }
}


// --- Modal Functionality ---

function openModal(filename) {
    currentModalFilename = filename;
    const displayName = formatItemName(filename);
    const itemVersion = loadedImages.get(filename) || 'unknown';
    const imageUrl = getItemImageUrl(filename, itemVersion);

    modalImg.src = imageUrl;
    modalImg.alt = displayName;
    modalItemName.textContent = displayName;
    modalFilename.textContent = filename;
    modalVersion.textContent = itemVersion === 'base' ? 'Base' : itemVersion;

    updateModalSelectButton(); // Set initial button state

    // Assign listeners for modal buttons
    modalDownloadButton.onclick = () => downloadSingleItem(currentModalFilename);
    modalSelectButton.onclick = () => {
        // Find the corresponding item element *if it exists in the current view*
        const itemElement = gallery.querySelector(`.item[data-filename="${currentModalFilename}"]`);
        toggleItemSelection(itemElement, currentModalFilename); // Toggle selection state
        // updateModalSelectButton is called inside toggleItemSelection if modal is open
    };

    modal.style.display = 'block';
    modalCloseButton.focus(); // Focus close button for accessibility
}

function closeModal() {
    modal.style.display = 'none';
    currentModalFilename = null;
    modalImg.src = ""; // Clear image to prevent flash of old content
    // Clear listeners to prevent potential memory leaks (though simple onclick is usually fine)
    modalDownloadButton.onclick = null;
    modalSelectButton.onclick = null;
}

function updateModalSelectButton() {
    // Only proceed if the modal is actually supposed to be showing an item
    if (!currentModalFilename) return;

    if (selectedItems.has(currentModalFilename)) {
        modalSelectButton.textContent = 'Deselect Item';
        // Use CSS variables for styling consistency if possible, fallback inline
        modalSelectButton.style.backgroundColor = 'var(--muted-text)';
        modalSelectButton.style.color = 'var(--bg-color)'; // Ensure contrast
    } else {
        modalSelectButton.textContent = 'Select Item';
        modalSelectButton.style.backgroundColor = 'var(--accent-color)';
        // Set text color based on theme for better contrast on accent
        const theme = document.body.getAttribute('data-theme') || 'dark';
        modalSelectButton.style.color = theme === 'light' ? '#fff' : '#000';
    }
}

// --- NEW: Delegated Event Handler for Gallery ---
function handleGalleryClick(event) {
    const itemElement = event.target.closest('.item');
    if (!itemElement) return; // Click wasn't inside an item

    const filename = itemElement.dataset.filename;
    if (!filename) return; // Item element missing filename data

    // Check if the info button was clicked specifically
    if (event.target.closest('.item-info-button')) {
        openModal(filename);
    } else {
        // Otherwise, treat click as item selection/deselection
        toggleItemSelection(itemElement, filename);
    }
}

// --- Add this new function to load supporters ---
async function loadSupporters() {
    if (!supportersListDiv) return; // Exit if the element doesn't exist

    try {
        // Add timestamp to prevent caching of the JSON file itself if needed during frequent updates
        // Remove ?t=... if you prefer standard browser caching for the JSON file
        const response = await fetch(`${BASE_PATH}/members.json?t=${Date.now()}`); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const supporterData = await response.json();

        if (!Array.isArray(supporterData)) {
            throw new Error('Invalid format: members.json should contain an array of objects.');
        }

        supportersListDiv.innerHTML = ''; // Clear the "Loading..." message or old content

        if (supporterData.length === 0) {
            supportersListDiv.innerHTML = '<p>No supporters listed currently.</p>';
            return;
        }

        // Sort supporters by tier (descending) then name (ascending) - optional
        supporterData.sort((a, b) => {
            const tierComparison = (b.tier ?? 0) - (a.tier ?? 0); // Higher tiers first (handle potential null/undefined tier)
            if (tierComparison !== 0) return tierComparison;
            return a.name.localeCompare(b.name); // Sort by name if tiers are equal
        });

        supporterData.forEach(supporter => {
            if (!supporter || typeof supporter.name !== 'string') {
                console.warn('Skipping invalid supporter entry:', supporter);
                return; // Skip invalid entries
            }
            const nameElement = document.createElement('span');
            nameElement.className = 'supporter-name'; 
            // Add data-tier attribute for styling
            const tier = supporter.tier ?? 0; // Default to tier 0 if undefined
            nameElement.dataset.tier = tier; 
            nameElement.textContent = supporter.name;
            nameElement.title = supporter.name; // Show full name on hover
            supportersListDiv.appendChild(nameElement);
        });

    } catch (error) {
        console.error('Error loading supporters:', error);
        supportersListDiv.innerHTML = '<p>Could not load supporter list.</p>'; // Display error message
    }
}