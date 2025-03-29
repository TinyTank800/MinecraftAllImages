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

// Store releases data
let releases = [];

// Store current version and ZIP contents
let currentVersion = 'latest';
let currentZipContents = null;

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

// Function to load releases from releases folder
async function loadReleases() {
    try {
        // Update version selector
        const versionSelect = document.getElementById('version-select');
        versionSelect.innerHTML = ''; // Clear existing options
        
        // Add latest version option
        const latestOption = document.createElement('option');
        latestOption.value = 'latest';
        latestOption.textContent = 'Latest Version';
        versionSelect.appendChild(latestOption);
        
        // Try to find available versions by checking ZIP files
        const versions = new Set();
        
        // Check for ZIP files in the releases folder using GitHub API
        try {
            const response = await fetch('https://api.github.com/repos/TinyTank800/MinecraftAllImages/contents/releases');
            if (!response.ok) {
                throw new Error(`Failed to fetch releases: ${response.status}`);
            }
            
            const files = await response.json();
            files.forEach(file => {
                if (file.name.includes('minecraft-items-') && file.name.endsWith('.zip')) {
                    // Extract version from filename
                    const version = file.name.split('minecraft-items-')[1].replace('.zip', '');
                    versions.add(version);
                }
            });
        } catch (e) {
            console.warn('Could not scan releases folder:', e);
        }
        
        // Add found versions to the selector
        Array.from(versions).sort().reverse().forEach(version => {
            const option = document.createElement('option');
            option.value = version;
            option.textContent = `${version}`;
            versionSelect.appendChild(option);
        });
        
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
        
    } catch (error) {
        console.error('Error loading releases:', error);
        // Show error in UI
        const versionSelect = document.getElementById('version-select');
        versionSelect.innerHTML = `
            <option value="latest">Latest Version</option>
            <option value="1.21.4">1.21.4</option>
        `;
        versionSelect.disabled = true;
        
        // Show error message to user
        const repoInfo = document.getElementById('repo-info');
        repoInfo.innerHTML = `
            <span style="color: #ff6b6b;">
                Warning: Unable to load version list. Using default options.
            </span>
        `;
    }
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
    
    if (selectedVersion === 'latest') {
        // Load latest version from manifest
        await loadImagesFromManifest();
    } else {
        try {
            // Get the download URL from GitHub API
            const response = await fetch(`https://api.github.com/repos/TinyTank800/MinecraftAllImages/contents/releases/minecraft-items-${selectedVersion}.zip`);
            if (!response.ok) {
                throw new Error(`Failed to get version info: ${response.status}`);
            }
            
            const fileInfo = await response.json();
            const downloadUrl = fileInfo.download_url;
            
            // Download the ZIP file
            const zipResponse = await fetch(downloadUrl);
            if (!zipResponse.ok) {
                throw new Error(`Failed to download version: ${zipResponse.status}`);
            }
            
            const blob = await zipResponse.blob();
            const zip = new JSZip();
            currentZipContents = await zip.loadAsync(blob);
            
            // Extract image files and sort them alphabetically
            allItems = [];
            for (const [filename, file] of Object.entries(currentZipContents.files)) {
                if (filename.toLowerCase().endsWith('.png')) {
                    allItems.push(filename);
                }
            }
            
            // Sort items alphabetically
            allItems.sort((a, b) => a.localeCompare(b));
            
            if (allItems.length === 0) {
                throw new Error('No PNG images found in the version ZIP file');
            }
            
            // Update UI
            document.getElementById('repo-info').textContent = 
                `Displaying ${allItems.length} items from version ${selectedVersion}`;
            document.getElementById('total-count').textContent = `Total: ${allItems.length} items`;
            
            // Display items
            filterItems();
            
        } catch (error) {
            console.error('Error loading version:', error);
            gallery.innerHTML = `
                <div class="no-results">
                    <p>Error loading version ${selectedVersion}:</p>
                    <p>${error.message}</p>
                    <p>Please try again or contact support if the issue persists.</p>
                </div>
            `;
        }
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
    
    // Set image source based on current version
    if (currentVersion === 'latest') {
        img.src = `${BASE_PATH}/images/${filename}`;
    } else if (currentZipContents && currentZipContents[filename]) {
        // Create a blob URL from the ZIP contents
        currentZipContents[filename].async('blob').then(blob => {
            const url = URL.createObjectURL(blob);
            img.src = url;
            // Clean up the URL when the image is loaded
            img.onload = () => URL.revokeObjectURL(url);
        });
    }
    
    img.alt = displayName;
    img.loading = "lazy"; // Enable lazy loading for better performance
    
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
async function downloadImage(filename) {
    if (currentVersion === 'latest') {
        const link = document.createElement('a');
        link.href = `${BASE_PATH}/images/${filename}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else if (currentZipContents && currentZipContents[filename]) {
        try {
            // Get the file from ZIP
            const file = currentZipContents[filename];
            const blob = await file.async('blob');
            const url = URL.createObjectURL(blob);
            
            // Create download link
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Error downloading file. Please try again.');
        }
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
        if (currentVersion === 'latest') {
            // Fetch each image and add to ZIP
            items.forEach(filename => {
                const promise = fetch(`${BASE_PATH}/images/${filename}`)
                    .then(response => response.blob())
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
            });
        } else if (currentZipContents) {
            // Copy files from current ZIP
            items.forEach(filename => {
                if (currentZipContents[filename]) {
                    const promise = currentZipContents[filename].async('blob')
                        .then(blob => {
                            zip.file(filename, blob);
                            completed++;
                            const progress = Math.round((completed / items.length) * 100);
                            progressBar.style.width = `${progress}%`;
                        })
                        .catch(error => {
                            console.error(`Error processing ${filename}:`, error);
                            completed++;
                            const progress = Math.round((completed / items.length) * 100);
                            progressBar.style.width = `${progress}%`;
                        });
                    
                    promises.push(promise);
                }
            });
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

// Function to load images from manifest.json file
async function loadImagesFromManifest() {
    try {
        // Show loading message
        const gallery = document.getElementById('gallery');
        gallery.innerHTML = '<div class="loading">Loading items from manifest...</div>';
        
        document.getElementById('repo-info').textContent = `Loading items from manifest.json...`;
        
        // Initialize allItems array
        allItems = [];
        
        try {
            // Fetch the manifest file
            const manifestResponse = await fetch(`${BASE_PATH}/manifest.json`); // Using base path
            if (!manifestResponse.ok) {
                throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`);
            }
            
            const manifest = await manifestResponse.json();
            allItems = manifest.images || [];
            
            if (allItems.length === 0) {
                throw new Error('No images found in manifest');
            }
            
            // Update repository info
            document.getElementById('repo-info').textContent = 
                `Displaying ${allItems.length} items from manifest`;
            
            // Update stats
            document.getElementById('total-count').textContent = `Total: ${allItems.length} items`;
            
            // Display the items
            filterItems();
            
        } catch (error) {
            console.error('Error loading manifest:', error);
            
            gallery.innerHTML = `
                <div class="no-results">
                    <p>Unable to load images. Please ensure:</p>
                    <p>1. You've placed a manifest.json file in your repository root with your image filenames.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading image filenames:', error);
        document.getElementById('gallery').innerHTML = `
            <div class="no-results">
                Error loading images: ${error.message}
            </div>
        `;
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
    
    // Load releases first
    loadReleases().then(() => {
        // Then load images based on selected version
        const versionSelect = document.getElementById('version-select');
        if (versionSelect.value === 'latest') {
            loadImagesFromManifest();
        } else {
            handleVersionChange({ target: versionSelect });
        }
    });
    
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