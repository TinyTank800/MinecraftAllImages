"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import saveAs from 'file-saver';
import { categorizeItem, type ItemCategory } from '@/lib/categories';
import {
	catalogForSource,
	clampVersionChoice,
	IMAGE_SOURCE_HINTS,
	imagesRootPath,
	parseVersionsIndex,
	readImageSourcePref,
	type VersionCatalog,
} from '@/lib/image-source';
import { altTextForItem, formatItemName } from '@/lib/slug';
import { buildVersionPath, compareVersions } from '@/lib/versioning';
import { blobCacheKey, loadVersionZip, resolveImageUrl, revokeBlobUrls } from '@/lib/zip';
import {
	buildShareSelectionParams,
	loadSelectionIndex,
	parseSelectionFromSearchParams,
} from '@/lib/share-selection';
import type {
	GalleryDerivedState,
	HistoryEntry,
	ImageSource,
	LoadedImageInfo,
	ProgressState,
	SortMode,
	VersionProcessingResult,
	VersionTag,
	VersionsIndexJson,
} from '@/lib/types';

const EMPTY_CATALOG: VersionCatalog = { versions: [], base: null };

function parseSelectionFromUrl(index: string[]): Set<string> {
	return parseSelectionFromSearchParams(new URL(window.location.href).searchParams, index);
}

function readShowRemovedPref(removedOnly?: boolean): boolean {
	if (removedOnly) return true;
	if (typeof window === 'undefined') return false;
	try {
		return localStorage.getItem('showRemovedItems') === 'true';
	} catch {
		return false;
	}
}

export function useGalleryData(options?: { initialCategory?: ItemCategory | null; removedOnly?: boolean }) {
	const removedOnly = Boolean(options?.removedOnly);
	const [v1Catalog, setV1Catalog] = useState<VersionCatalog>(EMPTY_CATALOG);
	const [v2Catalog, setV2Catalog] = useState<VersionCatalog>(EMPTY_CATALOG);
	const [currentVersion, setCurrentVersion] = useState<VersionTag>('latest');
	const [sortMode, setSortMode] = useState<SortMode>('az');
	const [searchTerm, setSearchTerm] = useState<string>('');
	const [categoryFilter, setCategoryFilter] = useState<ItemCategory | null>(options?.initialCategory ?? null);
	const [showRemovedItems, setShowRemovedItems] = useState<boolean>(() => readShowRemovedPref(removedOnly));
	const [markedAsRemoved, setMarkedAsRemoved] = useState<Set<string>>(() => new Set());
	const [imageSource, setImageSourceState] = useState<ImageSource>(() => readImageSourcePref());
	const [progress, setProgress] = useState<ProgressState>({ text: '', percent: null });
	const [palettes, setPalettes] = useState<Record<string, string[]>>({});
	const [itemNames, setItemNames] = useState<Record<string, string>>({});

	const loadedImagesRef = useRef<Map<string, LoadedImageInfo>>(new Map());
	const imageDataCacheRef = useRef<Map<string, Blob>>(new Map());
	const blobUrlsRef = useRef<Map<string, string>>(new Map());
	const itemHistoryRef = useRef<Map<string, HistoryEntry[]>>(new Map());
	const markedAsRemovedRef = useRef<Set<string>>(new Set());
	const categoryMapRef = useRef<Map<string, ItemCategory>>(new Map());
	const selectionIndexRef = useRef<string[]>([]);
	const [selectedItems, setSelectedItems] = useState<Set<string>>(() => new Set());

	const [allItems, setAllItems] = useState<string[]>([]);
	const [displayedItems, setDisplayedItems] = useState<string[]>([]);

	const activeCatalog = useMemo(
		() => catalogForSource(imageSource, v1Catalog, v2Catalog),
		[imageSource, v1Catalog, v2Catalog],
	);
	const availableVersions = activeCatalog.versions;
	const baseVersion = activeCatalog.base;

	const setLoadingProgress = useCallback((text: string, percent: number | null = null, isError = false) => {
		setProgress({ text, percent, isError });
	}, []);

	const makeInfo = useCallback((version: VersionTag, filename: string, set: ImageSource): LoadedImageInfo => {
		const { path, blobUrl } = resolveImageUrl(
			imageDataCacheRef.current,
			blobUrlsRef.current,
			set,
			version,
			filename,
		);
		return { path, blobUrl, versionTag: version, imageSet: set };
	}, []);

	const makeHistoryEntry = useCallback((version: VersionTag, filename: string, set: ImageSource): HistoryEntry => {
		const { blobUrl } = resolveImageUrl(
			imageDataCacheRef.current,
			blobUrlsRef.current,
			set,
			version,
			filename,
		);
		return { version, filename, blobUrl, imageSet: set };
	}, []);

	useEffect(() => {
		void loadSelectionIndex().then((items) => {
			selectionIndexRef.current = items;
			setSelectedItems(parseSelectionFromUrl(items));
		});
	}, []);

	useEffect(() => {
		(async () => {
			setLoadingProgress('Loading versions...', 5);
			const res = await fetch(`/images/versions.json?t=${Date.now()}`);
			if (!res.ok) {
				setLoadingProgress('Error loading versions.json', null, true);
				return;
			}
			const v1Data = parseVersionsIndex((await res.json()) as VersionsIndexJson);
			setV1Catalog(v1Data);

			let v2Data = EMPTY_CATALOG;
			try {
				const v2Res = await fetch('/images-v2/versions.json');
				if (v2Res.ok) {
					v2Data = parseVersionsIndex((await v2Res.json()) as VersionsIndexJson);
				}
			} catch {}
			setV2Catalog(v2Data);

			const url = new URL(window.location.href);
			const imgParam = url.searchParams.get('images');
			const source: ImageSource =
				imgParam === 'v2' || imgParam === 'v1' ? imgParam : readImageSourcePref();
			setImageSourceState(source);

			const catalog = catalogForSource(source, v1Data, v2Data);
			const qp = url.searchParams.get('version');
			const saved = localStorage.getItem('selectedVersion');
			let initial: VersionTag = 'latest';
			if (qp && (qp === 'latest' || catalog.versions.includes(qp))) initial = qp;
			else if (saved && (saved === 'latest' || catalog.versions.includes(saved))) initial = saved;
			setCurrentVersion(initial);

			try {
				const palRes = await fetch('/metadata/palettes.json');
				if (palRes.ok) setPalettes((await palRes.json()) as Record<string, string[]>);
			} catch {}

			try {
				const namesRes = await fetch('/metadata/item-names.json');
				if (namesRes.ok) setItemNames((await namesRes.json()) as Record<string, string>);
			} catch {}
		})();
	}, [setLoadingProgress]);

	useEffect(() => {
		if (!removedOnly) {
			localStorage.setItem('showRemovedItems', String(showRemovedItems));
		}
	}, [showRemovedItems, removedOnly]);

	useEffect(() => {
		localStorage.setItem('imageSource', imageSource);
	}, [imageSource]);

	useEffect(() => {
		setCurrentVersion((prev) => clampVersionChoice(prev, activeCatalog));
	}, [imageSource, activeCatalog]);

	useEffect(() => {
		if (imageSource === 'v2' && availableVersions.length === 0) {
			setAllItems([]);
			setDisplayedItems([]);
			setLoadingProgress(
				'No enhanced versions yet. Export with /itemgallery export, then package with --set v2.',
				null,
				true,
			);
			return;
		}
		if (!baseVersion || availableVersions.length === 0) return;
		void reloadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentVersion, showRemovedItems, baseVersion, availableVersions, imageSource]);

	const computeDisplayed = useCallback(
		(items: string[], term: string, mode: SortMode, category: ItemCategory | null) => {
			const sorted = items.slice().sort((a, b) => {
				const nameA = formatItemName(a, itemNames);
				const nameB = formatItemName(b, itemNames);
				if (mode === 'version') {
					const aInfo = loadedImagesRef.current.get(a);
					const bInfo = loadedImagesRef.current.get(b);
					const aTag = aInfo ? aInfo.versionTag : baseVersion || '0.0.0';
					const bTag = bInfo ? bInfo.versionTag : baseVersion || '0.0.0';
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
				filtered = filtered.filter((f) => formatItemName(f, itemNames).toLowerCase().includes(term.toLowerCase()));
			}
			if (category) {
				filtered = filtered.filter((f) => categoryMapRef.current.get(f) === category);
			}
			if (removedOnly) {
				filtered = filtered.filter((f) => markedAsRemovedRef.current.has(f));
			}
			setDisplayedItems(filtered);
		},
		[baseVersion, removedOnly, itemNames],
	);

	const reloadData = useCallback(async () => {
		if (!baseVersion || availableVersions.length === 0) return;
		setLoadingProgress('Loading item data...', 10);

		revokeBlobUrls(blobUrlsRef.current);
		loadedImagesRef.current.clear();
		imageDataCacheRef.current.clear();
		itemHistoryRef.current.clear();
		markedAsRemovedRef.current.clear();
		categoryMapRef.current.clear();

		const imagesRoot = imagesRootPath(imageSource);
		const target: VersionTag = currentVersion === 'latest' ? availableVersions[0] : currentVersion;
		const versionPath = buildVersionPath(availableVersions, baseVersion, target);

		const loadTasks: Promise<VersionProcessingResult>[] = [];
		for (const v of versionPath) {
			loadTasks.push(
				loadVersionZip(v, v === baseVersion, imageDataCacheRef.current, imagesRoot),
			);
		}
		const results = await Promise.all(loadTasks);

		const baseRes = results.find((r) => r.versionTag === baseVersion && r.processed);
		if (!baseRes) {
			setLoadingProgress(`Base version (${baseVersion}) failed to load`, null, true);
			return;
		}

		for (const fname of baseRes.manifestImages) {
			loadedImagesRef.current.set(fname, makeInfo(baseVersion, fname, imageSource));
			itemHistoryRef.current.set(fname, [makeHistoryEntry(baseVersion, fname, imageSource)]);
			categoryMapRef.current.set(fname, categorizeItem(fname));
		}

		const keepRemoved = showRemovedItems || removedOnly;

		for (const v of versionPath) {
			if (v === baseVersion) continue;
			const res = results.find((r) => r.versionTag === v && r.processed);
			if (!res) continue;

			for (const modified of res.modified) {
				markedAsRemovedRef.current.delete(modified);
				loadedImagesRef.current.set(modified, makeInfo(v, modified, imageSource));
				const hist = itemHistoryRef.current.get(modified) || [];
				hist.push(makeHistoryEntry(v, modified, imageSource));
				itemHistoryRef.current.set(modified, hist);
				if (!categoryMapRef.current.has(modified)) categoryMapRef.current.set(modified, categorizeItem(modified));
			}
			for (const added of res.added) {
				markedAsRemovedRef.current.delete(added);
				loadedImagesRef.current.set(added, makeInfo(v, added, imageSource));
				const hist = itemHistoryRef.current.get(added) || [];
				hist.push(makeHistoryEntry(v, added, imageSource));
				itemHistoryRef.current.set(added, hist.length ? hist : [makeHistoryEntry(v, added, imageSource)]);
				categoryMapRef.current.set(added, categorizeItem(added));
			}
			for (const removed of res.removed) {
				markedAsRemovedRef.current.add(removed);
				if (keepRemoved) {
					if (!loadedImagesRef.current.has(removed)) {
						const hist = itemHistoryRef.current.get(removed);
						const last = hist?.[hist.length - 1];
						if (last) {
							loadedImagesRef.current.set(removed, makeInfo(last.version, removed, last.imageSet));
						}
					}
				} else {
					loadedImagesRef.current.delete(removed);
				}
			}
		}

		const items = Array.from(loadedImagesRef.current.keys());
		setMarkedAsRemoved(new Set(markedAsRemovedRef.current));
		setAllItems(items);
		computeDisplayed(items, searchTerm, sortMode, categoryFilter);
		setLoadingProgress('Done!', 100);
	}, [
		availableVersions,
		baseVersion,
		categoryFilter,
		currentVersion,
		computeDisplayed,
		imageSource,
		makeHistoryEntry,
		makeInfo,
		removedOnly,
		searchTerm,
		showRemovedItems,
		sortMode,
		setLoadingProgress,
	]);

	useEffect(() => {
		computeDisplayed(allItems, searchTerm, sortMode, categoryFilter);
	}, [allItems, searchTerm, sortMode, categoryFilter, computeDisplayed]);

	const toggleSelect = useCallback((filename: string) => {
		setSelectedItems((prev) => {
			const next = new Set(prev);
			if (next.has(filename)) next.delete(filename);
			else next.add(filename);
			return next;
		});
	}, []);

	const clearSelection = useCallback(() => setSelectedItems(new Set()), []);

	const selectVisible = useCallback(() => {
		setSelectedItems((prev) => {
			const next = new Set(prev);
			for (const f of displayedItems) next.add(f);
			return next;
		});
	}, [displayedItems]);

	const shareSelection = useCallback(() => {
		if (selectedItems.size === 0) return;
		const url = new URL(window.location.href);
		url.searchParams.delete('sel');
		url.searchParams.delete('selc');
		const params = buildShareSelectionParams(
			selectedItems,
			selectionIndexRef.current.length > 0 ? selectionIndexRef.current : null,
		);
		if (params.selc) url.searchParams.set('selc', params.selc);
		else if (params.sel) url.searchParams.set('sel', params.sel);
		void navigator.clipboard.writeText(url.toString());
	}, [selectedItems]);

	const downloadItemsAsZip = useCallback(async (files: string[], zipName: string) => {
		const JSZip = (await import('jszip')).default;
		const zip = new JSZip();
		let added = 0;
		for (const f of files) {
			const info = loadedImagesRef.current.get(f);
			const key = info ? blobCacheKey(info.imageSet, info.versionTag, f) : f;
			const blob = imageDataCacheRef.current.get(key);
			if (blob) {
				zip.file(f, blob);
				added++;
			}
		}
		if (added === 0) throw new Error('No valid image data');
		const blob = await zip.generateAsync({ type: 'blob', streamFiles: true, compression: 'STORE' }, (meta) => {
			setLoadingProgress(`Zipping: ${meta.percent.toFixed(0)}%`, meta.percent);
		});
		saveAs(blob, zipName);
		setLoadingProgress('Done!', 100);
	}, [setLoadingProgress]);

	const downloadSingleItem = useCallback(
		async (baseFilename: string, version?: VersionTag, downloadName?: string) => {
			const info = loadedImagesRef.current.get(baseFilename);
			const v = version ?? info?.versionTag;
			const finalName = downloadName || baseFilename;
			if (!v) throw new Error(`No version for ${baseFilename}`);
			const set = info?.imageSet ?? imageSource;
			const key = blobCacheKey(set, v, baseFilename);
			let blob = imageDataCacheRef.current.get(key);
			if (!blob) {
				setLoadingProgress(`Fetching ${finalName}...`, 50);
				const root = imagesRootPath(set);
				const resp = await fetch(`/${root}/${v}/${baseFilename}`);
				if (!resp.ok) throw new Error(`Failed to fetch /${root}/${v}/${baseFilename}`);
				blob = await resp.blob();
			}
			saveAs(blob, finalName);
			setLoadingProgress('Done!', 100);
		},
		[imageSource, setLoadingProgress],
	);

	const formatItemNameFor = useCallback(
		(filename: string) => formatItemName(filename, itemNames),
		[itemNames],
	);

	const getAltText = useCallback((filename: string) => {
		const info = loadedImagesRef.current.get(filename);
		return altTextForItem(formatItemNameFor(filename), info?.versionTag ?? currentVersion);
	}, [currentVersion, formatItemNameFor]);

	const getCategory = useCallback((filename: string) => categoryMapRef.current.get(filename) ?? null, []);

	const getPalette = useCallback((filename: string) => palettes[filename] ?? [], [palettes]);

	const state = useMemo<GalleryDerivedState>(
		() => ({
			allItems,
			displayedItems,
			loadedImages: loadedImagesRef.current,
			imageDataCache: imageDataCacheRef.current,
			itemHistory: itemHistoryRef.current,
			markedAsRemoved,
		}),
		[allItems, displayedItems, markedAsRemoved],
	);

	return {
		availableVersions,
		baseVersion,
		currentVersion,
		sortMode,
		searchTerm,
		categoryFilter,
		showRemovedItems,
		imageSource,
		imageSourceHint: IMAGE_SOURCE_HINTS[imageSource],
		progress,
		state,
		selectedItems,
		setCurrentVersion: (v: VersionTag) => {
			const next = clampVersionChoice(v, activeCatalog);
			localStorage.setItem('selectedVersion', next);
			const url = new URL(window.location.href);
			url.searchParams.set('version', next);
			window.history.pushState({ version: next }, '', url);
			setCurrentVersion(next);
		},
		setSortMode: (m: SortMode) => {
			setSortMode(m);
			computeDisplayed(allItems, searchTerm, m, categoryFilter);
		},
		setSearchTerm: (s: string) => {
			setSearchTerm(s);
			computeDisplayed(allItems, s, sortMode, categoryFilter);
		},
		setCategoryFilter: (c: ItemCategory | null) => {
			setCategoryFilter(c);
			computeDisplayed(allItems, searchTerm, sortMode, c);
		},
		setShowRemovedItems,
		setImageSource: (source: ImageSource) => {
			setImageSourceState(source);
			const catalog = catalogForSource(source, v1Catalog, v2Catalog);
			setCurrentVersion((prev) => clampVersionChoice(prev, catalog));
			const url = new URL(window.location.href);
			if (source === 'v1') url.searchParams.delete('images');
			else url.searchParams.set('images', 'v2');
			window.history.replaceState({}, '', url);
		},
		reloadData,
		toggleSelect,
		clearSelection,
		selectVisible,
		shareSelection,
		downloadItemsAsZip,
		downloadSingleItem,
		formatItemName: formatItemNameFor,
		getAltText,
		getCategory,
		getPalette,
	};
}
