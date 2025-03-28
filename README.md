# Minecraft Item Gallery

A searchable, downloadable gallery of Minecraft item images captured from the in-game hotbar.

![Version](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/TinyTank800/MinecraftAllImages/main/version.json)

---

## 🔧 Features

- 🔍 **Search** - Quickly find items by name
- 📥 **Download** - Get individual items or download all as a ZIP
- 🔄 **Automatic Updates** - Gallery automatically displays new images when added to the repository
- 📱 **Responsive Design** - Works on desktop and mobile devices

## About This Project

This gallery showcases Minecraft item images that have been captured from the in-game hotbar and formatted consistently. The images are ideal for:

- Wiki projects
- Minecraft guides
- Educational materials
- Resource packs
- Server websites

---

## 🛠️ How It Works

The gallery website uses the GitHub API to dynamically fetch all images from the repository's `images` folder. When a user visits the site, it:

1. Detects your GitHub username and repository from the URL
2. Queries the GitHub API to get a list of all images in the repository
3. Renders them in a responsive, searchable grid
4. Provides download functionality for individual images or all images as a ZIP

---

## 📂 Using This Template

### For Your Own Minecraft Item Gallery

1. Fork this repository
2. Replace the images in the `images` folder with your own Minecraft item screenshots
3. Enable GitHub Pages in your repository settings
4. Your gallery will be available at `https://[your-username].github.io/[repository-name]/`

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