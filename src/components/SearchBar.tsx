"use client";

import { CollapsiblePanel } from '@/components/CollapsiblePanel';

export function SearchBar(props: {
	search: string;
	setSearch: (s: string) => void;
	selectVisible: () => void;
	clearSelection: () => void;
	shareSelection: () => void;
	displayedCount: number;
	totalCount: number;
	selectedCount: number;
	onDownloadAll: () => void;
	searchPlaceholder?: string;
	entityLabel?: string;
}) {
	const {
		search,
		setSearch,
		selectVisible,
		clearSelection,
		shareSelection,
		displayedCount,
		totalCount,
		selectedCount,
		onDownloadAll,
		searchPlaceholder = 'Search for items...',
		entityLabel = 'items',
	} = props;

	const statsText =
		selectedCount > 0
			? `${displayedCount} shown · ${selectedCount} selected`
			: `${displayedCount} of ${totalCount} ${entityLabel}`;

	const actionsHint =
		selectedCount > 0 ? `${selectedCount} selected` : `${displayedCount} visible`;

	const actionButtons = (
		<div className="flex items-center gap-2 flex-wrap search-actions">
			<button type="button" onClick={selectVisible} className="btn btn-outline">
				<span className="btn-label-full">Select Visible</span>
				<span className="btn-label-compact">Select all</span>
			</button>
			<button type="button" onClick={clearSelection} className="btn btn-ghost">
				<span className="btn-label-full">Clear Selection</span>
				<span className="btn-label-compact">Clear</span>
			</button>
			{selectedCount > 0 && (
				<button
					type="button"
					onClick={shareSelection}
					className="btn btn-outline"
					title="Copy a link that pre-selects these items for whoever opens it"
				>
					<span className="btn-label-full">Share Selection</span>
					<span className="btn-label-compact">Share</span>
				</button>
			)}
			<button type="button" onClick={onDownloadAll} className="btn btn-primary">
				<span className="btn-label-full">
					{selectedCount > 0 ? `Download Selected (${selectedCount}) as ZIP` : 'Download All as ZIP'}
				</span>
				<span className="btn-label-compact">
					{selectedCount > 0 ? `Download (${selectedCount})` : 'Download ZIP'}
				</span>
			</button>
		</div>
	);

	return (
		<div className="search-bar">
			<div className="search-bar-input-wrap">
				<label htmlFor="item-search" className="sr-only">
					Search for {entityLabel}
				</label>
				<input
					id="item-search"
					type="search"
					placeholder={searchPlaceholder}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="search-bar-input w-full min-w-0 rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
					style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
				/>
			</div>

			<CollapsiblePanel summary="Actions" hint={actionsHint} className="search-actions-panel">
				{actionButtons}
			</CollapsiblePanel>

			<p className="search-bar-stats" style={{ color: 'var(--text-muted)' }} suppressHydrationWarning>
				{statsText}
			</p>
		</div>
	);
}
