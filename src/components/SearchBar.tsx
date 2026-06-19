"use client";

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
			? `Total: ${totalCount} • Showing: ${displayedCount} • Selected: ${selectedCount}`
			: `Total: ${totalCount} • Showing: ${displayedCount}`;

	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<label htmlFor="item-search" className="sr-only">
				Search for {entityLabel}
			</label>
			<input
				id="item-search"
				type="search"
				placeholder={searchPlaceholder}
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				className="w-full min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-48 rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
				style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
			/>
			<div className="flex items-center gap-2 flex-wrap">
				<button type="button" onClick={selectVisible} className="btn btn-outline">
					Select Visible
				</button>
				<button type="button" onClick={clearSelection} className="btn btn-ghost">
					Clear Selection
				</button>
				{selectedCount > 0 && (
					<button
						type="button"
						onClick={shareSelection}
						className="btn btn-outline"
						title="Copy a link that pre-selects these items for whoever opens it"
					>
						Share Selection
					</button>
				)}
				<button type="button" onClick={onDownloadAll} className="btn btn-primary">
					{selectedCount > 0 ? `Download Selected (${selectedCount}) as ZIP` : 'Download All as ZIP'}
				</button>
			</div>
			<p className="w-full text-center text-sm" style={{ color: 'var(--text-muted)' }} suppressHydrationWarning>
				{statsText}
			</p>
		</div>
	);
}
