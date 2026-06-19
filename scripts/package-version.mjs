#!/usr/bin/env node
/**
 * Packages a version exported by the Item Gallery Fabric mod (`/itemgallery export`) into the
 * zip + manifest layout that this gallery consumes, and updates the matching versions index.
 *
 * The mod writes each version to `<minecraft>/gallery-export/<version>/`, containing:
 *   - one PNG per item (e.g. `stone.png`)
 *   - manifest.json   {version, isBase, images[]}
 *   - hashes.json     {"<file>.png": "<md5>"}  (used by the mod to diff future versions)
 *   - changes.json    {added, modified, removed, ...}  (only when a previous export existed)
 *
 * This script turns one such folder into:
 *   - public/images/<version>.zip        (legacy v1 set — default)
 *   - public/images-v2/<version>.zip     (enhanced mod captures — pass --set v2)
 *   - loose manifest/changes copies under the same tree
 *   - versions.json updated in that tree
 *
 * Usage (run from the gallery project root):
 *   npm run package-version -- --source "C:/path/to/gallery-export" --mc-version 1.21.1 --set v2
 *   node scripts/package-version.mjs --source "C:/path/to/gallery-export" --version 1.21.1 --set v2
 *
 *   PowerShell / npm 11: flags after npm run may not reach the script. Prefer node directly, or:
 *   $env:PACKAGE_SOURCE="..."; $env:PACKAGE_MC_VERSION="1.21.1"; $env:PACKAGE_SET="v2"; npm run package-version
 *
 * Flags:
 *   --source <dir>      Folder that contains the per-version export folders (the `gallery-export` dir).
 *   --mc-version <tag>  Version tag to package (use this with npm run; npm steals --version).
 *   --version <tag>     Same as --mc-version (works when invoking node directly).
 *   --set v1|v2      Target image set: v1/legacy (default) or v2/enhanced (mod re-renders).
 *   --base           Force-mark this version as the base (full image set), even if a changes.json exists.
 *   --gallery <dir>  Gallery project root (defaults to the parent of this script's directory).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
	const args = { base: false, set: 'v1' };
	if (process.env.PACKAGE_SOURCE) args.source = process.env.PACKAGE_SOURCE;
	if (process.env.PACKAGE_MC_VERSION) args.version = process.env.PACKAGE_MC_VERSION;
	if (process.env.PACKAGE_SET) {
		const val = process.env.PACKAGE_SET;
		if (val === 'v2' || val === 'enhanced') args.set = 'v2';
		else if (val === 'v1' || val === 'legacy') args.set = 'v1';
	}
	if (process.env.PACKAGE_BASE === '1' || process.env.PACKAGE_BASE === 'true') args.base = true;

	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--base') args.base = true;
		else if (a === '--source' || a === '-s') args.source = argv[++i];
		else if (a === '--mc-version' || a === '--version' || a === '-m') args.version = argv[++i];
		else if (a === '--gallery') args.gallery = argv[++i];
		else if (a === '--set') {
			const val = argv[++i];
			if (val === 'v2' || val === 'enhanced') args.set = 'v2';
			else if (val === 'v1' || val === 'legacy') args.set = 'v1';
			else throw new Error(`Unknown --set value: ${val} (use v1|v2|legacy|enhanced)`);
		}
		else throw new Error(`Unknown argument: ${a}`);
	}
	if (!args.source) throw new Error('Missing required --source <dir> (or PACKAGE_SOURCE env var)');
	if (!args.version) throw new Error('Missing required --mc-version <tag> (or PACKAGE_MC_VERSION env var, or --version when using node directly)');
	return args;
}

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

async function main() {
	const args = parseArgs(process.argv);
	const galleryRoot = args.gallery ? path.resolve(args.gallery) : path.resolve(__dirname, '..');
	const imagesDirName = args.set === 'v2' ? 'images-v2' : 'images';
	const imagesDir = path.join(galleryRoot, 'public', imagesDirName);

	// Resolve the version folder: allow --source to be either the gallery-export root or the version folder.
	let versionDir = path.join(args.source, args.version);
	if (!(await exists(versionDir)) && path.basename(args.source) === args.version) {
		versionDir = path.resolve(args.source);
	}
	if (!(await exists(versionDir))) {
		throw new Error(`Export folder not found: ${versionDir}`);
	}

	const manifestPath = path.join(versionDir, 'manifest.json');
	if (!(await exists(manifestPath))) {
		throw new Error(`manifest.json not found in ${versionDir}. Did /itemgallery export finish?`);
	}
	const manifest = await readJson(manifestPath);
	const allImages = (manifest.images || []).slice().sort();

	const changesPath = path.join(versionDir, 'changes.json');
	const hasChanges = await exists(changesPath);
	const isBase = args.base || !hasChanges;

	console.log(`Packaging ${args.version} (${isBase ? 'BASE' : 'incremental'}) -> ${imagesDirName} from ${versionDir}`);
	console.log(`  ${allImages.length} total images in manifest`);

	// Decide which PNGs go into the zip.
	let imagesToInclude;
	let changes = null;
	if (isBase) {
		imagesToInclude = allImages;
	} else {
		changes = await readJson(changesPath);
		const set = new Set([...(changes.added || []), ...(changes.modified || [])]);
		imagesToInclude = [...set].sort();
		console.log(
			`  changes: +${(changes.added || []).length} ~${(changes.modified || []).length} -${(changes.removed || []).length} -> ${imagesToInclude.length} pngs in zip`,
		);
	}

	// Build the zip with an internal `<version>/` folder, matching what zip.ts expects.
	const zip = new JSZip();
	const folder = zip.folder(args.version);
	if (isBase) {
		folder.file('manifest.json', JSON.stringify(manifest, null, 2));
	} else {
		folder.file('changes.json', JSON.stringify(changes, null, 2));
	}

	let missing = 0;
	for (const img of imagesToInclude) {
		const src = path.join(versionDir, img);
		if (!(await exists(src))) {
			missing++;
			if (missing <= 10) console.warn(`  WARNING: missing image ${img}`);
			continue;
		}
		folder.file(img, await fs.readFile(src));
	}
	if (missing > 0) console.warn(`  ${missing} referenced images were missing and skipped`);

	await fs.mkdir(imagesDir, { recursive: true });
	const zipPath = path.join(imagesDir, `${args.version}.zip`);
	const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
	await fs.writeFile(zipPath, zipBuffer);
	console.log(`  wrote ${zipPath} (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

	// Also drop loose manifest/changes for reference (mirrors what is already committed in the repo).
	const looseDir = path.join(imagesDir, args.version);
	await fs.mkdir(looseDir, { recursive: true });
	await fs.copyFile(manifestPath, path.join(looseDir, 'manifest.json'));
	if (hasChanges) await fs.copyFile(changesPath, path.join(looseDir, 'changes.json'));

	// Extract loose PNGs (+ optional WebP) for direct URL serving and palette generation.
	let sharp = null;
	try {
		sharp = (await import('sharp')).default;
	} catch {
		console.log('  sharp not installed — skipping WebP generation');
	}
	let extracted = 0;
	for (const img of imagesToInclude) {
		const src = path.join(versionDir, img);
		if (!(await exists(src))) continue;
		const dest = path.join(looseDir, img);
		await fs.copyFile(src, dest);
		if (sharp) {
			const webpDest = dest.replace(/\.png$/i, '.webp');
			await sharp(src).webp({ lossless: true }).toFile(webpDest);
		}
		extracted++;
	}
	console.log(`  extracted ${extracted} loose PNGs to ${looseDir}${sharp ? ' (+ WebP)' : ''}`);

	// Copy hashes/names if present (from mod export)
	for (const extra of ['hashes.json', 'names.json']) {
		const src = path.join(versionDir, extra);
		if (await exists(src)) await fs.copyFile(src, path.join(looseDir, extra));
	}

	// Update versions.json: add the version, recompute base as the lowest version present.
	const versionsPath = path.join(imagesDir, 'versions.json');
	let versionsData = { versions: [], base: args.version };
	if (await exists(versionsPath)) versionsData = await readJson(versionsPath);
	const versionSet = new Set(versionsData.versions || []);
	versionSet.add(args.version);
	const versions = [...versionSet].sort(compareVersions).reverse();
	const base = [...versionSet].sort(compareVersions)[0];
	await fs.writeFile(versionsPath, JSON.stringify({ versions, base }, null, 2) + '\n');
	console.log(`  updated versions.json (base=${base}, ${versions.length} versions)`);

	if (!isBase && base === args.version) {
		console.warn(
			'  NOTE: this is now the lowest version, so it is treated as the base by the app, ' +
				'but it was packaged incrementally (changes.json only). Re-run with --base to package the full image set.',
		);
	}

	console.log('Done.');

	// Regenerate metadata index for SEO pages and palettes
	try {
		const { spawn } = await import('node:child_process');
		await new Promise((resolve, reject) => {
			const child = spawn(process.execPath, [path.join(__dirname, 'enrich-metadata.mjs')], {
				cwd: galleryRoot,
				stdio: 'inherit',
			});
			child.on('close', (code) => (code === 0 ? resolve(undefined) : reject(new Error(`enrich-metadata exited ${code}`))));
		});
	} catch (e) {
		console.warn('  metadata enrichment skipped:', e.message || e);
	}
}

main().catch((e) => {
	console.error(e.message || e);
	process.exit(1);
});
