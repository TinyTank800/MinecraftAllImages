# Item Gallery Exporter (standalone Fabric mod)

The **recommended** way to capture item images for [Minecraft Item Gallery](https://mcitemgallery.com).

A self-contained **Fabric** client mod that renders one transparent icon per item and writes
`manifest.json` / `hashes.json` / `changes.json` for the gallery packaging script.

- **Loader:** Fabric + Fabric API
- **Target:** Minecraft **1.21.1** (adjust `gradle.properties` for other 1.21.x if needed)
- **Output layout:** same as `../../scripts/package-version.mjs` expects

## Why use this mod?

Compared to the legacy Python screenshot pipeline, this mod:

- Renders icons **directly** (no window focus or `pyautogui`)
- Produces **true alpha** — including glass, ice, and other translucent items
- Writes gallery-ready manifests and auto-diffs against prior exports
- Powers the site's **Enhanced (v2)** image set (`--set v2` when packaging)

## Build

JDK 21+, then from this folder:

```bash
./gradlew build
```

Jar: `build/libs/itemgallery-exporter-<version>.jar` (not the `-sources` jar).

## Install & export

1. [Fabric Loader](https://fabricmc.net/use/installer/) for **1.21.1**
2. This mod + [Fabric API](https://modrinth.com/mod/fabric-api) in `mods/`
3. Join a world and run:

```
/itemgallery export 1.21.1
/itemgallery export 1.21.1 64       # icon size in px (default 32)
/itemgallery export 1.21.1 64 all   # all namespaces, not just vanilla
```

Output: `<minecraft>/gallery-export/1.21.1/` with PNGs, `manifest.json`, `hashes.json`, and
`changes.json` when a previous export exists.

### Variants (`variants`)

Capture every component variant (potions, light levels, tipped arrows, etc.):

```
/itemgallery variants 1.21.1 64
/itemgallery variants 1.21.1 64 all
```

Variant files use `name__<slug>__<hash>.png` when the variant has a distinct display name
(e.g. `potion__potion_of_healing__a1b2c3d4.png`), or `name__<hash>.png` when the slug would
duplicate the base item id. **`names.json`** maps every PNG to its full in-game hover label
(e.g. enchanted books as `Enchanted Book (Sharpness V, Unbreaking III)`).

### Particles (`dumptextures`)

Copy particle/fluid/block textures from resource packs:

```
/itemgallery dumptextures 1.21.1
/itemgallery dumptextures 1.21.1 particle
```

Output goes to `gallery-export/<version>/dumped/` (`.png` + `.png.mcmeta` when animated).
Package for the website with `npm run package-particles` — multi-frame particles become GIFs,
single-frame ones stay PNGs. See the gallery docs for details.

## Package for the website

From the **repository root**:

```bash
# Enhanced v2 set (recommended for mod exports)
npm run package-version -- --source "<minecraft>/gallery-export" --mc-version 1.21.1 --set v2

# Legacy v1 set (if replacing old screenshot-based version)
npm run package-version -- --source "<minecraft>/gallery-export" --mc-version 1.21.1
```

See [`../README.md`](../README.md) for the full pipeline and v1/v2 migration notes.

## How rendering works

Each item is drawn **twice** (black + white background). Per-pixel alpha and color are recovered so
translucent items render correctly — no color-key hacks. One item per frame; no OS screenshots.

## AI disclosure

Parts of this mod and its documentation were written with **AI-assisted coding tools** (e.g. Cursor).
The mod renders real in-game item icons — it does not use AI to generate textures.

See the root [README](../../README.md) for the full project disclosure.
