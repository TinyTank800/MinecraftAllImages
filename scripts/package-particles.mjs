#!/usr/bin/env node
/**
 * Packages particle textures dumped by `/itemgallery dumptextures <version> particle`.
 *
 * - Numbered sequences (big_smoke_0 … big_smoke_11) → one GIF + loose frame PNGs
 * - Vertical strips / mcmeta animations → GIF + extracted frame PNGs
 * - Single-frame → PNG
 * - Version zips + hashes/changes for gallery version history (mirrors item packaging)
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import JSZip from 'jszip';
import gifencPkg from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifencPkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEQUENCE_SUFFIX = /^(.+)_(\d+)$/;

function parseArgs(argv) {
	const args = { base: false };
	if (process.env.PACKAGE_SOURCE) args.source = process.env.PACKAGE_SOURCE;
	if (process.env.PACKAGE_MC_VERSION) args.version = process.env.PACKAGE_MC_VERSION;
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--base') args.base = true;
		else if (a === '--source' || a === '-s') args.source = argv[++i];
		else if (a === '--mc-version' || a === '--version' || a === '-m') args.version = argv[++i];
		else if (a === '--gallery') args.gallery = argv[++i];
		else throw new Error(`Unknown argument: ${a}`);
	}
	if (!args.source) throw new Error('Missing required --source <dir>');
	if (!args.version) throw new Error('Missing required --mc-version <tag>');
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

function md5Hex(buffer) {
	return createHash('md5').update(buffer).digest('hex');
}

function formatDisplayName(id) {
	return id
		.replace(/__/g, ' / ')
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function collectParticlePngs(dumpedRoot) {
	const results = [];
	if (!(await exists(dumpedRoot))) return results;

	async function walk(dir) {
		for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.isFile() && entry.name.endsWith('.png')) {
				const rel = path.relative(dumpedRoot, full).replace(/\\/g, '/');
				if (rel.includes('/particle/') || rel.startsWith('particle/')) results.push(full);
			}
		}
	}

	await walk(dumpedRoot);
	return results.sort((a, b) => a.localeCompare(b));
}

function particleIdFromPath(dumpedRoot, pngPath) {
	const rel = path.relative(dumpedRoot, pngPath).replace(/\\/g, '/');
	const withoutNs = rel.replace(/^[^/]+\/particle\//, '');
	return withoutNs.replace(/\.png$/i, '').replace(/\//g, '__');
}

function groupSources(pngPaths, dumpedRoot) {
	const entries = pngPaths.map((p) => ({ path: p, id: particleIdFromPath(dumpedRoot, p) }));
	const sequenceGroups = new Map();
	const consumed = new Set();

	for (const entry of entries) {
		const match = entry.id.match(SEQUENCE_SUFFIX);
		if (!match) continue;
		const base = match[1];
		const num = parseInt(match[2], 10);
		if (!sequenceGroups.has(base)) sequenceGroups.set(base, []);
		sequenceGroups.get(base).push({ ...entry, num });
	}

	const groups = [];

	for (const [base, frames] of sequenceGroups) {
		if (frames.length < 2) continue;
		frames.sort((a, b) => a.num - b.num);
		for (const f of frames) consumed.add(f.id);
		groups.push({ kind: 'sequence', id: base, displayName: formatDisplayName(base), frames });
	}

	for (const entry of entries) {
		if (consumed.has(entry.id)) continue;
		groups.push({ kind: 'single', id: entry.id, path: entry.path, displayName: formatDisplayName(entry.id) });
	}

	return groups.sort((a, b) => a.id.localeCompare(b.id));
}

async function resolveStripFramePlan(pngPath, width, height) {
	const mcmetaPath = pngPath + '.mcmeta';
	let animation = null;
	if (await exists(mcmetaPath)) {
		const meta = await readJson(mcmetaPath);
		animation = meta?.animation ?? null;
	}
	const defaultDelayMs = Math.max(20, (animation?.frametime ?? 1) * 50);

	if (animation?.frames?.length) {
		const frameSize = width;
		const frames = animation.frames.map((entry) => {
			if (typeof entry === 'number') return { index: entry, delayMs: defaultDelayMs };
			return {
				index: entry.index,
				delayMs: entry.time != null ? Math.max(20, entry.time * 50) : defaultDelayMs,
			};
		});
		return { frameSize, frames, defaultDelayMs, mcmetaPath: (await exists(mcmetaPath)) ? mcmetaPath : null };
	}

	if (animation || (height > width && height % width === 0)) {
		const frameSize = width;
		const count = height / width;
		return {
			frameSize,
			frames: Array.from({ length: count }, (_, index) => ({ index, delayMs: defaultDelayMs })),
			defaultDelayMs,
			mcmetaPath: (await exists(mcmetaPath)) ? mcmetaPath : null,
		};
	}

	return {
		frameSize: Math.min(width, height),
		frames: [{ index: 0, delayMs: defaultDelayMs }],
		defaultDelayMs,
		mcmetaPath: null,
	};
}

async function extractFrameRgba(pngPath, frameSize, frameIndex) {
	const top = frameIndex * frameSize;
	return sharp(pngPath)
		.extract({ left: 0, top, width: frameSize, height: frameSize })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
}

function encodeGif(rgbaFrames, width, height) {
	const gif = GIFEncoder();
	for (const frame of rgbaFrames) {
		const palette = quantize(frame.data, 256);
		const index = applyPalette(frame.data, palette);
		gif.writeFrame(index, width, height, { palette, delay: frame.delayMs, dispose: 2 });
	}
	gif.finish();
	return Buffer.from(gif.bytes());
}

async function gifFromPngPaths(pngPaths, defaultDelayMs = 100) {
	const rgbaFrames = [];
	let frameSize = 0;
	for (const pngPath of pngPaths) {
		const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
		frameSize = info.width;
		rgbaFrames.push({ data, delayMs: defaultDelayMs });
	}
	return {
		gifBuffer: encodeGif(rgbaFrames, frameSize, frameSize),
		frameSize,
		frameCount: rgbaFrames.length,
	};
}

async function writePngBuffer(outPath, data, info) {
	await fs.mkdir(path.dirname(outPath), { recursive: true });
	await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
		.png()
		.toFile(outPath);
}

async function processGroup(group, outDir) {
	if (group.kind === 'sequence') {
		const pngPaths = group.frames.map((f) => f.path);
		const { gifBuffer, frameSize, frameCount } = await gifFromPngPaths(pngPaths);
		const displayFile = `${group.id}.gif`;
		await fs.writeFile(path.join(outDir, displayFile), gifBuffer);

		const frameFiles = [];
		for (const frame of group.frames) {
			const rel = `frames/${group.id}/${frame.num}.png`;
			const dest = path.join(outDir, rel);
			await fs.mkdir(path.dirname(dest), { recursive: true });
			await fs.copyFile(frame.path, dest);
			frameFiles.push(rel);
		}

		return {
			id: group.id,
			displayFile,
			displayName: group.displayName,
			animated: true,
			frameCount,
			frameSize,
			kind: 'sequence',
			frameFiles,
			hash: md5Hex(gifBuffer),
		};
	}

	const meta = await sharp(group.path).metadata();
	const width = meta.width ?? 0;
	const height = meta.height ?? 0;
	const plan = await resolveStripFramePlan(group.path, width, height);
	const animated = plan.frames.length > 1;

	if (animated) {
		const rgbaFrames = [];
		for (const spec of plan.frames) {
			const { data, info } = await extractFrameRgba(group.path, plan.frameSize, spec.index);
			rgbaFrames.push({ data, delayMs: spec.delayMs });
		}
		const gifBuffer = encodeGif(rgbaFrames, plan.frameSize, plan.frameSize);
		const displayFile = `${group.id}.gif`;
		await fs.writeFile(path.join(outDir, displayFile), gifBuffer);

		const frameFiles = [];
		for (let i = 0; i < plan.frames.length; i++) {
			const rel = `frames/${group.id}/${i}.png`;
			const { data, info } = await extractFrameRgba(group.path, plan.frameSize, plan.frames[i].index);
			await writePngBuffer(path.join(outDir, rel), data, info);
			frameFiles.push(rel);
		}

		if (plan.mcmetaPath) {
			await fs.copyFile(plan.mcmetaPath, path.join(outDir, `${group.id}.png.mcmeta`));
		}

		return {
			id: group.id,
			displayFile,
			displayName: group.displayName,
			animated: true,
			frameCount: plan.frames.length,
			frameSize: plan.frameSize,
			kind: 'strip',
			frameFiles,
			hash: md5Hex(gifBuffer),
		};
	}

	const { data, info } = await extractFrameRgba(group.path, plan.frameSize, 0);
	const displayFile = `${group.id}.png`;
	await writePngBuffer(path.join(outDir, displayFile), data, info);
	const pngBuf = await fs.readFile(path.join(outDir, displayFile));

	const frameFiles = [`frames/${group.id}/0.png`];
	await writePngBuffer(path.join(outDir, frameFiles[0]), data, info);

	if (plan.mcmetaPath) {
		await fs.copyFile(plan.mcmetaPath, path.join(outDir, `${group.id}.png.mcmeta`));
	}

	return {
		id: group.id,
		displayFile,
		displayName: group.displayName,
		animated: false,
		frameCount: 1,
		frameSize: plan.frameSize,
		kind: 'static',
		frameFiles,
		hash: md5Hex(pngBuf),
	};
}

function findPreviousVersion(versions, current) {
	const sorted = [...versions].sort(compareVersions);
	let prev = null;
	for (const v of sorted) {
		if (v === current) return prev;
		prev = v;
	}
	return null;
}

async function main() {
	const args = parseArgs(process.argv);
	const galleryRoot = args.gallery ? path.resolve(args.gallery) : path.resolve(__dirname, '..');
	const particlesDir = path.join(galleryRoot, 'public', 'particles');

	let versionDir = path.join(args.source, args.version);
	if (!(await exists(versionDir)) && path.basename(args.source) === args.version) {
		versionDir = path.resolve(args.source);
	}
	if (!(await exists(versionDir))) throw new Error(`Export folder not found: ${versionDir}`);

	const dumpedRoot = path.join(versionDir, 'dumped');
	const pngPaths = await collectParticlePngs(dumpedRoot);
	if (pngPaths.length === 0) {
		throw new Error(`No particle PNGs under ${dumpedRoot}. Run /itemgallery dumptextures ${args.version} particle first.`);
	}

	const outDir = path.join(particlesDir, args.version);
	await fs.rm(outDir, { recursive: true, force: true });
	await fs.mkdir(outDir, { recursive: true });

	const groups = groupSources(pngPaths, dumpedRoot);
	const packaged = [];
	for (const group of groups) {
		packaged.push(await processGroup(group, outDir));
	}
	packaged.sort((a, b) => a.id.localeCompare(b.id));

	const versionsPath = path.join(particlesDir, 'versions.json');
	let versionsData = { versions: [], base: args.version };
	if (await exists(versionsPath)) versionsData = await readJson(versionsPath);
	const versionSet = new Set(versionsData.versions || []);
	versionSet.add(args.version);
	const versions = [...versionSet].sort(compareVersions).reverse();
	const base = [...versionSet].sort(compareVersions)[0];

	const prevVersion = findPreviousVersion([...versionSet].sort(compareVersions), args.version);
	let previousHashes = {};
	if (prevVersion) {
		const prevHashesPath = path.join(particlesDir, prevVersion, 'hashes.json');
		if (await exists(prevHashesPath)) previousHashes = await readJson(prevHashesPath);
	}

	const hashes = Object.fromEntries(packaged.map((p) => [p.id, p.hash]));
	const isBase = args.base || !prevVersion || Object.keys(previousHashes).length === 0;

	const changes = { added: [], modified: [], removed: [], particles: [] };
	if (!isBase) {
		const currentIds = new Set(packaged.map((p) => p.id));
		const prevIds = new Set(Object.keys(previousHashes));
		for (const p of packaged) {
			if (!prevIds.has(p.id)) changes.added.push(p.id);
			else if (previousHashes[p.id] !== p.hash) changes.modified.push(p.id);
		}
		for (const id of prevIds) {
			if (!currentIds.has(id)) changes.removed.push(id);
		}
		changes.particles = packaged.filter(
			(p) => changes.added.includes(p.id) || changes.modified.includes(p.id),
		);
	}

	const manifestParticles = packaged.map(({ hash: _h, ...rest }) => rest);
	const manifest = { version: args.version, isBase, particles: manifestParticles };
	await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
	await fs.writeFile(path.join(outDir, 'hashes.json'), JSON.stringify(hashes, null, 2) + '\n');
	if (!isBase) {
		await fs.writeFile(path.join(outDir, 'changes.json'), JSON.stringify(changes, null, 2) + '\n');
	}

	const filesToZip = new Set(['manifest.json', 'hashes.json']);
	if (!isBase) filesToZip.add('changes.json');
	for (const p of packaged) {
		filesToZip.add(p.displayFile);
		for (const f of p.frameFiles || []) filesToZip.add(f);
	}

	const zip = new JSZip();
	const folder = zip.folder(args.version);
	if (isBase) {
		folder.file('manifest.json', JSON.stringify(manifest, null, 2));
	} else {
		folder.file('changes.json', JSON.stringify(changes, null, 2));
	}

	for (const rel of filesToZip) {
		if (rel === 'manifest.json' || rel === 'changes.json') continue;
		const src = path.join(outDir, rel);
		if (await exists(src)) folder.file(rel, await fs.readFile(src));
	}

	const zipPath = path.join(particlesDir, `${args.version}.zip`);
	const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
	await fs.writeFile(zipPath, zipBuffer);

	await fs.writeFile(
		path.join(particlesDir, 'selection-index.json'),
		JSON.stringify({ version: 1, items: packaged.map((p) => p.id) }, null, 2) + '\n',
	);

	await fs.writeFile(versionsPath, JSON.stringify({ versions, base }, null, 2) + '\n');

	const gifCount = packaged.filter((p) => p.animated).length;
	console.log(`Packaged ${packaged.length} particles for ${args.version} -> public/particles/${args.version}/`);
	console.log(`  ${gifCount} GIFs, ${packaged.length - gifCount} PNGs (${isBase ? 'BASE' : 'incremental'})`);
	if (!isBase) {
		console.log(`  changes: +${changes.added.length} ~${changes.modified.length} -${changes.removed.length}`);
	}
	console.log(`  wrote ${zipPath} (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
	console.log(`  updated public/particles/versions.json (base=${base})`);
}

main().catch((e) => {
	console.error(e.message || e);
	process.exit(1);
});
