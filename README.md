# Minecraft Item Gallery

A searchable, downloadable gallery of Minecraft item images captured from the in-game hotbar.

![Version](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/TinyTank800/MinecraftAllImages/main/version.json)

---

## 🔧 Features

- 🌍 **Comprehensive Gallery:** Access item images from virtually *all* major Minecraft Java Edition versions.
- 🔎 **Easy Search & Filter:** Quickly find items by name and filter by specific game versions.
- 📊 **Flexible Sorting:** Sort items alphabetically (A-Z, Z-A), by version (approximated newest first), or by name length.
- 📦 **Bulk Downloads:** Select multiple items and download them as a single ZIP archive, or download all items for the selected version.
- 💾 **Individual Downloads:** Download specific item images directly from the gallery or the details modal.
- 📜 **Item Version History:** View how an item's texture changed across different Minecraft versions directly in the item details modal, with previews and individual downloads.
- 👻 **Show Removed Items:** Option to display items that are no longer present in the selected version (useful for historical comparison).
- ⚡ **Client-Side Caching:** Efficiently caches downloaded ZIP data in the browser (using Cache Storage API) to speed up subsequent downloads.
- 🔗 **Direct Linking:** Share links that open the gallery to a specific version view.
- 🌓 **Dark/Light Mode:** Choose your preferred theme.
- 📱 **Responsive Design:** Works seamlessly on desktop and mobile devices.
- 🙏 **Supporter Recognition:** Features a section acknowledging project supporters.
- ⚙️ **Pure JS/CSS/HTML:** No frameworks needed, keeping it lightweight.

## About This Project

This gallery showcases Minecraft item images that have been captured from the in-game hotbar and formatted consistently. The images are ideal for:

- Wiki projects
- Minecraft guides
- Educational materials
- Resource packs
- Server websites

---

## 🛠️ How It Works

The gallery loads a base set of images defined in `manifest.json`. It then intelligently applies version-specific changes (additions, modifications, removals) tracked in `changes.json` files for the selected Minecraft version. This ensures you see the correct textures for that particular version or the most recent ones if "Latest" is chosen.

To optimize loading and download speeds, the site heavily utilizes browser caching, including the Cache Storage API, to store images locally after they are first loaded.

---

## 📂 Project Structure

This section details the main components of the project:

- `index.html`: The main page structure.
- `styles/`: Contains CSS for styling.
- `scripts/`: Contains the JavaScript for functionality (search, sort, download, caching, versioning).
- `images/`: Stores the actual Minecraft item images.
- `manifest.json`: Defines the base set of items and their initial image files.
- `changes.json`: Located in version-specific directories (e.g., `1.20.1/changes.json`), these files track item additions, removals, or texture updates compared to the base manifest.
- `versions.json`: Lists the available Minecraft versions for the dropdown selector.

### Requirements

- Minecraft item images should be placed in the `images` folder
- Images should have clear, descriptive filenames (e.g., `diamond_sword.png`, `oak_planks.png`)
- Use underscores instead of spaces in filenames for best search results

## Creating Your Own Item Screenshots

I created these screenshots using a custom script that:

1. Takes screenshots of items in the Minecraft hotbar
2. Crops them to a consistent size
3. Applies formatting for a clean appearance

If you're interested in creating your own item gallery:

1. Set up Minecraft with a resource pack that provides clear item visuals
2. Place each item in the hotbar and capture screenshots
3. Process the images to ensure consistent sizing and formatting
4. Name files clearly using the item's name (e.g., `diamond_sword.png`)

## Technical Details

The gallery is built using:

- Plain HTML, CSS, and JavaScript (no frameworks)
- JSZip and FileSaver.js for creating and downloading ZIP files
- The Cache Storage API for optimized image fetching and storage, enhancing download performance.

## License

This project is available under the MIT License. Feel free to use, modify, and distribute it as needed.

## Acknowledgments

- Thanks to Mojang for creating Minecraft
- JSZip and FileSaver.js libraries for download functionality

---

## 📢 Feedback & Support
*Found a bug or missing feature?* Let us know!  
🐙 **GitHub Issues**: [Main Repo](https://github.com/TinyTank800/MinecraftAllImages/issues)  
💬 **Discord**: [Join The Jemsire Community](https://discord.jemsire.com)  

---

*Note: This project is not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang AB.*
