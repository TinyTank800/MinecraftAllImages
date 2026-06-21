"use client";

import type { ImageSource, SortMode, VersionTag } from '@/lib/types';
import { ALL_CATEGORIES, CATEGORY_LABELS, type ItemCategory } from '@/lib/categories';
import { IMAGE_SOURCE_LABELS } from '@/lib/image-source';
import { CollapsiblePanel, sortModeLabel } from '@/components/CollapsiblePanel';

export function Controls(props: {
	availableVersions: VersionTag[];
	currentVersion: VersionTag;
	setCurrentVersion: (v: VersionTag) => void;
	sortMode: SortMode;
	setSortMode: (m: SortMode) => void;
	showRemovedItems: boolean;
	setShowRemovedItems: (v: boolean) => void;
	imageSource: ImageSource;
	setImageSource: (v: ImageSource) => void;
	categoryFilter: ItemCategory | null;
	setCategoryFilter: (c: ItemCategory | null) => void;
	hideRemovedToggle?: boolean;
}) {
	const {
		availableVersions,
		currentVersion,
		setCurrentVersion,
		sortMode,
		setSortMode,
		showRemovedItems,
		setShowRemovedItems,
		imageSource,
		setImageSource,
		categoryFilter,
		setCategoryFilter,
		hideRemovedToggle,
	} = props;

	const filterHint = [
		currentVersion === 'latest' ? 'Latest' : currentVersion,
		sortModeLabel(sortMode),
		imageSource === 'v2' ? 'Enhanced' : 'Legacy',
		categoryFilter ? CATEGORY_LABELS[categoryFilter] : null,
		showRemovedItems && !hideRemovedToggle ? 'Removed' : null,
	]
		.filter(Boolean)
		.join(' · ');

	const filterBody = (
		<div className="controls-panel-inner">
			<div
				className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 rounded-xl border p-3 sm:p-4 controls-bar"
				style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
			>
				<div className="flex items-center gap-2 controls-field">
					<label htmlFor="version-select" className="text-sm" style={{ color: 'var(--text-muted)' }}>
						Version:
					</label>
					<select
						id="version-select"
						className="min-w-32 rounded-xl border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
						style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
						value={currentVersion}
						onChange={(e) => setCurrentVersion(e.target.value)}
					>
						<option value="latest">Latest</option>
						{availableVersions.map((v) => (
							<option key={v} value={v}>
								{v}
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center gap-2 controls-field">
					<label htmlFor="sort-select" className="text-sm" style={{ color: 'var(--text-muted)' }}>
						Sort:
					</label>
					<select
						id="sort-select"
						className="min-w-40 rounded-xl border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
						style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
						value={sortMode}
						onChange={(e) => setSortMode(e.target.value as SortMode)}
					>
						<option value="az">A-Z</option>
						<option value="za">Z-A</option>
						<option value="version">Version (Newest First)</option>
						<option value="length">Name Length (Longest)</option>
					</select>
				</div>

				<div className="flex items-center gap-2 controls-field">
					<label
						htmlFor="image-source-select"
						className="text-sm"
						style={{ color: 'var(--text-muted)' }}
						title="Legacy = all v1 versions. Enhanced = v2 mod exports only."
					>
						Images:
					</label>
					<select
						id="image-source-select"
						className="min-w-36 rounded-xl border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
						style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
						value={imageSource}
						onChange={(e) => setImageSource(e.target.value as ImageSource)}
					>
						<option value="v1">{IMAGE_SOURCE_LABELS.v1}</option>
						<option value="v2">{IMAGE_SOURCE_LABELS.v2}</option>
					</select>
				</div>

				{!hideRemovedToggle && (
					<label
						className="flex items-center gap-2 text-sm cursor-pointer controls-removed-toggle"
						style={{ color: 'var(--text-muted)' }}
					>
						<input
							type="checkbox"
							className="accent-brand-500 h-4 w-4"
							checked={showRemovedItems}
							onChange={(e) => setShowRemovedItems(e.target.checked)}
						/>
						Show Removed Items
					</label>
				)}
			</div>

			<div className="category-chips">
				<button
					type="button"
					className={`category-chip ${categoryFilter === null ? 'is-active' : ''}`}
					onClick={() => setCategoryFilter(null)}
				>
					All
				</button>
				{ALL_CATEGORIES.map((cat) => (
					<button
						key={cat}
						type="button"
						className={`category-chip ${categoryFilter === cat ? 'is-active' : ''}`}
						onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
					>
						{CATEGORY_LABELS[cat]}
					</button>
				))}
			</div>
		</div>
	);

	return (
		<CollapsiblePanel summary="Filters" hint={filterHint}>
			{filterBody}
		</CollapsiblePanel>
	);
}
