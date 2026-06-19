/** Convert item filename to URL slug: diamond_sword.png -> diamond-sword */
export function filenameToSlug(filename: string): string {
	return filename.replace(/\.png$/i, '').replace(/_/g, '-');
}

/** Convert slug back to filename: diamond-sword -> diamond_sword.png */
export function slugToFilename(slug: string): string {
	return slug.replace(/-/g, '_') + '.png';
}

const VARIANT_WITH_SLUG = /^(.+)__([a-z0-9][a-z0-9_]*)__([a-f0-9]{8})$/i;
const VARIANT_HASH_ONLY = /^(.+)__([a-f0-9]{8})$/i;

function titleCaseFromSlug(slug: string): string {
	return slug
		.split('_')
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}

function lookupDisplayName(filename: string, names?: Record<string, string>): string | null {
	if (!names) return null;
	const withExt = filename.endsWith('.png') ? filename : `${filename}.png`;
	if (names[withExt]) return names[withExt];
	if (names[filename]) return names[filename];
	return null;
}

/**
 * Human-readable label for a gallery filename.
 * Prefers mod-exported names.json entries, then variant slug segments in the filename.
 */
export function formatItemName(filename: string, names?: Record<string, string>): string {
	const named = lookupDisplayName(filename, names);
	if (named) return named;

	let base = filename.replace(/\.png$/i, '');

	const withSlug = base.match(VARIANT_WITH_SLUG);
	if (withSlug) {
		const [, itemBase, slugPart] = withSlug;
		if (slugPart !== itemBase) {
			return titleCaseFromSlug(slugPart);
		}
		base = itemBase;
	}

	const hashOnly = base.match(VARIANT_HASH_ONLY);
	if (hashOnly) {
		return formatItemName(`${hashOnly[1]}.png`, names);
	}

	return titleCaseFromSlug(base);
}

export function altTextForItem(displayName: string, version: string): string {
	return `Minecraft ${displayName} item icon (${version}, transparent PNG)`;
}

/** True when filename uses mod variant suffix (hash or slug+hash). */
export function isVariantFilename(filename: string): boolean {
	const base = filename.replace(/\.png$/i, '');
	return VARIANT_WITH_SLUG.test(base) || VARIANT_HASH_ONLY.test(base);
}
