import type { ImageSource, VersionTag, VersionsIndexJson } from './types';
import { compareVersions } from './versioning';

export type { ImageSource };

export const IMAGE_SOURCE_LABELS: Record<ImageSource, string> = {
	v1: 'Legacy (v1)',
	v2: 'Enhanced (v2)',
};

export const IMAGE_SOURCE_HINTS: Record<ImageSource, string> = {
	v1: 'Original screenshot-based images across all packaged versions.',
	v2: 'Mod re-renders only — shows versions packaged under images-v2/.',
};

export interface VersionCatalog {
	versions: VersionTag[];
	base: VersionTag | null;
}

export function imagesRootPath(source: ImageSource): string {
	return source === 'v2' ? 'images-v2' : 'images';
}

export function readImageSourcePref(): ImageSource {
	if (typeof window === 'undefined') return 'v1';
	try {
		const saved = localStorage.getItem('imageSource');
		return saved === 'v2' ? 'v2' : 'v1';
	} catch {
		return 'v1';
	}
}

export function parseVersionsIndex(data: VersionsIndexJson): VersionCatalog {
	return {
		versions: (data.versions || []).slice().sort(compareVersions).reverse(),
		base: data.base ?? null,
	};
}

export function catalogForSource(source: ImageSource, v1: VersionCatalog, v2: VersionCatalog): VersionCatalog {
	return source === 'v2' ? v2 : v1;
}

export function isVersionInCatalog(version: VersionTag, catalog: VersionCatalog): boolean {
	return version === 'latest' || catalog.versions.includes(version);
}

export function clampVersionChoice(version: VersionTag, catalog: VersionCatalog): VersionTag {
	if (catalog.versions.length === 0) return 'latest';
	if (version === 'latest') return 'latest';
	return catalog.versions.includes(version) ? version : 'latest';
}
