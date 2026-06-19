import type { ImageSource, VersionProcessingResult, VersionTag } from './types';
import { imagesRootPath } from './image-source';

const CACHE_NAME = 'minecraft-zip-cache-v2';

async function getCache(): Promise<Cache | null> {
	if (typeof caches === 'undefined') return null;
	try {
		return await caches.open(CACHE_NAME);
	} catch {
		return null;
	}
}

/** Cache key includes image set + version so v1/v2 blobs stay distinct. */
export function blobCacheKey(imageSet: ImageSource, version: VersionTag, filename: string): string {
	return `${imageSet}/${version}/${filename}`;
}

export async function loadVersionZip(
	version: VersionTag,
	isBaseVersion: boolean,
	imageDataCache: Map<string, Blob>,
	imagesRoot = 'images',
): Promise<VersionProcessingResult> {
	const JSZip = (await import('jszip')).default;
	const result: VersionProcessingResult = {
		versionTag: version,
		processed: false,
		added: [],
		modified: [],
		removed: [],
		manifestImages: [],
		error: null,
	};

	try {
		const cache = await getCache();
		const zipUrl = `/${imagesRoot}/${version}.zip`;
		let zipBlob: Blob | null = null;

		if (cache) {
			const cached = await cache.match(zipUrl);
			if (cached && cached.ok) {
				zipBlob = await cached.blob();
			} else {
				const resp = await fetch(zipUrl);
				if (!resp.ok) {
					if (resp.status === 404) {
						result.error = 'ZIP Not Found (404)';
						return result;
					}
					throw new Error(`Fetch failed for ${zipUrl}: ${resp.status} ${resp.statusText}`);
				}
				await cache.put(zipUrl, resp.clone());
				zipBlob = await resp.blob();
			}
		} else {
			const resp = await fetch(zipUrl);
			if (!resp.ok) {
				if (resp.status === 404) {
					result.error = 'ZIP Not Found (404)';
					return result;
				}
				throw new Error(`Fetch failed for ${zipUrl}: ${resp.status} ${resp.statusText}`);
			}
			zipBlob = await resp.blob();
		}

		if (!zipBlob) {
			throw new Error('ZIP blob missing');
		}

		const zip = await JSZip.loadAsync(zipBlob);
		const basePathInZip = `${version}/`;
		const manifestFile = zip.file(`${basePathInZip}manifest.json`);
		const changesFile = zip.file(`${basePathInZip}changes.json`);

		if (isBaseVersion) {
			if (!manifestFile) throw new Error(`manifest.json not found in ${version}.zip`);
			const manifestContent = await manifestFile.async('string');
			const manifestData = JSON.parse(manifestContent) as { images?: string[] };
			if (!manifestData || !Array.isArray(manifestData.images)) {
				throw new Error(`Invalid manifest.json format in ${version}.zip`);
			}
			result.manifestImages = (manifestData.images || []).filter(
				(f) => f !== 'x.png' && f !== 'u.png',
			);
		} else {
			if (!changesFile) {
				result.processed = true;
				return result;
			}
			const changesContent = await changesFile.async('string');
			const changesData = JSON.parse(changesContent) as {
				added?: string[];
				modified?: string[];
				removed?: string[];
			};
			result.added = (changesData.added || []).filter((f) => f !== 'x.png' && f !== 'u.png');
			result.modified = (changesData.modified || []).filter((f) => f !== 'x.png' && f !== 'u.png');
			result.removed = (changesData.removed || []).filter((f) => f !== 'x.png' && f !== 'u.png');
		}

		const imageSet: ImageSource = imagesRoot === 'images-v2' ? 'v2' : 'v1';
		const toExtract = new Set<string>();
		if (isBaseVersion) {
			for (const f of result.manifestImages) toExtract.add(f);
		} else {
			for (const f of result.added) toExtract.add(f);
			for (const f of result.modified) toExtract.add(f);
		}

		const tasks: Promise<void>[] = [];
		for (const filename of toExtract) {
			const filePathInZip = `${basePathInZip}${filename.replace(/\\/g, '/')}`;
			const entry = zip.file(filePathInZip);
			if (!entry) continue;
			tasks.push(
				entry.async('blob').then((blob) => {
					imageDataCache.set(blobCacheKey(imageSet, version, filename), blob);
				}),
			);
		}
		await Promise.all(tasks);

		result.processed = true;
		return result;
	} catch (e: unknown) {
		result.error = e instanceof Error ? e.message : 'Unknown error';
		return result;
	}
}

/** Resolve display URL: prefer blob from cache, fall back to static PNG path. */
export function resolveImageUrl(
	cache: Map<string, Blob>,
	blobUrls: Map<string, string>,
	imageSet: ImageSource,
	version: VersionTag,
	filename: string,
): { path: string; blobUrl: string | null } {
	const key = blobCacheKey(imageSet, version, filename);
	const blob = cache.get(key);
	const root = imagesRootPath(imageSet);
	if (blob) {
		let url = blobUrls.get(key);
		if (!url) {
			try {
				url = URL.createObjectURL(blob);
				blobUrls.set(key, url);
			} catch {
				return { path: `/${root}/${version}/${filename}`, blobUrl: null };
			}
		}
		return { path: url, blobUrl: url };
	}
	return { path: `/${root}/${version}/${filename}`, blobUrl: null };
}

export function revokeBlobUrls(blobUrls: Map<string, string>) {
	for (const url of blobUrls.values()) {
		URL.revokeObjectURL(url);
	}
	blobUrls.clear();
}
