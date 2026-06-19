/** Stable append-only filename list for compact share links (?selc= bitset). */

export interface SelectionIndexJson {
	version: number;
	items: string[];
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(encoded: string): Uint8Array {
	const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
	const pad = padded.length % 4;
	const base64 = pad ? padded + '='.repeat(4 - pad) : padded;
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export function buildSelectionIndexMap(items: string[]): Map<string, number> {
	const map = new Map<string, number>();
	items.forEach((filename, index) => map.set(filename, index));
	return map;
}

/** Encode selected filenames as a base64url bitset (~240 chars max for the full catalog). */
export function encodeSelectionBitset(filenames: Iterable<string>, index: string[]): string | null {
	if (index.length === 0) return null;
	const indexMap = buildSelectionIndexMap(index);
	const byteLen = Math.ceil(index.length / 8);
	const bytes = new Uint8Array(byteLen);
	let encodedAny = false;

	for (const filename of filenames) {
		const i = indexMap.get(filename);
		if (i === undefined) continue;
		bytes[i >> 3] |= 1 << (i & 7);
		encodedAny = true;
	}

	if (!encodedAny) return null;
	return base64UrlEncode(bytes);
}

export function decodeSelectionBitset(encoded: string, index: string[]): Set<string> {
	const result = new Set<string>();
	if (index.length === 0) return result;

	let bytes: Uint8Array;
	try {
		bytes = base64UrlDecode(encoded);
	} catch {
		return result;
	}

	const limit = Math.min(index.length, bytes.length * 8);
	for (let i = 0; i < limit; i++) {
		if (bytes[i >> 3] & (1 << (i & 7))) result.add(index[i]);
	}
	return result;
}

export function slugsToFilenames(slugs: string[]): Set<string> {
	return new Set(
		slugs
			.map((s) => s.trim())
			.filter(Boolean)
			.map((s) => (s.endsWith('.png') ? s : `${s.replace(/-/g, '_')}.png`)),
	);
}

export function filenamesToSlugs(filenames: Iterable<string>): string[] {
	return Array.from(filenames).map((f) => f.replace(/\.png$/i, '').replace(/_/g, '-'));
}

/** Plain comma-separated slugs (legacy / small selections). */
export function buildPlainSelectionParam(filenames: Iterable<string>): string {
	return filenamesToSlugs(filenames).join(',');
}

/** Pick compact bitset or plain slug list, whichever is shorter. */
export function buildShareSelectionParams(
	filenames: Iterable<string>,
	index: string[] | null,
): { sel?: string; selc?: string } {
	const files = Array.from(filenames);
	if (files.length === 0) return {};

	const plain = buildPlainSelectionParam(files);
	if (!index?.length) return { sel: plain };

	const compact = encodeSelectionBitset(files, index);
	if (!compact) return { sel: plain };

	return compact.length < plain.length ? { selc: compact } : { sel: plain };
}

export async function loadSelectionIndex(): Promise<string[]> {
	try {
		const res = await fetch('/metadata/selection-index.json');
		if (!res.ok) return [];
		const data = (await res.json()) as SelectionIndexJson;
		return Array.isArray(data.items) ? data.items : [];
	} catch {
		return [];
	}
}

export function parseSelectionFromSearchParams(
	params: URLSearchParams,
	index: string[],
): Set<string> {
	const compact = params.get('selc');
	if (compact) return decodeSelectionBitset(compact, index);

	const plain = params.get('sel');
	if (!plain) return new Set();
	return slugsToFilenames(plain.split(','));
}
