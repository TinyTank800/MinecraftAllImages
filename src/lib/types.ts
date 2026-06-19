export type VersionTag = string;

export type ImageSource = 'v1' | 'v2';

export type ItemCategory =
	| 'blocks'
	| 'combat'
	| 'tools'
	| 'food'
	| 'redstone'
	| 'spawn_eggs'
	| 'decorations'
	| 'materials'
	| 'misc';

export interface LoadedImageInfo {
	path: string;
	blobUrl: string | null;
	versionTag: VersionTag;
	imageSet: ImageSource;
}

export interface HistoryEntry {
	version: VersionTag;
	filename: string;
	blobUrl: string | null;
	imageSet: ImageSource;
}

export interface ItemIndexEntry {
	slug: string;
	displayName: string;
	category: ItemCategory;
	latestVersion: VersionTag;
	firstSeen: VersionTag;
	removed: boolean;
	historyCount: number;
}

export interface ItemsIndexJson {
	[filename: string]: ItemIndexEntry;
}

export interface RemovedArchiveEntry {
	lastSeen: VersionTag;
	removedIn: VersionTag;
}

export interface RemovedArchiveJson {
	[filename: string]: RemovedArchiveEntry;
}

export interface VersionProcessingResult {
	versionTag: VersionTag;
	processed: boolean;
	added: string[];
	modified: string[];
	removed: string[];
	manifestImages: string[];
	error: string | null;
}

export interface VersionsIndexJson {
	versions: VersionTag[];
	base: VersionTag | null;
}

export interface GalleryDerivedState {
	allItems: string[];
	displayedItems: string[];
	loadedImages: Map<string, LoadedImageInfo>;
	imageDataCache: Map<string, Blob>;
	itemHistory: Map<string, HistoryEntry[]>;
	markedAsRemoved: Set<string>;
}

export type SortMode = 'az' | 'za' | 'version' | 'length';

export type ParticleKind = 'static' | 'strip' | 'sequence';

export interface ParticleMeta {
	id: string;
	displayFile: string;
	displayName: string;
	animated: boolean;
	frameCount: number;
	frameSize: number;
	kind: ParticleKind;
	frameFiles?: string[];
}

export interface ParticleManifestJson {
	version: VersionTag;
	isBase?: boolean;
	particles: ParticleMeta[];
}

export interface LoadedParticleInfo {
	path: string;
	blobUrl: string | null;
	versionTag: VersionTag;
	displayFile: string;
	meta: ParticleMeta;
}

export interface ParticleHistoryEntry {
	version: VersionTag;
	particleId: string;
	displayFile: string;
	blobUrl: string | null;
}

export interface ParticleProcessingResult {
	versionTag: VersionTag;
	processed: boolean;
	added: string[];
	modified: string[];
	removed: string[];
	manifestParticles: ParticleMeta[];
	error: string | null;
}

export interface ParticleGalleryDerivedState {
	allParticles: string[];
	displayedParticles: string[];
	loadedParticles: Map<string, LoadedParticleInfo>;
	imageDataCache: Map<string, Blob>;
	particleHistory: Map<string, ParticleHistoryEntry[]>;
	particleMeta: Map<string, ParticleMeta>;
	markedAsRemoved: Set<string>;
}

export interface ProgressState {
	text: string;
	percent: number | null;
	isError?: boolean;
}


