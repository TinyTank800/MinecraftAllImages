// State Variables
let allItems = []; // List of unique filenames across loaded versions
let displayedItems = []; // Currently rendered items after sorting/filtering
let selectedItems = new Set(); // Tracks selected filenames
let loadedImages = new Map(); // Tracks source version (tag) for each image filename
let imageDataCache = new Map(); // Cache for filename -> Blob mapping
let itemNameCache = new Map(); // Cache for formatted item names
let itemHistory = new Map(); // NEW: Tracks filename -> [{ version: string, filename: string }, ...]
let availableVersions = []; // List of available version folders/zips
let baseVersion = null; // Store the base version from versions.json
let currentVersion = 'latest'; // Currently selected version filter
let currentSort = 'az'; // Current sort order ('az', 'za', 'version')
let currentModalFilename = null; // Track filename shown in modal
let supportersListDiv;
let showRemovedItems = false; // New state variable for showing removed items
let markedAsRemoved = new Set(); // Track items that *would* be removed

// Declare DOM element variables here, but assign them inside DOMContentLoaded
let gallery, searchInput, downloadAllButton, clearSelectionButton, selectVisibleButton;
let totalCountDisplay, filteredCountDisplay, versionSelect, sortSelect, themeToggleButton;
let backToTopButton, progressContainer, progressBar, progressText, modal, modalCloseButton;
let modalImg, modalItemName, modalFilename, modalVersion, modalDownloadButton;
let modalSelectButton, toggleInfoButton, infoSection;
let showRemovedToggle; // Reference for the new checkbox

// Constants
const RENDER_BATCH_SIZE = 100;
const BASE_PATH = window.location.pathname.includes('/MinecraftAllImages/')
    ? '/MinecraftAllImages'
    : ''; // Adjust if deployed elsewhere
const CACHE_NAME = 'minecraft-zip-cache-v1'; // Cache name for ZIP files

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
    supportersListDiv = document.getElementById('supporters-list');
    showRemovedToggle = document.getElementById('show-removed-toggle'); // Get the checkbox

    // Initialize the application
    initializeTheme();
    initializeShowRemovedState(); // Load saved state for the checkbox
    setupEventListeners();
    loadVersions(); // Start the loading process
    loadSupporters();
    updateCopyrightYear();
});

function setLoadingState(isLoading) {
    if (isLoading) {
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.classList.remove('error');
        progressText.textContent = 'Initializing...';
        // Optionally disable controls
        searchInput.disabled = true;
        versionSelect.disabled = true;
        sortSelect.disabled = true;
        downloadAllButton.disabled = true;
        clearSelectionButton.disabled = true;
        selectVisibleButton.disabled = true;
    } else {
        // Don't hide progress immediately if it shows an error
        if (!progressBar.classList.contains('error')) {
            setTimeout(() => {
                if (progressContainer) progressContainer.style.display = 'none';
            }, 1500); // Delay hiding to show completion/error
        }
        // Re-enable controls
        searchInput.disabled = false;
        versionSelect.disabled = false; // Version change might re-trigger loading
        sortSelect.disabled = false;
        // downloadAllButton enabled status depends on selection/filter results
        updateSelectionControls();
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark
    document.body.setAttribute('data-theme', savedTheme);
    themeToggleButton.setAttribute('aria-checked', savedTheme === 'light');
    setLoadingState(false);
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
    toggleInfoButton.addEventListener('click', toggleInfoSection);
    showRemovedToggle.addEventListener('change', handleShowRemovedToggle); // Add listener

    gallery.addEventListener('click', handleGalleryClick);
    gallery.addEventListener('scroll', handleScroll);

    modalCloseButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
}

function updateCopyrightYear() {
    const yearSpan = document.getElementById('copyright-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

function handleSortChange(event) {
    currentSort = event.target.value;
    // No need to save sort preference, it's usually transient
    filterAndRenderItems(); // Re-sort and re-render the gallery
}

// --- Version Handling ---

async function loadVersions() {
    versionSelect.innerHTML = '<option value="loading">Loading...</option>';
    versionSelect.disabled = true;
    availableVersions = [];
    baseVersion = null;

    try {
        console.log(`Fetching versions from ${BASE_PATH}/images/versions.json`);
        const response = await fetch(`${BASE_PATH}/images/versions.json?t=${Date.now()}`);
        if (!response.ok) {
             console.error(`versions.json fetch failed (${response.status})`);
             throw new Error('versions.json fetch failed');
        }
        const versionsData = await response.json();

        if (!versionsData || !Array.isArray(versionsData.versions) || typeof versionsData.base !== 'string') {
            console.error('Invalid versions.json format:', versionsData);
            throw new Error('Invalid versions.json format.');
        }

        availableVersions = versionsData.versions.sort(compareVersions).reverse();
        baseVersion = versionsData.base;

        console.log('Available versions:', availableVersions);
        console.log('Base version:', baseVersion);

        if (!availableVersions.includes(baseVersion)) {
             console.warn(`Base version "${baseVersion}" not found in available versions list.`);
        }

        versionSelect.innerHTML = '';
        addVersionOption('latest', 'Latest Version');
        availableVersions.forEach(version => addVersionOption(version, version));

        const urlParams = new URLSearchParams(window.location.search);
        const versionParam = urlParams.get('version');
        const savedVersion = localStorage.getItem('selectedVersion');
        let initialVersion = 'latest';

        if (versionParam && (versionParam === 'latest' || availableVersions.includes(versionParam))) {
            initialVersion = versionParam;
        } else if (savedVersion && (savedVersion === 'latest' || availableVersions.includes(savedVersion))) {
            initialVersion = savedVersion;
        } else if (availableVersions.length > 0) {
            initialVersion = 'latest';
        }

        versionSelect.value = initialVersion;
        currentVersion = initialVersion;
        console.log(`Initial version set to: ${currentVersion}`);

        await loadItemData();

    } catch (error) {
        console.error('Error loading versions:', error);
        versionSelect.innerHTML = '<option value="error">Load Error</option>';
        gallery.innerHTML = `<div class="no-results">Error loading version list.<br>(${error.message})<br>Please refresh the page.</div>`;
        setLoadingState(false);
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

async function loadVersionZip(version, cache, isBaseVersion) {
    const zipUrl = `${BASE_PATH}/images/${version}.zip`;
    const result = {
        versionTag: version,
        processed: false,
        added: [],
        modified: [],
        removed: [],
        manifestImages: [],
        error: null
    };

    console.log(`Processing version zip: ${version} (Base: ${isBaseVersion})`);
    setLoadingProgress(`Checking cache for ${version}.zip...`);

    try {
        let zipBlob = null;
        const cachedResponse = await cache.match(zipUrl);

        if (cachedResponse && cachedResponse.ok) {
            console.log(`Cache hit for ZIP: ${version}`);
            zipBlob = await cachedResponse.blob();
            setLoadingProgress(`Loading ${version}.zip from cache...`);
        } else {
            console.log(`Cache miss for ZIP: ${version}. Fetching...`);
            setLoadingProgress(`Downloading ${version}.zip...`);
            const fetchResponse = await fetch(zipUrl);
            if (!fetchResponse.ok) {
                if (fetchResponse.status === 404) {
                    console.warn(`ZIP file not found for version ${version} (404). Skipping.`);
                    setLoadingProgress(`Skipped ${version} (Not found)`);
                    result.error = 'ZIP Not Found (404)';
                    return result;
                }
                throw new Error(`Fetch failed for ${version}.zip: ${fetchResponse.status} ${fetchResponse.statusText}`);
            }
            const responseToCache = fetchResponse.clone();
            zipBlob = await fetchResponse.blob();
            console.log(`Storing ${version}.zip in cache.`);
            setLoadingProgress(`Caching ${version}.zip...`);
            await cache.put(zipUrl, responseToCache);
        }

        if (zipBlob) {
            console.log(`Unzipping ${version}.zip (${(zipBlob.size / 1024 / 1024).toFixed(2)} MB)`);
            setLoadingProgress(`Processing ${version} contents...`);
            const zip = await JSZip.loadAsync(zipBlob);

            let manifestData = null;
            let changesData = null;
            const imageFilesToExtract = new Set();
            const basePathInZip = `${version}/`; // Base path inside the zip

            const manifestFile = zip.file(`${basePathInZip}manifest.json`);
            const changesFile = zip.file(`${basePathInZip}changes.json`);

            if (isBaseVersion) {
                if (!manifestFile) throw new Error(`manifest.json not found in base version zip: ${version}.zip`);
                setLoadingProgress(`Reading manifest for ${version}...`);
                const manifestContent = await manifestFile.async("string");
                try {
                    manifestData = JSON.parse(manifestContent);
                } catch (e) {
                     throw new Error(`Error parsing manifest.json in ${version}.zip: ${e.message}`);
                }

                console.log(`Base manifest ${version}:`, manifestData);
                if (!manifestData || !Array.isArray(manifestData.images)) {
                    throw new Error(`Invalid manifest.json format in ${version}.zip`);
                }

                // Filter out specific unwanted files
                result.manifestImages = (manifestData.images || []).filter(fname => fname !== 'x.png' && fname !== 'u.png');
                console.log(`Filtered base manifest images for ${version}: ${result.manifestImages.length} items remain.`);

                result.manifestImages.forEach(fname => imageFilesToExtract.add(fname));
            } else {
                if (!changesFile) {
                    console.warn(`changes.json not found in version zip: ${version}.zip. Assuming no changes.`);
                     setLoadingProgress(`No changes found for ${version}`);
                     result.processed = true;
                     return result;
                 }
                 setLoadingProgress(`Reading changes for ${version}...`);
                 const changesContent = await changesFile.async("string");
                  try {
                      changesData = JSON.parse(changesContent);
                  } catch (e) {
                       throw new Error(`Error parsing changes.json in ${version}.zip: ${e.message}`);
                  }

                 console.log(`Changeset ${version}:`, changesData);
                 if (!changesData) throw new Error(`Invalid changes.json format in ${version}.zip`);

                 // Filter out specific unwanted files
                 result.added = (changesData.added || []).filter(fname => fname !== 'x.png' && fname !== 'u.png');
                 result.modified = (changesData.modified || []).filter(fname => fname !== 'x.png' && fname !== 'u.png');
                 result.removed = (changesData.removed || []).filter(fname => fname !== 'x.png' && fname !== 'u.png');
                 console.log(`Filtered changeset for ${version}: +${result.added.length}, ~${result.modified.length}, -${result.removed.length}`);

                 result.added.forEach(fname => imageFilesToExtract.add(fname));
                 result.modified.forEach(fname => imageFilesToExtract.add(fname));
            }

            if (imageFilesToExtract.size > 0) {
                setLoadingProgress(`Extracting ${imageFilesToExtract.size} images for ${version}...`);
                console.log(`Extracting images for ${version}:`, Array.from(imageFilesToExtract));
                const imagePromises = [];
                let extractedCount = 0;

                imageFilesToExtract.forEach(filename => {
                    // Construct the full path within the zip
                    const filePathInZip = `${basePathInZip}${filename.replace(/\\/g, '/')}`;
                    const imageFileEntry = zip.file(filePathInZip);
                    if (imageFileEntry) {
                        imagePromises.push(
                            imageFileEntry.async('blob').then(blob => {
                                imageDataCache.set(filename, blob);
                                extractedCount++;
                            }).catch(err => {
                                console.error(`Error extracting image ${filename} from ${version}.zip:`, err);
                            })
                        );
                    } else {
                         console.warn(`Image file "${filePathInZip}" listed in manifest/changes not found in ${version}.zip`);
                    }
                });

                await Promise.all(imagePromises);
                console.log(`Finished extracting ${extractedCount}/${imageFilesToExtract.size} images for ${version}.`);
                setLoadingProgress(`Extracted images for ${version}`);
            } else {
                 console.log(`No new/modified images to extract for ${version}.`);
            }

            result.processed = true;
        }
    } catch (error) {
        console.error(`Error processing version ${version}:`, error);
        setLoadingProgress(`Error loading ${version}: ${error.message}`);
        result.error = error.message;
    }
    return result;
}

async function loadItemData() {
    setLoadingState(true);
    setLoadingProgress('Loading item data...', 0);
    console.log(`Starting loadItemData for version: ${currentVersion}`);

    allItems = [];
    loadedImages.clear(); // Stores current filename -> { path, versionTag }
    imageDataCache.clear(); // Clear image blob cache on version change
    itemNameCache.clear(); // Clear formatted names
    itemHistory.clear(); // NEW: Clear history on reload
    markedAsRemoved.clear(); // Clear removed tracking

    let targetVersion = currentVersion === 'latest' ? availableVersions[0] : currentVersion;
    let versionPath = [];
    let processing = true;

    if (!baseVersion || availableVersions.length === 0) {
        console.error("Base version or available versions not loaded.");
        setLoadingProgress('Error: Version data missing.', null, true);
        setLoadingState(false);
        gallery.innerHTML = '<div class="no-results">Error loading version data. Please refresh.</div>';
        return;
    }

    console.log(`Determined target version: ${targetVersion}`);

    // Build the path of versions to process: from base up to targetVersion
    versionPath.push(baseVersion);
    // Correctly add all intermediate versions
    const sortedAvailable = [...availableVersions].sort(compareVersions);
    for (const v of sortedAvailable) {
        // Include versions strictly after base and up to or equal to target
        if (compareVersions(v, baseVersion) > 0 && compareVersions(v, targetVersion) <= 0) {
            if (!versionPath.includes(v)) { // Avoid duplicates if base === target
                 versionPath.push(v);
            }
        }
    }
    // Ensure the final path is sorted chronologically
    versionPath.sort(compareVersions);

    console.log('Processing version path:', versionPath);

    const allVersionPromises = [];
    const cache = await caches.open(CACHE_NAME);

    // Prepare promises for loading all necessary version data (ZIPs)
    for (let i = 0; i < versionPath.length; i++) {
        const version = versionPath[i];
        const isBase = version === baseVersion;
        console.log(`Preparing to load data for version: ${version} (Base: ${isBase})`);
        allVersionPromises.push(loadVersionZip(version, cache, isBase));
    }

    try {
        // Load all version data concurrently
        const versionResults = await Promise.all(allVersionPromises);
        console.log('All version ZIPs/data processed.');

        // --- Process results chronologically to build history and final state ---
        let currentImageState = new Map(); // Tracks filename -> { path, versionTag } for the *current* step
        const baseResult = versionResults.find(r => r.versionTag === baseVersion);

        if (!baseResult || !baseResult.processed) {
             throw new Error(`Base version (${baseVersion}) data failed to process.`);
        }

        // 1. Initialize with Base Version data
        console.log(`Processing base version: ${baseVersion}`);
        setLoadingProgress(`Processing base: ${baseVersion}...`, 10); // Example progress
        for (const baseFilename of baseResult.manifestImages) {
            const imagePath = `${BASE_PATH}/images/${baseVersion}/${baseFilename}`;
            currentImageState.set(baseFilename, { path: imagePath, versionTag: baseVersion });
             // NEW: Initialize history
            itemHistory.set(baseFilename, [{ version: baseVersion, filename: baseFilename }]);
        }
        console.log(`Base version processed. ${currentImageState.size} initial items.`);


        // 2. Apply changes from subsequent versions
        let processedCount = 1; // Start after base
        const totalToProcess = versionPath.length;

        for (const version of versionPath) {
            if (version === baseVersion) continue; // Skip base, already processed

            const result = versionResults.find(r => r.versionTag === version);
             if (!result || !result.processed) {
                 console.warn(`Skipping unprocessed or missing version data for: ${version}`);
                 continue; // Skip if a version failed, but try to continue
             }

            const progress = 10 + Math.round(80 * (processedCount / (totalToProcess -1)));
            setLoadingProgress(`Applying changes: ${version}...`, progress);
            console.log(`Applying changes from version: ${version}`);

            // Modifications
            for (const modifiedFilename of result.modified) {
                const imagePath = `${BASE_PATH}/images/${version}/${modifiedFilename}`;
                currentImageState.set(modifiedFilename, { path: imagePath, versionTag: version });
                // NEW: Add to history
                if (itemHistory.has(modifiedFilename)) {
                    itemHistory.get(modifiedFilename).push({ version: version, filename: modifiedFilename });
                } else {
                     // Should theoretically exist from base or previous add, but handle defensively
                     console.warn(`Modified item ${modifiedFilename} in ${version} not found in history. Initializing.`);
                     itemHistory.set(modifiedFilename, [{ version: version, filename: modifiedFilename }]);
                }
            }

            // Additions
            for (const addedFilename of result.added) {
                const imagePath = `${BASE_PATH}/images/${version}/${addedFilename}`;
                currentImageState.set(addedFilename, { path: imagePath, versionTag: version });
                 // NEW: Initialize or add to history
                 if (!itemHistory.has(addedFilename)) {
                     itemHistory.set(addedFilename, [{ version: version, filename: addedFilename }]);
                 } else {
                      // Item was likely removed and is now being re-added. Append to history.
                      itemHistory.get(addedFilename).push({ version: version, filename: addedFilename });
                 }
            }

            // Removals (Conditional removal from current state)
             for (const removedFilename of result.removed) {
                 if (!showRemovedItems) {
                     // If hiding removed items, delete from the current effective state.
                     // If it gets added/modified later, it will be put back.
                     currentImageState.delete(removedFilename);
                 } else {
                     // If showing removed items, don't delete from state, just mark for styling.
                     markedAsRemoved.add(removedFilename);
                 }
                 // History doesn't track removals directly.
             }
             processedCount++;
        }

        // --- Final State Calculation ---
        console.log("Finalizing item list...");
        loadedImages = new Map(currentImageState); // Copy the final state reflecting removals if applicable
        allItems = Array.from(loadedImages.keys());

        // If hiding removed items, clear the styling set.
        // If showing them, keep the set so createItemElement can apply the style.
        if (!showRemovedItems) {
            markedAsRemoved.clear();
        }

        // --- Cleanup & Render ---
        setLoadingProgress('Sorting and rendering...', 95);
        selectedItems.forEach(item => { // Clear selection if selected item is no longer visible
            if (!allItems.includes(item)) {
                selectedItems.delete(item);
            }
        });

        // Initial sort and render
        filterAndRenderItems();
        updateSelectionControls(); // Update button states based on loaded items
        setLoadingProgress('Done!', 100);
        console.log(`Load complete. Total items for version ${currentVersion}: ${allItems.length}`);
        console.log(`Item History map size: ${itemHistory.size}`);

        // --- Log Cache Size --- 
        let totalCacheSizeBytes = 0;
        for (const blob of imageDataCache.values()) {
            totalCacheSizeBytes += blob.size;
        }
        const totalCacheSizeMB = (totalCacheSizeBytes / 1024 / 1024).toFixed(2);
        console.log(`Image Data Cache size: ${totalCacheSizeMB} MB (${imageDataCache.size} blobs)`);


    } catch (error) {
        console.error("Error processing version data:", error);
        setLoadingProgress(`Error: ${error.message}`, null, true);
        gallery.innerHTML = `<div class="no-results">Error loading item data for version ${targetVersion}.<br>(${error.message})<br>Try selecting a different version or refreshing.</div>`;
    } finally {
        setLoadingState(false);
        console.log("loadItemData finished.");
    }
}

function setLoadingProgress(text, percentage = null, isError = false) {
    if (progressText) progressText.textContent = text;
    if (progressBar && percentage !== null) {
        progressBar.style.width = `${percentage}%`;
        if (isError) {
            progressBar.classList.add('error');
        } else {
             progressBar.classList.remove('error');
        }
    }
     if (progressContainer && progressContainer.style.display !== 'block' && percentage !== null && percentage >= 0) {
        progressContainer.style.display = 'block';
    }
}

function sortItems(itemsToSort) {
    itemsToSort.sort((a, b) => {
        const nameA = formatItemName(a);
        const nameB = formatItemName(b);

        if (currentSort === 'version') {
            const versionA = loadedImages.get(a) || baseVersion;
            const versionB = loadedImages.get(b) || baseVersion;

             const comparison = compareVersions(versionB, versionA);
             if (comparison === 0) {
                  return nameA.localeCompare(nameB);
             }
             return comparison;
        } else if (currentSort === 'length') {
             const lengthDiff = nameB.length - nameA.length;
             if (lengthDiff === 0) {
                 return nameA.localeCompare(nameB);
             }
             return lengthDiff;
        } else {
            return currentSort === 'za' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
        }
    });
}

function filterItems(itemsToFilter, searchTerm) {
     if (!searchTerm) return itemsToFilter;
     const lowerTerm = searchTerm.toLowerCase();
     return itemsToFilter.filter(filename => formatItemName(filename).toLowerCase().includes(lowerTerm));
}

function filterAndRenderItems() {
    const searchTerm = searchInput.value;
    sortItems(allItems);
    displayedItems = filterItems(allItems, searchTerm);

    totalCountDisplay.textContent = `Total: ${allItems.length} items`;
    filteredCountDisplay.textContent = `Showing: ${displayedItems.length} items`;
    selectVisibleButton.style.display = searchTerm && displayedItems.length > 0 ? 'inline-block' : 'none';

    renderGallery(displayedItems);
    updateSelectionControls();
}

function renderGallery(itemsToRender) {
    gallery.innerHTML = '';

    if (itemsToRender.length === 0) {
        gallery.innerHTML = '<div class="no-results">No items found matching your criteria.</div>';
        return;
    }

    const initialBatch = itemsToRender.slice(0, RENDER_BATCH_SIZE);
    initialBatch.forEach(filename => gallery.appendChild(createItemElement(filename)));

    if (itemsToRender.length > RENDER_BATCH_SIZE) {
        setupLazyLoading(itemsToRender, RENDER_BATCH_SIZE);
    }
}

let observer = null;

function setupLazyLoading(items, startIndex) {
    if (observer) observer.disconnect();

    const sentinel = document.createElement('div');
    sentinel.className = 'loading sentinel';
    sentinel.textContent = 'Loading more items...';

    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && startIndex < items.length) {
            const end = Math.min(startIndex + RENDER_BATCH_SIZE, items.length);
            const batch = items.slice(startIndex, end);

            batch.forEach(filename => {
                 if (sentinel.parentNode) gallery.insertBefore(createItemElement(filename), sentinel);
                 else gallery.appendChild(createItemElement(filename));
            });

            startIndex = end;

            if (startIndex < items.length) gallery.appendChild(sentinel);
            else { sentinel.remove(); observer.disconnect(); observer = null; }
        }
    }, { root: gallery });

    if (startIndex < items.length) {
        gallery.appendChild(sentinel);
        observer.observe(sentinel);
    }
}

function createItemElement(filename) {
    const fragment = document.createDocumentFragment();
    const itemDiv = document.createElement('div');
    const displayName = formatItemName(filename);
    const itemVersion = loadedImages.get(filename) || '?';

    itemDiv.className = 'item';
    itemDiv.dataset.filename = filename;
    itemDiv.title = `Select/Deselect: ${displayName}\nFilename: ${filename}\nVersion: ${itemVersion}`;

    if (selectedItems.has(filename)) itemDiv.classList.add('selected');
    if (markedAsRemoved.has(filename)) itemDiv.classList.add('removed-item'); // Add class if marked as removed

    itemDiv.appendChild(createItemInfoButton(filename, displayName));
    itemDiv.appendChild(createItemImage(filename, displayName));
    itemDiv.appendChild(createNameElement(displayName));
    itemDiv.appendChild(createVersionBadge(filename));

    fragment.appendChild(itemDiv);
    return fragment;
}

function createItemInfoButton(filename, displayName) {
    const infoButton = document.createElement('button');
    infoButton.className = 'item-info-button';
    infoButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>`;
    infoButton.setAttribute('aria-label', `Details for ${displayName}`);
    infoButton.title = 'View Details';
    return infoButton;
}

function createItemImage(filename, displayName) {
    const img = document.createElement('img');
    img.alt = `Minecraft ${displayName} item texture`;
    img.loading = "lazy";

    // Get the definitive path and version from loadedImages
    const itemData = loadedImages.get(filename);
    const imagePath = itemData ? itemData.path : null;

    if (imagePath) {
        img.src = imagePath; // Use the direct path
    } else {
        console.warn(`Image path not found in loadedImages for: ${filename}`);
        img.src = `${BASE_PATH}/assets/missing.png`;
        img.alt += ' (Image path missing)';
    }

    img.onerror = function() {
        console.warn(`Image load failed for path: ${this.src}`);
        if (!this.src.endsWith('missing.png')) {
             this.src = `${BASE_PATH}/assets/missing.png`;
        }
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
    const itemData = loadedImages.get(filename);
    const itemVersion = itemData ? itemData.versionTag : '?'; // Get the versionTag property
    const versionBadge = document.createElement('span');
    versionBadge.className = 'item-version-badge';
    versionBadge.textContent = itemVersion;
    versionBadge.title = `Source Version: ${itemVersion}`;
    return versionBadge;
}

function formatItemName(filename) {
    if (itemNameCache.has(filename)) {
        return itemNameCache.get(filename);
    }

    const formattedName = filename.replace(/\.png$/i, '').replace(/_/g, ' ')
                           .replace(/\b\w/g, char => char.toUpperCase());

    itemNameCache.set(filename, formattedName);
    return formattedName;
}

function toggleItemSelection(itemElement, filename) {
    const wasSelected = selectedItems.has(filename);
    if (wasSelected) {
        selectedItems.delete(filename);
        itemElement?.classList.remove('selected');
    } else {
        selectedItems.add(filename);
        itemElement?.classList.add('selected');
    }
    updateSelectionControls();

    if (modal.style.display === 'block' && currentModalFilename === filename) {
        updateModalSelectButton();
    }
}

function clearSelection() {
    selectedItems.clear();
    gallery.querySelectorAll('.item.selected').forEach(el => {
        el.classList.remove('selected');
    });
    updateSelectionControls();

    if (modal.style.display === 'block' && currentModalFilename) {
        updateModalSelectButton();
    }
}

function selectVisibleItems() {
    const visibleItemElements = gallery.querySelectorAll('.item');
    visibleItemElements.forEach(el => {
        const filename = el.dataset.filename;
        if (filename && !selectedItems.has(filename)) {
            selectedItems.add(filename);
            el.classList.add('selected');
        }
    });
    updateSelectionControls();

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
        downloadAllButton.textContent = 'Download All as ZIP';
        downloadAllButton.disabled = displayedItems.length === 0;
    }
}

function handleDownloadClick() {
    // Decide whether to download selected or all visible
    if (selectedItems.size > 0) {
        downloadItemsAsZip(Array.from(selectedItems), `Minecraft_Items_${currentVersion}_Selected.zip`);
    } else {
        // Filter displayedItems to only include those currently loaded (handles showRemoved)
        const itemsToDownload = displayedItems.filter(item => loadedImages.has(item.filename));
        const filenamesToDownload = itemsToDownload.map(item => item.filename);
        downloadItemsAsZip(filenamesToDownload, `Minecraft_Items_${currentVersion}_AllVisible.zip`);
    }
}

// Modified to accept optional specific path and download filename
async function downloadSingleItem(baseFilename, specificImagePath = null, downloadFilename = null) {
    console.log(`Attempting to download single item: ${baseFilename}`);
    const itemData = loadedImages.get(baseFilename);
    const historyData = itemHistory.get(baseFilename);


    // Use provided path if available, otherwise use current loaded path
    const imagePath = specificImagePath || (itemData ? itemData.path : null);
    const finalDownloadFilename = downloadFilename || baseFilename; // Use suggested name or base filename


    if (!imagePath) {
         console.error(`No image path found for ${baseFilename}`);
         alert(`Could not find image data for ${baseFilename}.`);
         return;
     }


    try {
        setLoadingState(true); // Show progress indicator for fetch
        setLoadingProgress(`Fetching ${finalDownloadFilename}...`, 50);


        // Fetch the specific image directly
        const response = await fetch(imagePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch image ${imagePath}: ${response.statusText}`);
        }
        const blob = await response.blob();


        setLoadingProgress(`Saving ${finalDownloadFilename}...`, 90);
        saveAs(blob, finalDownloadFilename); // Use FileSaver.js
        setLoadingProgress('Download complete!', 100);


    } catch (error) {
        console.error(`Error downloading single item ${finalDownloadFilename}:`, error);
        alert(`Failed to download ${finalDownloadFilename}. Error: ${error.message}`);
        setLoadingProgress('Download failed.', null, true);
    } finally {
        setLoadingState(false);
    }
}

async function downloadItemsAsZip(items, zipFilename) {
    const zip = new JSZip();
    const downloadButton = document.getElementById('download-all');
    const originalText = downloadButton.textContent;
    setLoadingProgress('Preparing ZIP file...', 0);
    progressContainer.style.display = 'block';
    progressBar.classList.remove('error');

    console.log(`Starting ZIP creation for ${items.length} items.`);
    downloadButton.textContent = "Zipping files...";
    downloadButton.disabled = true;

    try {
        let addedCount = 0;
        items.forEach(filename => {
            const imageBlob = imageDataCache.get(filename);
            if (imageBlob) {
                try {
                    zip.file(filename, imageBlob);
                    addedCount++;
                } catch (zipError) {
                     console.error(`Error adding file ${filename} to zip:`, zipError);
                }
            } else {
                 console.warn(`Blob not found for ${filename} when creating ZIP. Skipping.`);
            }
        });

        if (addedCount === 0) {
             throw new Error("No valid image data found for selected items.");
        }

        console.log(`Added ${addedCount} files to ZIP. Generating blob...`);

        const zipBlob = await zip.generateAsync(
            { type: 'blob', streamFiles: true },
            (metadata) => {
                const percent = metadata.percent.toFixed(0);
                setLoadingProgress(`Zipping: ${percent}%`, percent);
            }
        );

        console.log(`ZIP Blob generated, size: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB.`);

        saveAs(zipBlob, zipFilename);
        setLoadingProgress('Done!', 100);

    } catch (error) {
        console.error('Error during ZIP creation process:', error);
        const shortError = error.message.length > 40 ? error.message.substring(0, 37) + '...' : error.message;
        setLoadingProgress(`Error: ${shortError}`, 100, true);
        alert(`There was an error creating the ZIP: ${error.message}`);
    } finally {
        console.log('Restoring download button state.');
        downloadButton.textContent = originalText;
        downloadButton.disabled = false;
        setTimeout(() => {
             if (progressContainer) progressContainer.style.display = 'none';
             if (progressBar) progressBar.classList.remove('error');
        }, 3000);
    }
}

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

function toggleInfoSection() {
    const isExpanded = toggleInfoButton.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
        infoSection.classList.remove('visible');
        toggleInfoButton.setAttribute('aria-expanded', 'false');
        toggleInfoButton.firstChild.textContent = ' Show Info / How to Use ';
    } else {
        infoSection.classList.add('visible');
        toggleInfoButton.setAttribute('aria-expanded', 'true');
        toggleInfoButton.firstChild.textContent = ' Hide Info / How to Use ';
    }
}

function openModal(filename) {
    console.log(`Opening modal for: ${filename}`);
    currentModalFilename = filename; // Track for selection logic
    const itemData = loadedImages.get(filename);
    const historyContainer = document.getElementById('modal-history-list');
    const historyEntries = itemHistory.get(filename) || []; // Get history, default to empty array


    if (!itemData || !historyContainer) {
        console.error(`Could not find item data or history container for ${filename}`);
        closeModal();
        return;
    }


    const displayName = formatItemName(filename);
    const currentImagePath = itemData.path; // Path for the currently selected version
    const currentVersionTag = itemData.versionTag; // Tag for the currently selected version


    modalItemName.textContent = displayName;
    modalFilename.textContent = filename; // Show the base filename
    modalImg.src = currentImagePath; // Show the current version's image
    modalImg.alt = displayName;
    modalVersion.textContent = currentVersionTag; // Keep showing the "Source" of the current texture


    // NEW: Populate history list
    historyContainer.innerHTML = ''; // Clear previous history
    if (historyEntries.length > 0) {
        // Reverse history to show newest first (optional, could keep chronological)
        historyEntries.slice().reverse().forEach(entry => {
            const historyItem = document.createElement('div');
            historyItem.className = 'modal-history-item';

            // Create container for text info (version + filename)
            const textInfoDiv = document.createElement('div');
            textInfoDiv.className = 'modal-history-text';

            const versionSpan = document.createElement('span');
            versionSpan.textContent = `Version ${entry.version}: `;
            textInfoDiv.appendChild(versionSpan);

            const filenameCode = document.createElement('code');
            filenameCode.textContent = entry.filename; // Display the specific filename for that version
            textInfoDiv.appendChild(filenameCode);

            historyItem.appendChild(textInfoDiv); // Add text info container

            // Create image element for history
            const historyImg = document.createElement('img');
            const historyImagePath = `${BASE_PATH}/images/${entry.version}/${entry.filename}`;
            historyImg.src = historyImagePath;
            historyImg.alt = `Texture from v${entry.version}`;
            historyImg.className = 'modal-history-image';
            historyImg.loading = 'lazy'; // Lazy load history images
            historyImg.onerror = function() { 
                this.alt = `Image missing for v${entry.version}`;
                this.src = `${BASE_PATH}/assets/missing.png`; // Fallback image
                this.onerror = null; 
            };
            historyItem.appendChild(historyImg); // Add image

            const downloadButton = document.createElement('button');
            downloadButton.textContent = 'Download';
            downloadButton.className = 'modal-history-download';
            downloadButton.onclick = () => {
                const historyImagePath = `${BASE_PATH}/images/${entry.version}/${entry.filename}`;
                downloadSingleItem(entry.filename, historyImagePath, `${displayName}_${entry.version}.png`); // Pass specific path and suggested filename
            };
            historyItem.appendChild(downloadButton);

            historyContainer.appendChild(historyItem);
        });
    } else {
        historyContainer.innerHTML = '<p>No history found (likely base version).</p>';
    }


    // Wire up the main download button to use the modified downloadSingleItem
    modalDownloadButton.onclick = () => {
        downloadSingleItem(currentModalFilename, currentImagePath, `${displayName}_${currentVersionTag}.png`);
    };

    updateModalSelectButton(); // Update select/deselect state
    modal.style.display = 'flex'; // Show modal
    modal.setAttribute('aria-hidden', 'false');


    // Focus management (optional but good for accessibility)
    modalCloseButton.focus();
}

function closeModal() {
    modal.style.display = 'none';
    currentModalFilename = null;
    if (modalImg.src && modalImg.src.startsWith('blob:')) {
        URL.revokeObjectURL(modalImg.src);
    }
    modalImg.src = "";
    modalDownloadButton.onclick = null;
    modalSelectButton.onclick = null;
}

function updateModalSelectButton() {
    if (!currentModalFilename) return;

    if (selectedItems.has(currentModalFilename)) {
        modalSelectButton.textContent = 'Deselect Item';
        modalSelectButton.style.backgroundColor = 'var(--muted-text)';
        modalSelectButton.style.color = 'var(--bg-color)';
    } else {
        modalSelectButton.textContent = 'Select Item';
        modalSelectButton.style.backgroundColor = 'var(--accent-color)';
        const theme = document.body.getAttribute('data-theme') || 'dark';
        modalSelectButton.style.color = theme === 'light' ? '#fff' : '#000';
    }
}

function handleGalleryClick(event) {
    const itemElement = event.target.closest('.item');
    if (!itemElement) return;

    const filename = itemElement.dataset.filename;
    if (!filename) return;

    if (event.target.closest('.item-info-button')) {
        openModal(filename);
    } else {
        toggleItemSelection(itemElement, filename);
    }
}

async function loadSupporters() {
    if (!supportersListDiv) return;

    try {
        const response = await fetch(`${BASE_PATH}/members.json?t=${Date.now()}`); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const supporterData = await response.json();

        if (!Array.isArray(supporterData)) {
            throw new Error('Invalid format: members.json should contain an array of objects.');
        }

        supportersListDiv.innerHTML = '';

        if (supporterData.length === 0) {
            supportersListDiv.innerHTML = '<p>No supporters listed currently.</p>';
            return;
        }

        supporterData.sort((a, b) => {
            const tierComparison = (b.tier ?? 0) - (a.tier ?? 0);
            if (tierComparison !== 0) return tierComparison;
            return a.name.localeCompare(b.name);
        });

        supporterData.forEach(supporter => {
            if (!supporter || typeof supporter.name !== 'string') {
                console.warn('Skipping invalid supporter entry:', supporter);
                return;
            }
            const nameElement = document.createElement('span');
            nameElement.className = 'supporter-name'; 
            const tier = supporter.tier ?? 0;
            nameElement.dataset.tier = tier; 
            nameElement.textContent = supporter.name;
            nameElement.title = supporter.name;
            supportersListDiv.appendChild(nameElement);
        });

    } catch (error) {
        console.error('Error loading supporters:', error);
        supportersListDiv.innerHTML = '<p>Could not load supporter list.</p>';
    }
}

// New function to initialize checkbox state from localStorage
function initializeShowRemovedState() {
    const savedState = localStorage.getItem('showRemovedItems');
    showRemovedItems = savedState === 'true';
    if (showRemovedToggle) {
        showRemovedToggle.checked = showRemovedItems;
    }
}

// New handler for the checkbox change
async function handleShowRemovedToggle(event) {
    showRemovedItems = event.target.checked;
    localStorage.setItem('showRemovedItems', showRemovedItems);
    console.log(`Show removed items toggled: ${showRemovedItems}`);
    // Reload data as the item list composition changes based on this flag
    await loadItemData();
}