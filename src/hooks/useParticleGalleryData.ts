"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import saveAs from 'file-saver';
import { safePushState } from '@/lib/safe-history';
import {
	loadLooseParticleManifest,
	loadParticleVersionZip,
	particleBlobCacheKey,
	resolveParticleAssetUrl,
	revokeParticleBlobUrls,
} from '@/lib/particle-zip';
import {
	buildShareSelectionParams,
	decodeSelectionBitset,
} from '@/lib/share-selection';
import { altTextForParticle, formatParticleName } from '@/lib/particles';
import { buildVersionPath, compareVersions } from '@/lib/versioning';
import type {
	LoadedParticleInfo,
	ParticleGalleryDerivedState,
	ParticleHistoryEntry,
	ParticleMeta,
	ProgressState,
	SortMode,
	VersionTag,
	VersionsIndexJson,
} from '@/lib/types';

function parseParticleSelection(index: string[]): Set<string> {
	const params = new URLSearchParams(window.location.search);
	const compact = params.get('selpc');
	if (compact) return decodeSelectionBitset(compact, index);
	const plain = params.get('selp');
	if (!plain) return new Set();
	return new Set(
		plain
			.split(',')
			.map((s) => s.trim().replace(/-/g, '_'))
			.filter(Boolean),
	);
}

async function loadParticleSelectionIndex(): Promise<string[]> {
	try {
		const res = await fetch('/particles/selection-index.json');
		if (!res.ok) return [];
		const data = (await res.json()) as { items?: string[] };
		return Array.isArray(data.items) ? data.items : [];
	} catch {
		return [];
	}
}

export function useParticleGalleryData() {
	const [availableVersions, setAvailableVersions] = useState<VersionTag[]>([]);
	const [baseVersion, setBaseVersion] = useState<VersionTag | null>(null);
	const [currentVersion, setCurrentVersion] = useState<VersionTag>('latest');
	const [sortMode, setSortMode] = useState<SortMode>('az');
	const [searchTerm, setSearchTerm] = useState('');
	const [showRemovedItems, setShowRemovedItems] = useState(false);
	const [progress, setProgress] = useState<ProgressState>({ text: '', percent: null });
	const [markedAsRemoved, setMarkedAsRemoved] = useState<Set<string>>(() => new Set());
	const [selectedParticles, setSelectedParticles] = useState<Set<string>>(() => new Set());
	const [allParticles, setAllParticles] = useState<string[]>([]);
	const [displayedParticles, setDisplayedParticles] = useState<string[]>([]);

	const loadedParticlesRef = useRef<Map<string, LoadedParticleInfo>>(new Map());
	const particleMetaRef = useRef<Map<string, ParticleMeta>>(new Map());
	const imageDataCacheRef = useRef<Map<string, Blob>>(new Map());
	const blobUrlsRef = useRef<Map<string, string>>(new Map());
	const particleHistoryRef = useRef<Map<string, ParticleHistoryEntry[]>>(new Map());
	const markedAsRemovedRef = useRef<Set<string>>(new Set());
	const selectionIndexRef = useRef<string[]>([]);

	const setLoadingProgress = useCallback((text: string, percent: number | null = null, isError = false) => {
		setProgress({ text, percent, isError });
	}, []);

	const makeInfo = useCallback((version: VersionTag, meta: ParticleMeta): LoadedParticleInfo => {
		const { path, blobUrl } = resolveParticleAssetUrl(
			imageDataCacheRef.current,
			blobUrlsRef.current,
			version,
			meta.displayFile,
		);
		return { path, blobUrl, versionTag: version, displayFile: meta.displayFile, meta };
	}, []);

	const makeHistoryEntry = useCallback((version: VersionTag, meta: ParticleMeta): ParticleHistoryEntry => {
		const { blobUrl } = resolveParticleAssetUrl(
			imageDataCacheRef.current,
			blobUrlsRef.current,
			version,
			meta.displayFile,
		);
		return { version, particleId: meta.id, displayFile: meta.displayFile, blobUrl };
	}, []);

	const metaById = useCallback((results: { manifestParticles: ParticleMeta[] }[], version: VersionTag, id: string) => {
		for (const res of results) {
			if (res.manifestParticles.length === 0) continue;
			const found = res.manifestParticles.find((p) => p.id === id);
			if (found) return found;
		}
		return particleMetaRef.current.get(id) ?? null;
	}, []);

	useEffect(() => {
		void loadParticleSelectionIndex().then((items) => {
			selectionIndexRef.current = items;
			setSelectedParticles(parseParticleSelection(items));
		});
	}, []);

	useEffect(() => {
		void (async () => {
			setLoadingProgress('Loading versions...', 5);
			const res = await fetch('/particles/versions.json');
			if (!res.ok) {
				setLoadingProgress('No particle data packaged yet.', null, true);
				return;
			}
			const data = (await res.json()) as VersionsIndexJson;
			setAvailableVersions(data.versions || []);
			setBaseVersion(data.base);

			const qp = new URL(window.location.href).searchParams.get('version');
			const saved = localStorage.getItem('selectedParticleVersion');
			let initial: VersionTag = 'latest';
			if (qp && (qp === 'latest' || data.versions?.includes(qp))) initial = qp;
			else if (saved && (saved === 'latest' || data.versions?.includes(saved))) initial = saved;
			setCurrentVersion(initial);
		})();
	}, [setLoadingProgress]);

	useEffect(() => {
		if (!baseVersion || availableVersions.length === 0) return;
		void reloadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentVersion, showRemovedItems, baseVersion, availableVersions]);

	const computeDisplayed = useCallback(
		(ids: string[], term: string, mode: SortMode) => {
			const sorted = ids.slice().sort((a, b) => {
				const metaA = particleMetaRef.current.get(a);
				const metaB = particleMetaRef.current.get(b);
				const nameA = formatParticleName(a, metaA);
				const nameB = formatParticleName(b, metaB);
				if (mode === 'version') {
					const aInfo = loadedParticlesRef.current.get(a);
					const bInfo = loadedParticlesRef.current.get(b);
					const aTag = aInfo?.versionTag ?? baseVersion ?? '0.0.0';
					const bTag = bInfo?.versionTag ?? baseVersion ?? '0.0.0';
					const cmp = compareVersions(bTag, aTag);
					return cmp === 0 ? nameA.localeCompare(nameB) : cmp;
				}
				if (mode === 'length') {
					const diff = nameB.length - nameA.length;
					return diff === 0 ? nameA.localeCompare(nameB) : diff;
				}
				return mode === 'za' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
			});
			let filtered = sorted;
			if (term) {
				const lower = term.toLowerCase();
				filtered = filtered.filter((id) => {
					const meta = particleMetaRef.current.get(id);
					const name = formatParticleName(id, meta).toLowerCase();
					return name.includes(lower) || id.toLowerCase().includes(lower);
				});
			}
			setDisplayedParticles(filtered);
		},
		[baseVersion],
	);

	const reloadData = useCallback(async () => {
		if (!baseVersion || availableVersions.length === 0) return;
		setLoadingProgress('Loading particle data...', 10);

		revokeParticleBlobUrls(blobUrlsRef.current);
		loadedParticlesRef.current.clear();
		imageDataCacheRef.current.clear();
		particleHistoryRef.current.clear();
		particleMetaRef.current.clear();
		markedAsRemovedRef.current.clear();

		const target: VersionTag = currentVersion === 'latest' ? availableVersions[0] : currentVersion;
		const versionPath = buildVersionPath(availableVersions, baseVersion, target);

		const results = await Promise.all(
			versionPath.map((v) => loadParticleVersionZip(v, v === baseVersion, imageDataCacheRef.current)),
		);

		let baseRes = results.find((r) => r.versionTag === baseVersion && r.processed);
		if (!baseRes?.manifestParticles.length) {
			const loose = await loadLooseParticleManifest(baseVersion);
			if (loose?.length) {
				baseRes = {
					versionTag: baseVersion,
					processed: true,
					added: [],
					modified: [],
					removed: [],
					manifestParticles: loose,
					error: null,
				};
			}
		}

		if (!baseRes?.manifestParticles.length) {
			setLoadingProgress(`Base version (${baseVersion}) failed to load`, null, true);
			return;
		}

		for (const meta of baseRes.manifestParticles) {
			particleMetaRef.current.set(meta.id, meta);
			loadedParticlesRef.current.set(meta.id, makeInfo(baseVersion, meta));
			particleHistoryRef.current.set(meta.id, [makeHistoryEntry(baseVersion, meta)]);
		}

		for (const v of versionPath) {
			if (v === baseVersion) continue;
			const res = results.find((r) => r.versionTag === v && r.processed);
			if (!res) continue;

			const applyMeta = (meta: ParticleMeta) => {
				markedAsRemovedRef.current.delete(meta.id);
				particleMetaRef.current.set(meta.id, meta);
				loadedParticlesRef.current.set(meta.id, makeInfo(v, meta));
				const hist = particleHistoryRef.current.get(meta.id) || [];
				hist.push(makeHistoryEntry(v, meta));
				particleHistoryRef.current.set(meta.id, hist);
			};

			for (const id of res.modified) {
				const meta = res.manifestParticles.find((p) => p.id === id) ?? metaById(results, v, id);
				if (meta) applyMeta(meta);
			}
			for (const id of res.added) {
				const meta = res.manifestParticles.find((p) => p.id === id) ?? metaById(results, v, id);
				if (meta) applyMeta(meta);
			}
			for (const id of res.removed) {
				markedAsRemovedRef.current.add(id);
				if (showRemovedItems) {
					if (!loadedParticlesRef.current.has(id)) {
						const hist = particleHistoryRef.current.get(id);
						const last = hist?.[hist.length - 1];
						if (last) {
							const meta = particleMetaRef.current.get(id);
							if (meta) loadedParticlesRef.current.set(id, makeInfo(last.version, meta));
						}
					}
				} else {
					loadedParticlesRef.current.delete(id);
				}
			}
		}

		const ids = Array.from(loadedParticlesRef.current.keys());
		setMarkedAsRemoved(new Set(markedAsRemovedRef.current));
		setAllParticles(ids);
		computeDisplayed(ids, searchTerm, sortMode);
		setLoadingProgress('Done!', 100);
	}, [
		availableVersions,
		baseVersion,
		computeDisplayed,
		currentVersion,
		makeHistoryEntry,
		makeInfo,
		metaById,
		searchTerm,
		showRemovedItems,
		sortMode,
		setLoadingProgress,
	]);

	useEffect(() => {
		computeDisplayed(allParticles, searchTerm, sortMode);
	}, [allParticles, searchTerm, sortMode, computeDisplayed]);

	const toggleSelect = useCallback((id: string) => {
		setSelectedParticles((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const clearSelection = useCallback(() => setSelectedParticles(new Set()), []);

	const selectVisible = useCallback(() => {
		setSelectedParticles((prev) => {
			const next = new Set(prev);
			for (const id of displayedParticles) next.add(id);
			return next;
		});
	}, [displayedParticles]);

	const shareSelection = useCallback(() => {
		if (selectedParticles.size === 0) return;
		const url = new URL(window.location.href);
		url.searchParams.delete('selp');
		url.searchParams.delete('selpc');
		const params = buildShareSelectionParams(
			selectedParticles,
			selectionIndexRef.current.length > 0 ? selectionIndexRef.current : null,
		);
		if (params.selc) url.searchParams.set('selpc', params.selc);
		else if (params.sel) url.searchParams.set('selp', params.sel);
		else {
			url.searchParams.set(
				'selp',
				Array.from(selectedParticles)
					.map((id) => id.replace(/_/g, '-'))
					.join(','),
			);
		}
		void navigator.clipboard.writeText(url.toString());
	}, [selectedParticles]);

	const fetchAssetBlob = useCallback(
		async (version: VersionTag, relativePath: string) => {
			const key = particleBlobCacheKey(version, relativePath);
			let blob = imageDataCacheRef.current.get(key);
			if (blob) return blob;
			const resp = await fetch(`/particles/${version}/${relativePath}`);
			if (!resp.ok) throw new Error(`Failed to fetch /particles/${version}/${relativePath}`);
			blob = await resp.blob();
			imageDataCacheRef.current.set(key, blob);
			return blob;
		},
		[],
	);

	const downloadParticlesAsZip = useCallback(
		async (ids: string[], zipName: string) => {
			const JSZip = (await import('jszip')).default;
			const zip = new JSZip();
			let added = 0;
			for (const id of ids) {
				const info = loadedParticlesRef.current.get(id);
				if (!info) continue;
				try {
					const blob = await fetchAssetBlob(info.versionTag, info.displayFile);
					zip.file(info.displayFile, blob);
					added++;
				} catch {}
			}
			if (added === 0) throw new Error('No valid particle data');
			const blob = await zip.generateAsync({ type: 'blob', streamFiles: true, compression: 'STORE' }, (meta) => {
				setLoadingProgress(`Zipping: ${meta.percent.toFixed(0)}%`, meta.percent);
			});
			saveAs(blob, zipName);
			setLoadingProgress('Done!', 100);
		},
		[fetchAssetBlob, setLoadingProgress],
	);

	const downloadDisplayFile = useCallback(
		async (id: string, version?: VersionTag, downloadName?: string) => {
			const info = loadedParticlesRef.current.get(id);
			const meta = particleMetaRef.current.get(id);
			const v = version ?? info?.versionTag;
			const file = meta?.displayFile ?? info?.displayFile;
			if (!v || !file) throw new Error(`No version for ${id}`);
			const blob = await fetchAssetBlob(v, file);
			saveAs(blob, downloadName || file);
			setLoadingProgress('Done!', 100);
		},
		[fetchAssetBlob, setLoadingProgress],
	);

	const downloadFrameFiles = useCallback(
		async (id: string, version?: VersionTag) => {
			const info = loadedParticlesRef.current.get(id);
			const meta = particleMetaRef.current.get(id);
			const v = version ?? info?.versionTag;
			const frames = meta?.frameFiles ?? [];
			if (!v || frames.length === 0) throw new Error('No frame files');
			const JSZip = (await import('jszip')).default;
			const zip = new JSZip();
			for (const frame of frames) {
				const blob = await fetchAssetBlob(v, frame);
				zip.file(pathBasename(frame), blob);
			}
			const blob = await zip.generateAsync({ type: 'blob' });
			saveAs(blob, `${formatParticleName(id, meta)}_frames_${v}.zip`);
			setLoadingProgress('Done!', 100);
		},
		[fetchAssetBlob, setLoadingProgress],
	);

	const formatName = useCallback(
		(id: string) => formatParticleName(id, particleMetaRef.current.get(id)),
		[],
	);

	const getAltText = useCallback(
		(id: string) => {
			const info = loadedParticlesRef.current.get(id);
			return altTextForParticle(formatName(id), info?.versionTag ?? currentVersion);
		},
		[currentVersion, formatName],
	);

	const getMeta = useCallback((id: string) => particleMetaRef.current.get(id) ?? null, []);

	const state = useMemo<ParticleGalleryDerivedState>(
		() => ({
			allParticles,
			displayedParticles,
			loadedParticles: loadedParticlesRef.current,
			imageDataCache: imageDataCacheRef.current,
			particleHistory: particleHistoryRef.current,
			particleMeta: particleMetaRef.current,
			markedAsRemoved,
		}),
		[allParticles, displayedParticles, markedAsRemoved],
	);

	return {
		availableVersions,
		baseVersion,
		currentVersion,
		sortMode,
		searchTerm,
		showRemovedItems,
		progress,
		state,
		selectedParticles,
		setCurrentVersion: (v: VersionTag) => {
			const next = v === 'latest' || availableVersions.includes(v) ? v : 'latest';
			localStorage.setItem('selectedParticleVersion', next);
			const url = new URL(window.location.href);
			url.searchParams.set('version', next);
			setCurrentVersion(next);
			safePushState({ version: next }, url);
		},
		setSortMode: (m: SortMode) => {
			setSortMode(m);
			computeDisplayed(allParticles, searchTerm, m);
		},
		setSearchTerm: (s: string) => {
			setSearchTerm(s);
			computeDisplayed(allParticles, s, sortMode);
		},
		setShowRemovedItems,
		toggleSelect,
		clearSelection,
		selectVisible,
		shareSelection,
		downloadParticlesAsZip,
		downloadDisplayFile,
		downloadFrameFiles,
		formatName,
		getAltText,
		getMeta,
	};
}

function pathBasename(p: string): string {
	const parts = p.replace(/\\/g, '/').split('/');
	return parts[parts.length - 1] || p;
}
