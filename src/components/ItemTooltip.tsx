"use client";

import type { LoadedImageInfo } from '@/lib/types';
import type { ItemCategory } from '@/lib/categories';
import { CATEGORY_LABELS } from '@/lib/categories';
import { filenameToSlug } from '@/lib/slug';

export function ItemTooltip(props: {
	filename: string;
	info: LoadedImageInfo | undefined;
	displayName: string;
	category: ItemCategory | null;
	removed: boolean;
}) {
	const { filename, info, displayName, category, removed } = props;
	const slug = filenameToSlug(filename);

	return (
		<div className="item-tooltip" role="tooltip">
			<strong>{displayName}</strong>
			{info && <div>Version: {info.versionTag}</div>}
			{category && <div>{CATEGORY_LABELS[category]}</div>}
			{removed && <div style={{ color: 'var(--accent-muted)' }}>Removed in this version</div>}
			<a
				href={`/items/${slug}`}
				className="item-tooltip-page-link"
				onClick={(e) => e.stopPropagation()}
			>
				View full item page →
			</a>
		</div>
	);
}
