/**
 * Generates Open Graph PNG cards (1200×630) into public/og/.
 * Run automatically before `astro build`, or manually: node scripts/generate-og.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'og');
const W = 1200;
const H = 630;

const CARDS = [
	{
		file: 'default.png',
		title: 'Minecraft Item Gallery',
		subtitle: 'Every item image · all versions',
		badge: 'Browse · Compare · Download',
	},
	{
		file: 'particles.png',
		title: 'Particle Textures',
		subtitle: 'GIFs & frame PNGs',
		badge: 'mcitemgallery.com/particles',
	},
	{
		file: 'docs.png',
		title: 'Documentation',
		subtitle: 'Export, package & CDN API',
		badge: 'mcitemgallery.com/docs',
	},
];

function escapeXml(text) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function wrapLines(text, maxChars) {
	const words = text.split(' ');
	const lines = [];
	let line = '';
	for (const word of words) {
		const next = line ? `${line} ${word}` : word;
		if (next.length > maxChars && line) {
			lines.push(line);
			line = word;
		} else {
			line = next;
		}
	}
	if (line) lines.push(line);
	return lines;
}

function logoBlocks(x, y, size) {
	const gap = size * 0.18;
	const cells = [
		['g', 'r', 'd'],
		['r', 'g', 'r'],
		['d', 'r', 'g'],
	];
	const fills = {
		g: 'url(#logoGrad)',
		r: '#e11d2e',
		d: '#7f1d1d',
	};
	let svg = '';
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 3; col++) {
			const cx = x + col * (size + gap);
			const cy = y + row * (size + gap);
			const r = size * 0.18;
			svg += `<rect x="${cx}" y="${cy}" width="${size}" height="${size}" rx="${r}" fill="${fills[cells[row][col]]}"/>`;
		}
	}
	return svg;
}

/** 3×3 logo grid centered inside a rounded square frame. */
function logoFrameSvg(frameX, frameY, frameSize, blockSize) {
	const gap = blockSize * 0.18;
	const gridSize = 3 * blockSize + 2 * gap;
	const innerX = frameX + (frameSize - gridSize) / 2;
	const innerY = frameY + (frameSize - gridSize) / 2;
	const radius = frameSize * 0.2;
	return `<rect x="${frameX}" y="${frameY}" width="${frameSize}" height="${frameSize}" rx="${radius}" fill="#1a1a1e" stroke="#2e282b" stroke-width="2"/>
  ${logoBlocks(innerX, innerY, blockSize)}`;
}

const LOGO_FRAME = 120;
const LOGO_BLOCK = 22;
const LOGO_MARGIN = 72;
const LOGO_X = LOGO_MARGIN;
const LOGO_Y = LOGO_MARGIN;
const DECOR_X = W - LOGO_MARGIN - LOGO_FRAME;
const DECOR_Y = H - LOGO_MARGIN - LOGO_FRAME;

function cardSvg({ title, subtitle, badge }) {
	const titleLines = wrapLines(title, 22);
	const titleY = titleLines.length > 1 ? 248 : 268;
	const titleSvg = titleLines
		.map((line, i) => {
			const y = titleY + i * 62;
			return `<text x="96" y="${y}" font-family="Segoe UI, system-ui, -apple-system, sans-serif" font-size="52" font-weight="700" fill="#f4f0f1">${escapeXml(line)}</text>`;
		})
		.join('\n');

	return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff6b6b"/>
      <stop offset="1" stop-color="#9b0f1c"/>
    </linearGradient>
    <linearGradient id="accentBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff6b6b"/>
      <stop offset="1" stop-color="#9b0f1c"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="20%" r="55%">
      <stop offset="0" stop-color="#e11d2e" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#e11d2e" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="#ffffff" opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="#121214"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="8" height="${H}" fill="url(#accentBar)"/>
  ${logoFrameSvg(LOGO_X, LOGO_Y, LOGO_FRAME, LOGO_BLOCK)}
  ${titleSvg}
  <text x="96" y="360" font-family="Segoe UI, system-ui, -apple-system, sans-serif" font-size="30" fill="#b8aeb2">${escapeXml(subtitle)}</text>
  <rect x="96" y="400" width="${Math.min(520, badge.length * 11 + 40)}" height="44" rx="22" fill="rgba(225,29,46,0.15)" stroke="#e11d2e" stroke-width="1.5"/>
  <text x="116" y="430" font-family="Segoe UI, system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" fill="#ff6b6b">${escapeXml(badge)}</text>
  <text x="96" y="560" font-family="Segoe UI, system-ui, -apple-system, sans-serif" font-size="22" fill="#5c5356">mcitemgallery.com</text>
  ${logoFrameSvg(DECOR_X, DECOR_Y, LOGO_FRAME, LOGO_BLOCK)}
</svg>`;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const card of CARDS) {
	const outPath = path.join(OUT_DIR, card.file);
	await sharp(Buffer.from(cardSvg(card))).png().toFile(outPath);
	console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
}
