import type { ParticleManifestJson, ParticleMeta, ParticleProcessingResult, VersionTag } from './types';

const CACHE_NAME = 'minecraft-particle-zip-cache-v1';

async function getCache(): Promise<Cache | null> {
	if (typeof caches === 'undefined') return null;
	try {
		return await caches.open(CACHE_NAME);
	} catch {
		return null;
	}
}

export function particleBlobCacheKey(version: VersionTag, relativePath: string): string {
	return `particles/${version}/${relativePath}`;
}

export async function loadParticleVersionZip(
	version: VersionTag,
	isBaseVersion: boolean,
	imageDataCache: Map<string, Blob>,
): Promise<ParticleProcessingResult> {
	const JSZip = (await import('jszip')).default;
	const result: ParticleProcessingResult = {
		versionTag: version,
		processed: false,
		added: [],
		modified: [],
		removed: [],
		manifestParticles: [],
		error: null,
	};

	try {
		const cache = await getCache();
		const zipUrl = `/particles/${version}.zip`;
		let zipBlob: Blob | null = null;

		if (cache) {
			const cached = await cache.match(zipUrl);
			if (cached?.ok) {
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

		if (!zipBlob) throw new Error('ZIP blob missing');

		const zip = await JSZip.loadAsync(zipBlob);
		const basePathInZip = `${version}/`;
		const manifestFile = zip.file(`${basePathInZip}manifest.json`);
		const changesFile = zip.file(`${basePathInZip}changes.json`);

		if (isBaseVersion) {
			if (!manifestFile) throw new Error(`manifest.json not found in ${version}.zip`);
			const manifest = JSON.parse(await manifestFile.async('string')) as ParticleManifestJson;
			if (!manifest?.particles?.length) throw new Error(`Invalid manifest in ${version}.zip`);
			result.manifestParticles = manifest.particles;
		} else {
			if (!changesFile) {
				result.processed = true;
				return result;
			}
			const changes = JSON.parse(await changesFile.async('string')) as {
				added?: string[];
				modified?: string[];
				removed?: string[];
				particles?: ParticleMeta[];
			};
			result.added = changes.added || [];
			result.modified = changes.modified || [];
			result.removed = changes.removed || [];
			if (changes.particles?.length) result.manifestParticles = changes.particles;
		}

		const toExtract = new Set<string>();
		const collectPaths = (meta: ParticleMeta) => {
			toExtract.add(meta.displayFile);
			for (const frame of meta.frameFiles || []) toExtract.add(frame);
		};

		if (isBaseVersion) {
			for (const p of result.manifestParticles) collectPaths(p);
		} else {
			for (const p of result.manifestParticles) collectPaths(p);
		}

		const tasks: Promise<void>[] = [];
		for (const relativePath of toExtract) {
			const filePathInZip = `${basePathInZip}${relativePath.replace(/\\/g, '/')}`;
			const entry = zip.file(filePathInZip);
			if (!entry) continue;
			tasks.push(
				entry.async('blob').then((blob) => {
					imageDataCache.set(particleBlobCacheKey(version, relativePath), blob);
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

/** Load loose manifest when no version zip exists yet. */
export async function loadLooseParticleManifest(version: VersionTag): Promise<ParticleMeta[] | null> {
	try {
		const res = await fetch(`/particles/${version}/manifest.json`);
		if (!res.ok) return null;
		const manifest = (await res.json()) as ParticleManifestJson;
		return manifest.particles ?? null;
	} catch {
		return null;
	}
}

export function resolveParticleAssetUrl(
	cache: Map<string, Blob>,
	blobUrls: Map<string, string>,
	version: VersionTag,
	relativePath: string,
): { path: string; blobUrl: string | null } {
	const key = particleBlobCacheKey(version, relativePath);
	const blob = cache.get(key);
	if (blob) {
		let url = blobUrls.get(key);
		if (!url) {
			try {
				url = URL.createObjectURL(blob);
				blobUrls.set(key, url);
			} catch {
				return { path: `/particles/${version}/${relativePath}`, blobUrl: null };
			}
		}
		return { path: url, blobUrl: url };
	}
	return { path: `/particles/${version}/${relativePath}`, blobUrl: null };
}

export function revokeParticleBlobUrls(blobUrls: Map<string, string>) {
	for (const url of blobUrls.values()) URL.revokeObjectURL(url);
	blobUrls.clear();
}
