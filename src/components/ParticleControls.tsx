"use client";

import type { SortMode, VersionTag } from '@/lib/types';

export function ParticleControls(props: {
	availableVersions: VersionTag[];
	currentVersion: VersionTag;
	setCurrentVersion: (v: VersionTag) => void;
	sortMode: SortMode;
	setSortMode: (m: SortMode) => void;
	showRemovedItems: boolean;
	setShowRemovedItems: (v: boolean) => void;
}) {
	const {
		availableVersions,
		currentVersion,
		setCurrentVersion,
		sortMode,
		setSortMode,
		showRemovedItems,
		setShowRemovedItems,
	} = props;

	return (
		<div className="flex flex-wrap items-center justify-center gap-4 rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
			<div className="flex items-center gap-2">
				<label htmlFor="particle-version-select" className="text-sm" style={{ color: 'var(--text-muted)' }}>
					Version:
				</label>
				<select
					id="particle-version-select"
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

			<div className="flex items-center gap-2">
				<label htmlFor="particle-sort-select" className="text-sm" style={{ color: 'var(--text-muted)' }}>
					Sort:
				</label>
				<select
					id="particle-sort-select"
					className="min-w-32 rounded-xl border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
					style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
					value={sortMode}
					onChange={(e) => setSortMode(e.target.value as SortMode)}
				>
					<option value="az">A → Z</option>
					<option value="za">Z → A</option>
					<option value="version">Version (newest first)</option>
					<option value="length">Name length</option>
				</select>
			</div>

			<label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>
				<input
					type="checkbox"
					checked={showRemovedItems}
					onChange={(e) => setShowRemovedItems(e.target.checked)}
					className="rounded"
				/>
				Show removed particles
			</label>
		</div>
	);
}
