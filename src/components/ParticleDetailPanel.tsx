"use client";

import { useEffect, useMemo, useState } from 'react';
import type { ParticleHistoryEntry, ParticleMeta } from '@/lib/types';
import { CompareSlider } from './CompareSlider';
import { particleKindLabel } from '@/lib/particles';

function historyImageSrc(entry: ParticleHistoryEntry): string {
	return entry.blobUrl ?? `/particles/${entry.version}/${entry.displayFile}`;
}

export function ParticleDetailPanel(props: {
	particleId: string;
	currentImagePath: string | null;
	currentVersionTag: string | null;
	history: ParticleHistoryEntry[];
	meta: ParticleMeta | null;
	formatName: (id: string) => string;
	altText: string;
	onDownloadCurrent: () => void;
	onDownloadHistory: (entry: ParticleHistoryEntry) => void;
	onDownloadFrames: () => void;
	onToggleSelect?: (id: string) => void;
	selected?: boolean;
}) {
	const {
		particleId,
		currentImagePath,
		currentVersionTag,
		history,
		meta,
		formatName,
		altText,
		onDownloadCurrent,
		onDownloadHistory,
		onDownloadFrames,
		onToggleSelect,
		selected,
	} = props;

	const name = formatName(particleId);
	const [leftIdx, setLeftIdx] = useState(0);
	const [rightIdx, setRightIdx] = useState(() => Math.max(0, history.length - 1));

	useEffect(() => {
		if (history.length < 2) return;
		setLeftIdx(0);
		setRightIdx(history.length - 1);
	}, [particleId, history.length]);

	const leftEntry = history[leftIdx];
	const rightEntry = history[rightIdx];
	const canCompare = history.length >= 2 && leftIdx < rightIdx && leftEntry && rightEntry;

	const sameTexture = useMemo(() => {
		if (!leftEntry || !rightEntry) return false;
		return historyImageSrc(leftEntry) === historyImageSrc(rightEntry);
	}, [leftEntry, rightEntry]);

	const copyId = async () => {
		try {
			await navigator.clipboard.writeText(particleId);
		} catch {}
	};

	return (
		<div className="item-detail-panel">
			{currentImagePath && (
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

			<h3 className="text-lg font-semibold gradient-text">{name}</h3>

			<p className="text-sm flex items-center gap-2 justify-center flex-wrap" style={{ color: 'var(--text-muted)' }}>
				<strong style={{ color: 'var(--text)' }}>ID:</strong>
				<code className="px-1 rounded border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
					{particleId}
				</code>
				<button type="button" className="btn btn-ghost py-1 px-2 text-xs" onClick={copyId}>
					Copy
				</button>
			</p>

			{meta && (
				<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
					<strong style={{ color: 'var(--text)' }}>Type:</strong>{' '}
					{particleKindLabel(meta.kind, meta.animated, meta.frameCount)}
					{meta.frameSize ? ` · ${meta.frameSize}×${meta.frameSize}px` : ''}
				</p>
			)}

			<p className="text-sm" style={{ color: 'var(--text-muted)' }}>
				<strong style={{ color: 'var(--text)' }}>Source Version:</strong> {currentVersionTag ?? '?'}
			</p>

			{history.length >= 2 && (
				<div className="compare-section">
					<h4 className="mt-3 mb-2 font-semibold text-sm" style={{ color: 'var(--text)' }}>
						Compare versions
					</h4>
					<div className="compare-selectors">
						<label className="compare-select-label">
							<span>Left (older)</span>
							<select className="compare-select" value={leftIdx} onChange={(e) => setLeftIdx(Number(e.target.value))}>
								{history.map((entry, i) => (
									<option key={`left-${entry.version}-${i}`} value={i} disabled={i >= rightIdx}>
										{entry.version}
									</option>
								))}
							</select>
						</label>
						<label className="compare-select-label">
							<span>Right (newer)</span>
							<select className="compare-select" value={rightIdx} onChange={(e) => setRightIdx(Number(e.target.value))}>
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

			{meta?.frameFiles && meta.frameFiles.length > 0 && (
				<div className="mt-4 text-left">
					<h4 className="mb-2 font-semibold text-sm" style={{ color: 'var(--text)' }}>
						Frame PNGs ({meta.frameFiles.length})
					</h4>
					<p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
						Animated particles store each frame as a separate PNG. Download individual frames or grab them all as a ZIP.
					</p>
					<div
						className="max-h-48 overflow-y-auto border rounded p-2 flex flex-wrap gap-2"
						style={{ borderColor: 'var(--border)' }}
					>
						{meta.frameFiles.map((frame) => (
							<code
								key={frame}
								className="text-xs px-1.5 py-0.5 rounded border"
								style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
							>
								{frame.split('/').pop()}
							</code>
						))}
					</div>
					<button type="button" className="btn btn-outline mt-2 text-sm" onClick={onDownloadFrames}>
						Download all frames (ZIP)
					</button>
				</div>
			)}

			<h4 className="mt-3 mb-2 font-semibold" style={{ color: 'var(--text)' }}>
				Version History
			</h4>

			<div
				className="max-h-80 overflow-y-auto border rounded p-3 text-left flex flex-col gap-3 item-detail-history"
				style={{ borderColor: 'var(--border)' }}
			>
				{history.length === 0 ? (
					<p className="text-sm" style={{ color: 'var(--text-muted)' }}>No history found (likely base version).</p>
				) : (
					history
						.slice()
						.reverse()
						.map((entry, idx) => (
							<div key={`${entry.version}-${idx}`} className="flex items-center justify-between gap-2 min-w-0">
								<div className="text-sm flex-1 min-w-0" style={{ color: 'var(--text)' }}>
									<span>Version {entry.version}: </span>
									<code className="px-1 rounded border break-all" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
										{entry.displayFile}
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
									<button type="button" className="btn btn-outline py-1 px-2 text-xs" onClick={() => onDownloadHistory(entry)}>
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
					<button type="button" className={selected ? 'btn btn-ghost' : 'btn btn-outline'} onClick={() => onToggleSelect(particleId)}>
						{selected ? 'Deselect' : 'Select'}
					</button>
				)}
			</div>
		</div>
	);
}
