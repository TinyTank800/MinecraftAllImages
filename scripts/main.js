// Initialize empty array for our items
let allItems = [];

// Track selected items
let selectedItems = new Set();

// Batch size for rendering items (for performance)
const RENDER_BATCH_SIZE = 100;

// Base path for assets (empty for local, '/MinecraftAllImages' for GitHub Pages)
const BASE_PATH = window.location.pathname.includes('/MinecraftAllImages/') 
    ? '/MinecraftAllImages' 
    : '';

// Store versions information
let availableVersions = [];
let baseVersion = '1.21.4'; // Default base version
let currentVersion = 'latest';
let loadedImages = new Map(); // Map to track which version each image comes from

// Get script version from URL
const scriptTag = document.querySelector('script[src*="main.js"]');
const scriptVersion = scriptTag ? scriptTag.src.split('v=')[1] : 'unknown';

// Add version indicator to UI
const versionIndicator = document.createElement('div');
versionIndicator.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: var(--card-bg);
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-color);
    opacity: 0.7;
    z-index: 1000;
`;
versionIndicator.textContent = `Script v${scriptVersion}`;
document.body.appendChild(versionIndicator);

// Log version for debugging
console.log(`MinecraftAllImages Gallery Script Version: ${scriptVersion}`);

// Function to load available versions
async function loadVersions() {
    try {
        // Update version selector
        const versionSelect = document.getElementById('version-select');
        versionSelect.innerHTML = ''; // Clear existing options
        
        // Add latest version option
        const latestOption = document.createElement('option');
        latestOption.value = 'latest';
        latestOption.textContent = 'Latest Version';
        versionSelect.appendChild(latestOption);
        
        // Try to find available versions by checking version folders
        try {
            const response = await fetch(`${BASE_PATH}/images`);
            if (!response.ok) {
                throw new Error(`Failed to fetch versions: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Filter for version folders (exclude base folder)
            availableVersions = data
                .filter(item => item.type === 'dir' && item.name !== 'base')
                .map(item => item.name)
                .sort((a, b) => compareVersions(b, a)); // Sort in descending order
            
            console.log('Available versions:', availableVersions);
            
            // Add versions to selector
            availableVersions.forEach(version => {
                const option = document.createElement('option');
                option.value = version;
                option.textContent = version;
                versionSelect.appendChild(option);
            });
            
        } catch (e) {
            console.warn('Could not scan versions folder:', e);
            // Fallback to hardcoded versions
            const hardcodedVersions = ['1.21.5', '1.21.4'];
            hardcodedVersions.forEach(version => {
                availableVersions.push(version);
                const option = document.createElement('option');
                option.value = version;
                option.textContent = version;
                versionSelect.appendChild(option);
            });
        }
        
        // Set initial version from URL parameter or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const versionParam = urlParams.get('version');
        if (versionParam) {
            versionSelect.value = versionParam;
        } else {
            const savedVersion = localStorage.getItem('selectedVersion');
            if (savedVersion) {
                versionSelect.value = savedVersion;
            }
        }
        
        // Handle version change
        versionSelect.addEventListener('change', handleVersionChange);
        
        // Load initial version
        handleVersionChange({ target: versionSelect });
        
    } catch (error) {
        console.error('Error loading versions:', error);
        // Show error in UI
        document.getElementById('repo-info').innerHTML = `
            <span style="color: #ff6b6b;">
                Warning: Unable to load version list. Using default options.
            </span>
        `;
    }
}

// Helper function to compare version numbers
function compareVersions(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) {
            return aVal - bVal;
        }
    }
    
    return 0;
}

// Function to handle version change
async function handleVersionChange(event) {
    const selectedVersion = event.target.value;
    currentVersion = selectedVersion;
    
    // Save selection to localStorage
    localStorage.setItem('selectedVersion', selectedVersion);
    
    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('version', selectedVersion);
    window.history.pushState({}, '', url);
    
    // Show loading state
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '<div class="loading">Loading version...</div>';
    
    try {
        // Reset tracking
        loadedImages.clear();
        allItems = [];
        
        // Load base images first
        await loadBaseImages();
        
        // Load version-specific changes
        if (selectedVersion === 'latest') {
            // For latest, load all versions in sequence
            const sortedVersions = [...availableVersions].sort((a, b) => compareVersions(a, b));
            for (const version of sortedVersions) {
                await loadVersionChanges(version);
            }
        } else {
            // For specific version, load changes up to and including selected version
            const sortedVersions = [...availableVersions]
                .filter(v => compareVersions(v, selectedVersion) <= 0)
                .sort((a, b) => compareVersions(a, b));
                
            for (const version of sortedVersions) {
                await loadVersionChanges(version);
                if (version === selectedVersion) break;
            }
        }
        
        // Sort items alphabetically
        allItems.sort((a, b) => a.localeCompare(b));
        
        // Update UI
        document.getElementById('repo-info').textContent = 
            `Displaying ${allItems.length} items ${selectedVersion === 'latest' ? 'from latest version' : `from version ${selectedVersion}`}`;
        document.getElementById('total-count').textContent = `Total: ${allItems.length} items`;
        
        // Display items
        filterItems();
        
    } catch (error) {
        console.error(`Error loading version ${selectedVersion}:`, error);
        gallery.innerHTML = `
            <div class="no-results">
                <p>Error loading version ${selectedVersion}:</p>
                <p>${error.message}</p>
                <p>Please try again or contact support if the issue persists.</p>
            </div>
        `;
    }
}

// Function to load base images
async function loadBaseImages() {
    try {
        console.log('Loading base images...');
        const response = await fetch(`${BASE_PATH}/images/base/manifest.json`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch base manifest: ${response.status}`);
        }
        
        const manifest = await response.json();
        const baseImages = manifest.images || [];
        
        // Add all base images to our list and track their source
        baseImages.forEach(image => {
            allItems.push(image);
            loadedImages.set(image, 'base');
        });
        
        console.log(`Loaded ${baseImages.length} base images`);
    } catch (error) {
        console.error('Error loading base images:', error);
        throw error;
    }
}

// Function to load version-specific changes
async function loadVersionChanges(version) {
    try {
        console.log(`Loading changes for version ${version}...`);
        const response = await fetch(`${BASE_PATH}/images/${version}/changes.json`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch changes for ${version}: ${response.status}`);
        }
        
        const changes = await response.json();
        
        // Apply changes to our item list
        
        // Handle added items
        for (const addedItem of changes.added || []) {
            if (!allItems.includes(addedItem)) {
                allItems.push(addedItem);
            }
            loadedImages.set(addedItem, version);
        }
        
        // Handle modified items (update their source)
        for (const modifiedItem of changes.modified || []) {
            if (!allItems.includes(modifiedItem)) {
                allItems.push(modifiedItem);
            }
            loadedImages.set(modifiedItem, version);
        }
        
        // Handle removed items
        for (const removedItem of changes.removed || []) {
            const index = allItems.indexOf(removedItem);
            if (index !== -1) {
                allItems.splice(index, 1);
            }
            loadedImages.delete(removedItem);
        }
        
        console.log(`Applied changes for version ${version}: +${changes.added.length} ~${changes.modified.length} -${changes.removed.length}`);
    } catch (error) {
        console.error(`Error loading changes for ${version}:`, error);
        // Don't throw here - we want to continue if one version fails
        console.warn(`Skipping version ${version} due to error`);
    }
}

// Format the displayed name (remove file extension and replace underscores with spaces)
function formatItemName(filename) {
    return filename.replace('.png', '').replace(/_/g, ' ');
}

// Create HTML for a single item
function createItemElement(filename) {
    const displayName = formatItemName(filename);
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item';
    itemDiv.dataset.filename = filename;
    
    // If this item is in the selected set, add the selected class
    if (selectedItems.has(filename)) {
        itemDiv.classList.add('selected');
    }
    
    const img = document.createElement('img');
    
    // Get version this image comes from
    const imageVersion = loadedImages.get(filename);
    
    // Set image source based on version
    if (imageVersion === 'base') {
        img.src = `${BASE_PATH}/images/base/${filename}`;
    } else {
        img.src = `${BASE_PATH}/images/${imageVersion}/${filename}`;
    }
    
    img.alt = displayName;
    img.loading = "lazy"; // Enable lazy loading for better performance
    
    // Add error handling for broken images
    img.onerror = function() {
        console.warn(`Image not found: ${filename} from version ${imageVersion}`);
        this.src = `${BASE_PATH}/assets/missing.png`; // Fallback image
    };
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'item-name';
    nameDiv.textContent = displayName;
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'download-button';
    downloadButton.textContent = 'Download';
    downloadButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent item selection when clicking download
        downloadImage(filename);
    });
    
    // Add click handler for selection
    itemDiv.addEventListener('click', () => {
        toggleItemSelection(itemDiv, filename);
    });
    
    itemDiv.appendChild(img);
    itemDiv.appendChild(nameDiv);
    itemDiv.appendChild(downloadButton);
    
    return itemDiv;
}

// Toggle item selection
function toggleItemSelection(itemElement, filename) {
    if (selectedItems.has(filename)) {
        selectedItems.delete(filename);
        itemElement.classList.remove('selected');
    } else {
        selectedItems.add(filename);
        itemElement.classList.add('selected');
    }
    
    // Update download button text
    updateDownloadButton();
}

// Update the download button text based on selection state
function updateDownloadButton() {
    const downloadButton = document.getElementById('download-all');
    const clearButton = document.getElementById('clear-selection');
    
    if (selectedItems.size > 0) {
        downloadButton.textContent = `Download Selected (${selectedItems.size}) as ZIP`;
        clearButton.style.display = 'inline-block';
    } else {
        downloadButton.textContent = 'Download All as ZIP';
        clearButton.style.display = 'none';
    }
}

// Clear all selected items
function clearSelection() {
    selectedItems.clear();
    
    // Remove selected class from all items
    document.querySelectorAll('.item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    updateDownloadButton();
}

// Function to download a single image
function downloadImage(filename) {
    const imageVersion = loadedImages.get(filename);
    let imageUrl;
    
    if (imageVersion === 'base') {
        imageUrl = `${BASE_PATH}/images/base/${filename}`;
    } else {
        imageUrl = `${BASE_PATH}/images/${imageVersion}/${filename}`;
    }
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Filter and display items based on search input
function filterItems() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const gallery = document.getElementById('gallery');
    
    // Clear the gallery
    gallery.innerHTML = '';
    
    // Filter items based on search term
    const filteredItems = allItems.filter(item => 
        formatItemName(item).toLowerCase().includes(searchTerm)
    );
    
    // Update stats
    document.getElementById('total-count').textContent = `Total: ${allItems.length} items`;
    document.getElementById('filtered-count').textContent = `Showing: ${filteredItems.length} items`;
    
    // Display filtered items or a message if no results
    if (filteredItems.length > 0) {
        // Only render the first batch initially for performance with large datasets
        const initialBatch = filteredItems.slice(0, RENDER_BATCH_SIZE);
        
        initialBatch.forEach(item => {
            gallery.appendChild(createItemElement(item));
        });
        
        // If there are more items, set up lazy loading for the rest
        if (filteredItems.length > RENDER_BATCH_SIZE) {
            setupLazyLoading(gallery, filteredItems, RENDER_BATCH_SIZE);
        }
    } else {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = 'No items found. Try a different search term.';
        gallery.appendChild(noResults);
    }
}

// Set up lazy loading for large item sets
function setupLazyLoading(container, items, startIndex) {
    // Create an intersection observer
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && startIndex < items.length) {
            // Load next batch
            const endIndex = Math.min(startIndex + RENDER_BATCH_SIZE, items.length);
            const nextBatch = items.slice(startIndex, endIndex);
            
            // Remove the loading sentinel
            const loadingSentinel = entries[0].target;
            container.removeChild(loadingSentinel);
            
            nextBatch.forEach(item => {
                container.appendChild(createItemElement(item));
            });
            
            // Update the start index for the next batch and add new sentinel
            // only if there are more items to load
            if (endIndex < items.length) {
                setupLazyLoading(container, items, endIndex);
            }
            
            // Stop observing current target
            observer.disconnect();
        }
    });
    
    // Add a sentinel element to observe
    if (startIndex < items.length) {
        const sentinel = document.createElement('div');
        sentinel.className = 'loading';
        sentinel.textContent = 'Loading more items...';
        container.appendChild(sentinel);
        
        // Start observing
        observer.observe(sentinel);
    }
}

// Function to download all filtered images as a ZIP
async function downloadAllAsZip(items) {
    const zip = new JSZip();
    const promises = [];
    
    // Add loading state
    const downloadAllButton = document.getElementById('download-all');
    const originalText = downloadAllButton.textContent;
    downloadAllButton.textContent = "Preparing ZIP...";
    downloadAllButton.disabled = true;
    
    // Show progress
    const progressContainer = document.getElementById('loading-progress');
    const progressBar = document.getElementById('progress-bar');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    
    let completed = 0;
    
    try {
        // Fetch each image and add to ZIP
        for (const filename of items) {
            const imageVersion = loadedImages.get(filename);
            let imageUrl;
            
            if (imageVersion === 'base') {
                imageUrl = `${BASE_PATH}/images/base/${filename}`;
            } else {
                imageUrl = `${BASE_PATH}/images/${imageVersion}/${filename}`;
            }
            
            const promise = fetch(imageUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${filename}: ${response.status}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    zip.file(filename, blob);
                    completed++;
                    const progress = Math.round((completed / items.length) * 100);
                    progressBar.style.width = `${progress}%`;
                })
                .catch(error => {
                    console.error(`Error fetching ${filename}:`, error);
                    completed++;
                    const progress = Math.round((completed / items.length) * 100);
                    progressBar.style.width = `${progress}%`;
                });
                
            promises.push(promise);
        }
        
        await Promise.all(promises);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `minecraft-items-${currentVersion}.zip`);
    } catch (error) {
        console.error('Error creating ZIP:', error);
        alert('There was an error creating the ZIP file. Please try again.');
    } finally {
        // Restore button state
        downloadAllButton.textContent = originalText;
        downloadAllButton.disabled = false;
        progressContainer.style.display = 'none';
    }
}

// Theme toggle functionality
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Initialize the gallery
document.addEventListener('DOMContentLoaded', () => {
    // Set theme from localStorage if available
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
    }
    
    // Set up theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Load versions
    loadVersions();
    
    // Set up search functionality
    document.getElementById('search-input').addEventListener('input', filterItems);
    
    // Set up download all/selected functionality
    document.getElementById('download-all').addEventListener('click', () => {
        // If we have items selected, use those
        if (selectedItems.size > 0) {
            downloadAllAsZip([...selectedItems]);
        } else {
            // Otherwise use the current filtered items
            const searchTerm = document.getElementById('search-input').value.toLowerCase();
            const filteredItems = allItems.filter(item => 
                formatItemName(item).toLowerCase().includes(searchTerm)
            );
            
            if (filteredItems.length > 0) {
                downloadAllAsZip(filteredItems);
            } else {
                alert('No items to download. Please adjust your search.');
            }
        }
    });
    
    // Set up clear selection button
    document.getElementById('clear-selection').addEventListener('click', clearSelection);
    
    // Set up back to top button
    const backToTopButton = document.getElementById('back-to-top');
    const gallery = document.getElementById('gallery');
    
    // Show back to top button when scrolled down
    gallery.addEventListener('scroll', () => {
        if (gallery.scrollTop > 500) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });
    
    // Scroll to top when clicked
    backToTopButton.addEventListener('click', () => {
        gallery.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});