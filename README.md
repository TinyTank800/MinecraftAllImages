# Minecraft Item Gallery

A searchable, downloadable gallery of transparent Minecraft item images across Java Edition versions.

**Live site:** [mcitemgallery.com](https://mcitemgallery.com)

![Latest update](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/TinyTank800/MinecraftAllImages/main/version.json)

Built by [Okami Squadron](https://okamisquadron.com/) · MIT licensed · [GitHub](https://github.com/TinyTank800/MinecraftAllImages)

---

## Features

- **Comprehensive gallery** — item images from major Minecraft Java Edition versions
- **Legacy & enhanced images** — switch between original captures (v1) and sharper mod re-renders (v2)
- **Particle gallery** — [`/particles`](https://mcitemgallery.com/particles) with GIFs and frame PNG downloads
- **Search, categories, and sorting** — creative-tab-style filters and multiple sort modes
- **Version history & compare slider** — drag to compare textures across versions
- **Color palettes** — copy vanilla hex colors from any item
- **Share selection** — compact share links via `?sel=` or `?selc=`
- **Bulk & individual downloads** — ZIP selected or visible items, or single PNGs
- **Removed items archive** — [`/removed`](https://mcitemgallery.com/removed)
- **Per-item SEO pages** — `/items/diamond-sword` with ImageObject schema
- **Public CDN & docs** — [`/docs`](https://mcitemgallery.com/docs)
- **Dark/light mode** and responsive layout

## Image sets (v1 vs v2)

| Set | Location | Source |
| --- | --- | --- |
| **Legacy (v1)** | `public/images/` | Original screenshot-based pipeline — all versions today |
| **Enhanced (v2)** | `public/images-v2/` | [Standalone Fabric mod](generation/standalone-mod/) — higher quality, rolling out per version |

Users pick **Legacy (v1)** or **Enhanced (v2)** in the gallery. Each mode uses only its own version list and images — v2 does not mix in legacy PNGs.

Package v2 exports with:

```bash
node scripts/package-version.mjs --source "path/to/gallery-export" --version 1.21.1 --set v2
```

## Repository layout

| Path | Description |
| --- | --- |
| `src/` | Astro pages + React gallery UI |
| `public/` | Images, metadata, particles, static assets |
| `scripts/` | `package-version`, `package-particles`, `enrich-metadata` |
| [`generation/standalone-mod/`](generation/standalone-mod/) | **Fabric mod (recommended)** — `/itemgallery export` |
| [`generation/MinecraftItemPipeline.py`](generation/MinecraftItemPipeline.py) | Legacy Python screenshot pipeline (v1 only) |

## How it works

The gallery loads a **base version** ZIP, then applies incremental `changes.json` for each newer version. Legacy and enhanced sets are independent catalogs under `public/images/` and `public/images-v2/`.

See [`generation/README.md`](generation/README.md) for exporting and [`minecraft-item-gallery/README.md`](minecraft-item-gallery/README.md) for the web app.

## Local development

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Packaging a new version

After `/itemgallery export` in-game:

```bash
# Enhanced (recommended for mod output)
node scripts/package-version.mjs --source "path/to/gallery-export" --version 1.21.1 --set v2

# Legacy v1 tree (default)
node scripts/package-version.mjs --source "path/to/gallery-export" --version 1.21.7

npm run enrich-metadata
```

Particles (separate from item ZIPs):

```bash
node scripts/package-particles.mjs --source "path/to/gallery-export" --version 1.21.1
```

See [`generation/README.md`](generation/README.md) for the full export pipeline.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Astro dev server |
| `npm run build` | Production static build → `dist/` |
| `npm run package-version` | Package mod export into `public/images/` or `public/images-v2/` |
| `npm run package-particles` | Package particle dumps into `public/particles/` |
| `npm run enrich-metadata` | Regenerate SEO metadata and palettes |

## Public CDN

```
GET https://mcitemgallery.com/images/versions.json
GET https://mcitemgallery.com/images-v2/versions.json
GET https://mcitemgallery.com/images/{version}/{item}.png
GET https://mcitemgallery.com/images-v2/{version}/{item}.png
GET https://mcitemgallery.com/particles/{version}/{particle}.gif
```

Full details: [mcitemgallery.com/docs](https://mcitemgallery.com/docs)

## License

MIT License.

## Feedback

- **GitHub Issues:** [MinecraftAllImages](https://github.com/TinyTank800/MinecraftAllImages/issues)
- **Discord:** [Okami Squadron](https://discord.oksqd.com)

## AI disclosure

Parts of this repository were developed with **AI-assisted coding tools**. **Item images are not AI-generated** — they are captured in-game with the Fabric export mod in [`generation/standalone-mod/`](generation/standalone-mod/).

*Not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang AB.*
