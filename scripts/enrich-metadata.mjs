#!/usr/bin/env node
/**
 * Builds metadata JSON files from packaged gallery data:
 *   public/metadata/items-index.json
 *   public/metadata/categories.json
 *   public/metadata/removed-archive.json
 *   public/metadata/palettes.json  (when PNGs exist on disk)
 *
 * Run after package-version.mjs or standalone:
 *   node scripts/enrich-metadata.mjs
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const galleryRoot = path.resolve(__dirname, '..');
const imagesDir = path.join(galleryRoot, 'public', 'images');
const metaDir = path.join(galleryRoot, 'public', 'metadata');

function compareVersions(a, b) {
	const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
	const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const d = (pa[i] || 0) - (pb[i] || 0);
		if (d !== 0) return d;
	}
	return 0;
}

function filenameToSlug(filename) {
	return filename.replace(/\.png$/i, '').replace(/_/g, '-');
}

function formatDisplayName(filename, names = {}) {
	if (names[filename]) return names[filename];
	const withExt = filename.endsWith('.png') ? filename : `${filename}.png`;
	if (names[withExt]) return names[withExt];

	let base = filename.replace(/\.png$/i, '');
	const withSlug = base.match(/^(.+)__([a-z0-9][a-z0-9_]*)__([a-f0-9]{8})$/i);
	if (withSlug && withSlug[2] !== withSlug[1]) {
		return withSlug[2]
			.split('_')
			.filter(Boolean)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join(' ');
	}
	const hashOnly = base.match(/^(.+)__([a-f0-9]{8})$/i);
	if (hashOnly) {
		return formatDisplayName(`${hashOnly[1]}.png`, names);
	}
	return base
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function collectItemNames(publicRoot) {
	const merged = {};
	const root = path.join(galleryRoot, 'public', publicRoot);
	const versionsPath = path.join(root, 'versions.json');
	if (!(await exists(versionsPath))) return merged;
	const { versions } = await readJson(versionsPath);
	for (const v of [...versions].sort(compareVersions)) {
		const namesPath = path.join(root, v, 'names.json');
		if (await exists(namesPath)) {
			Object.assign(merged, await readJson(namesPath));
		}
	}
	return merged;
}

function categorizeItem(filename) {
	const base = filename.replace(/\.png$/i, '').toLowerCase();
	if (base.endsWith('_spawn_egg')) return 'spawn_eggs';
	if (/_sword|_axe|_bow|crossbow|_shield|_helmet|_chestplate|_leggings|_boots|_trident|_mace/.test(base)) return 'combat';
	if (/_pickaxe|_shovel|_hoe|fishing_rod|shears|flint_and_steel|_brush/.test(base)) return 'tools';
	if (/apple|bread|beef|pork|chicken|fish|salmon|cookie|cake|pie|stew|soup|honey|melon|carrot|potato|beetroot|berries|mutton|rabbit|chorus|golden_|cooked_|raw_|sweet_|glow_|spider_eye|poisonous|pufferfish|tropical|kelp|dried/.test(base)) return 'food';
	if (/redstone|repeater|comparator|piston|observer|lever|button|pressure_plate|tripwire|detector_rail|activator_rail|daylight|target|hopper|dropper|dispenser|note_block|sculk_sensor/.test(base)) return 'redstone';
	if (/ingot|nugget|gem|shard|dust|pearl|rod|coal|charcoal|brick|clay_ball|slime_ball|ender_|blaze_|ghast_|nether_star|heart_of_the_sea|scute|prismarine|copper|amethyst|quartz|lapis|diamond|emerald|iron|gold|netherite/.test(base)) return 'materials';
	if (/banner|bed|carpet|painting|flower|sapling|sign|pot|torch|lantern|candle|skull|head|music_disc|book|map|firework|dye|glass|wool|terracotta|concrete|glazed|leaves|log|planks|stairs|slab|fence|door|trapdoor|wall|boat|chest_boat|hanging_sign/.test(base)) return 'decorations';
	if (/stone|ore|deepslate|dirt|sand|gravel|obsidian|netherrack|basalt|blackstone|tuff|calcite|amethyst|copper|deepslate|mud|sculk|ice|snow|grass_block|mycelium|podzol|rooted|moss|dripstone|prismarine|sandstone|granite|diorite|andesite|brick|terracotta|concrete|wool|block|planks|log|leaves|stem|hyphae|nylium|fungus|roots|vine|kelp|coral|sponge|honeycomb|beehive|respawn_anchor|lodestone|ancient_debris|crying_obsidian|gilded|shroomlight|soul_|warped_|crimson_|bamboo|cherry|mangrove|pale_oak/.test(base)) return 'blocks';
	return 'misc';
}

async function exists(p) {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

async function readJson(p) {
	return JSON.parse(await fs.readFile(p, 'utf8'));
}

function rgbToHex(r, g, b) {
	return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

async function extractPaletteFromBuffer(buffer, maxColors = 10) {
	let sharp;
	try {
		sharp = (await import('sharp')).default;
	} catch {
		return null;
	}
	const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const counts = new Map();
	for (let i = 0; i < data.length; i += info.channels) {
		const a = data[i + 3];
		if (a < 128) continue;
		const r = Math.round(data[i] / 8) * 8;
		const g = Math.round(data[i + 1] / 8) * 8;
		const b = Math.round(data[i + 2] / 8) * 8;
		const hex = rgbToHex(r, g, b);
		counts.set(hex, (counts.get(hex) || 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, maxColors)
		.map(([hex]) => hex);
}

async function extractPalette(pngPath, maxColors = 10) {
	return extractPaletteFromBuffer(await fs.readFile(pngPath), maxColors);
}

const zipCache = new Map();

async function loadVersionZip(version, imagesDir) {
	const cached = zipCache.get(version);
	if (cached) return cached;
	const zipPath = path.join(imagesDir, `${version}.zip`);
	if (!(await exists(zipPath))) return null;
	const zip = await JSZip.loadAsync(await fs.readFile(zipPath));
	zipCache.set(version, zip);
	return zip;
}

/** Resolve PNG bytes for an item, searching loose files then version zips (newest first). */
async function resolvePngBuffer(filename, versions, imagesDir) {
	for (const v of [...versions].reverse()) {
		const loose = path.join(imagesDir, v, filename);
		if (await exists(loose)) return fs.readFile(loose);
	}
	for (const v of [...versions].reverse()) {
		const zip = await loadVersionZip(v, imagesDir);
		if (!zip) continue;
		const entry = zip.file(`${v}/${filename}`) ?? zip.file(filename);
		if (entry) return entry.async('nodebuffer');
	}
	return null;
}

async function main() {
	await fs.mkdir(metaDir, { recursive: true });

	const versionsPath = path.join(imagesDir, 'versions.json');
	if (!(await exists(versionsPath))) {
		console.warn('No versions.json found — skipping metadata enrichment.');
		return;
	}

	const { versions, base } = await readJson(versionsPath);
	const sorted = [...versions].sort(compareVersions);

	const itemNames = {
		...(await collectItemNames('images')),
		...(await collectItemNames('images-v2')),
	};

	// Load all manifests/changes to build item state
	const itemVersions = new Map(); // filename -> Set of versions present
	const removedArchive = {};
	const historyCounts = new Map();

	for (const v of sorted) {
		const manifestPath = path.join(imagesDir, v, 'manifest.json');
		const changesPath = path.join(imagesDir, v, 'changes.json');

		let images = [];
		if (await exists(manifestPath)) {
			const m = await readJson(manifestPath);
			images = m.images || [];
		}
		if (v === base) {
			for (const img of images) {
				if (!itemVersions.has(img)) itemVersions.set(img, new Set());
				itemVersions.get(img).add(v);
				historyCounts.set(img, 1);
			}
		}

		if (await exists(changesPath)) {
			const c = await readJson(changesPath);
			for (const img of c.added || []) {
				if (!itemVersions.has(img)) itemVersions.set(img, new Set());
				itemVersions.get(img).add(v);
				historyCounts.set(img, (historyCounts.get(img) || 0) + 1);
			}
			for (const img of c.modified || []) {
				if (!itemVersions.has(img)) itemVersions.set(img, new Set());
				itemVersions.get(img).add(v);
				historyCounts.set(img, (historyCounts.get(img) || 0) + 1);
			}
			for (const img of c.removed || []) {
				if (!removedArchive[img]) {
					removedArchive[img] = { lastSeen: null, removedIn: v };
				}
				removedArchive[img].removedIn = v;
			}
		}
	}

	// Track lastSeen for removed items from version sets
	for (const [filename, entry] of Object.entries(removedArchive)) {
		const vers = itemVersions.get(filename);
		if (vers && vers.size > 0) {
			entry.lastSeen = [...vers].sort(compareVersions).pop();
		}
	}

	const latestVersion = sorted[sorted.length - 1];
	const itemsIndex = {};
	const categories = {};

	for (const [filename, versSet] of itemVersions) {
		const cat = categorizeItem(filename);
		const slug = filenameToSlug(filename);
		const firstSeen = [...versSet].sort(compareVersions)[0];
		const removed = !!removedArchive[filename] && !versSet.has(latestVersion);
		itemsIndex[filename] = {
			slug,
			displayName: formatDisplayName(filename, itemNames),
			category: cat,
			latestVersion: [...versSet].sort(compareVersions).pop(),
			firstSeen,
			removed,
			historyCount: historyCounts.get(filename) || 1,
		};
		if (!categories[cat]) categories[cat] = [];
		categories[cat].push({ filename, slug });
	}

	for (const cat of Object.keys(categories)) {
		categories[cat].sort((a, b) => a.slug.localeCompare(b.slug));
	}

	await fs.writeFile(path.join(metaDir, 'items-index.json'), JSON.stringify(itemsIndex, null, 2) + '\n');
	await fs.writeFile(path.join(metaDir, 'item-names.json'), JSON.stringify(itemNames, null, 2) + '\n');
	await fs.writeFile(path.join(metaDir, 'categories.json'), JSON.stringify(categories, null, 2) + '\n');
	await fs.writeFile(path.join(metaDir, 'removed-archive.json'), JSON.stringify(removedArchive, null, 2) + '\n');
	console.log(
		`Wrote items-index (${Object.keys(itemsIndex).length} items), item-names (${Object.keys(itemNames).length}), categories, removed-archive`,
	);

	// Palettes for items present in the latest version (loose PNGs or version ZIPs)
	const palettes = {};
	const activeItems = Object.entries(itemsIndex)
		.filter(([, meta]) => !meta.removed)
		.map(([filename]) => filename);

	let done = 0;
	for (const filename of activeItems) {
		let colors = null;
		const loosePath = path.join(imagesDir, latestVersion, filename);
		if (await exists(loosePath)) {
			colors = await extractPalette(loosePath);
		} else {
			const buffer = await resolvePngBuffer(filename, sorted, imagesDir);
			if (buffer) colors = await extractPaletteFromBuffer(buffer);
		}
		if (colors?.length) palettes[filename] = colors;
		done++;
		if (done % 200 === 0) console.log(`  palettes: ${done}/${activeItems.length}`);
	}
	await fs.writeFile(path.join(metaDir, 'palettes.json'), JSON.stringify(palettes, null, 2) + '\n');
	console.log(`Wrote palettes (${Object.keys(palettes).length}/${activeItems.length} items with colors)`);
	if (Object.keys(palettes).length === 0 && activeItems.length > 0) {
		console.log('  No PNG sources found — run package-version to extract images or add version ZIPs');
	}

	// Stable append-only index for compact share links (?selc= bitset)
	const selectionIndexPath = path.join(metaDir, 'selection-index.json');
	let selectionItems = [];
	if (await exists(selectionIndexPath)) {
		const existing = await readJson(selectionIndexPath);
		selectionItems = existing.items || [];
	} else {
		selectionItems = Object.keys(itemsIndex).sort();
	}
	const known = new Set(selectionItems);
	for (const filename of Object.keys(itemsIndex).sort()) {
		if (!known.has(filename)) {
			selectionItems.push(filename);
			known.add(filename);
		}
	}
	await fs.writeFile(
		selectionIndexPath,
		JSON.stringify({ version: 1, items: selectionItems }, null, 2) + '\n',
	);
	console.log(`Wrote selection-index (${selectionItems.length} items, append-only)`);

	console.log('Metadata enrichment done.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
