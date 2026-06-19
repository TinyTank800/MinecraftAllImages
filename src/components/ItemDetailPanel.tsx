"use client";

import { useEffect, useMemo, useState } from 'react';
import type { HistoryEntry } from '@/lib/types';
import { CompareSlider } from './CompareSlider';
import { PaletteSwatches } from './PaletteSwatches';
import { filenameToSlug } from '@/lib/slug';
import { imagesRootPath } from '@/lib/image-source';

function historyImageSrc(entry: HistoryEntry): string {
	const root = imagesRootPath(entry.imageSet);
	return entry.blobUrl ?? `/${root}/${entry.version}/${entry.filename}`;
}

export function ItemDetailPanel(props: {
	filename: string;
	currentImagePath: string | null;
	currentVersionTag: string | null;
	history: HistoryEntry[];
	palette: string[];
	formatName: (f: string) => string;
	altText: string;
	onDownloadCurrent: () => void;
	onDownloadHistory: (entry: HistoryEntry) => void;
	onToggleSelect?: (filename: string) => void;
	selected?: boolean;
	/** Hide link when already on the item page */
	showItemPageLink?: boolean;
	layout?: 'modal' | 'page';
}) {
	const {
		filename,
		currentImagePath,
		currentVersionTag,
		history,
		palette,
		formatName,
		altText,
		onDownloadCurrent,
		onDownloadHistory,
		onToggleSelect,
		selected,
		showItemPageLink = true,
		layout = 'modal',
	} = props;

	const name = formatName(filename);
	const slug = filenameToSlug(filename);
	const isPage = layout === 'page';

	const [leftIdx, setLeftIdx] = useState(0);
	const [rightIdx, setRightIdx] = useState(() => Math.max(0, history.length - 1));

	useEffect(() => {
		if (history.length < 2) return;
		setLeftIdx(0);
		setRightIdx(history.length - 1);
	}, [filename, history.length]);

	const leftEntry = history[leftIdx];
	const rightEntry = history[rightIdx];
	const canCompare = history.length >= 2 && leftIdx < rightIdx && leftEntry && rightEntry;

	const sameTexture = useMemo(() => {
		if (!leftEntry || !rightEntry) return false;
		return historyImageSrc(leftEntry) === historyImageSrc(rightEntry);
	}, [leftEntry, rightEntry]);

	const copyFilename = async () => {
		try {
			await navigator.clipboard.writeText(filename);
		} catch {}
	};

	return (
		<div className={isPage ? 'item-detail-panel item-detail-panel--page' : 'item-detail-panel'}>
			{!isPage && currentImagePath && (
				<img
					src={currentImagePath}
					alt={altText}
					className="mx-auto my-3 h-40 w-40 object-contain pixelated border rounded item-detail-thumb"
					style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
					onError={(e) => {
						(e.currentTarget as HTMLImageElement).src = '/assets/missing.svg';
					}}
				/>
			)}

			{!isPage && <h3 className="text-lg font-semibold gradient-text">{name}</h3>}

			{showItemPageLink && (
				<a href={`/items/${slug}`} className="item-page-promo-link">
					View full item page
				</a>
			)}

			<p
				className="text-sm flex items-center gap-2 justify-center flex-wrap"
				style={{ color: 'var(--text-muted)' }}
			>
				<strong style={{ color: 'var(--text)' }}>Filename:</strong>
				<code
					className="px-1 rounded border"
					style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
				>
					{filename}
				</code>
				<button type="button" className="btn btn-ghost py-1 px-2 text-xs" onClick={copyFilename}>
					Copy
				</button>
			</p>

			<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
				<strong style={{ color: 'var(--text)' }}>Source Version:</strong> {currentVersionTag ?? '?'}
			</p>

			<PaletteSwatches colors={palette} />

			{history.length >= 2 && (
				<div className="compare-section">
					<h4 className="mt-3 mb-2 font-semibold text-sm" style={{ color: 'var(--text)' }}>
						Compare versions
					</h4>
					<div className="compare-selectors">
						<label className="compare-select-label">
							<span>Left (older)</span>
							<select
								className="compare-select"
								value={leftIdx}
								onChange={(e) => setLeftIdx(Number(e.target.value))}
							>
								{history.map((entry, i) => (
									<option key={`left-${entry.version}-${i}`} value={i} disabled={i >= rightIdx}>
										{entry.version}
									</option>
								))}
							</select>
						</label>
						<label className="compare-select-label">
							<span>Right (newer)</span>
							<select
								className="compare-select"
								value={rightIdx}
								onChange={(e) => setRightIdx(Number(e.target.value))}
							>
								{history.map((entry, i) => (
									<option key={`right-${entry.version}-${i}`} value={i} disabled={i <= leftIdx}>
										{entry.version}
									</option>
								))}
							</select>
						</label>
					</div>

					{canCompare ? (
						<>
							{sameTexture && (
								<p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
									These versions use the same texture — the slider will look identical on both sides.
								</p>
							)}
							<CompareSlider
								beforeSrc={historyImageSrc(leftEntry)}
								afterSrc={historyImageSrc(rightEntry)}
								beforeLabel={leftEntry.version}
								afterLabel={rightEntry.version}
								alt={name}
							/>
						</>
					) : (
						<p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
							Pick an older version on the left and a newer one on the right.
						</p>
					)}
				</div>
			)}

			<h4 className="mt-3 mb-2 font-semibold" style={{ color: 'var(--text)' }}>
				Version History
			</h4>

			<div
				className="max-h-80 md:max-h-[32rem] overflow-y-auto overflow-x-hidden border rounded p-3 text-left flex flex-col gap-3 item-detail-history"
				style={{ borderColor: 'var(--border)' }}
			>
				{history.length === 0 ? (
					<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
						No history found (likely base version).
					</p>
				) : (
					history
						.slice()
						.reverse()
						.map((entry, idx) => (
							<div key={`${entry.version}-${idx}`} className="flex items-center justify-between gap-2 min-w-0">
								<div className="text-sm flex-1 min-w-0" style={{ color: 'var(--text)' }}>
									<span>Version {entry.version}: </span>
									<code
										className="px-1 rounded border break-all"
										style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
									>
										{entry.filename}
									</code>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<img
										src={historyImageSrc(entry)}
										alt={`${name} in version ${entry.version}`}
										loading="lazy"
										className="h-16 w-16 object-contain pixelated border rounded shrink-0"
										style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
										onError={(e) => {
											(e.currentTarget as HTMLImageElement).src = '/assets/missing.svg';
										}}
									/>
									<button
										type="button"
										className="btn btn-outline py-1 px-2 text-xs"
										onClick={() => onDownloadHistory(entry)}
									>
										Download
									</button>
								</div>
							</div>
						))
				)}
			</div>

			<div className="mt-4 flex justify-center gap-3 flex-wrap">
				<button type="button" className="btn btn-primary" onClick={onDownloadCurrent}>
					Download Current
				</button>
				{onToggleSelect && (
					<button
						type="button"
						className={selected ? 'btn btn-ghost' : 'btn btn-outline'}
						onClick={() => onToggleSelect(filename)}
					>
						{selected ? 'Deselect Item' : 'Select Item'}
					</button>
				)}
			</div>
		</div>
	);
}
