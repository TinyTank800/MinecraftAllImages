"use client";

import { Header } from '@/components/Header';
import { ItemDetailPanel } from '@/components/ItemDetailPanel';
import { ProgressBar } from '@/components/ProgressBar';
import { SiteFooter } from '@/components/SiteFooter';
import { useGalleryData } from '@/hooks/useGalleryData';
import { CATEGORY_LABELS, type ItemCategory } from '@/lib/categories';
import { filenameToSlug } from '@/lib/slug';

export interface ItemPageMeta {
	filename: string;
	slug: string;
	displayName: string;
	category: string;
	latestVersion: string;
	firstSeen: string;
	removed: boolean;
	historyCount: number;
}

export function ItemPageApp({ meta }: { meta: ItemPageMeta }) {
	const category = meta.category as ItemCategory;
	const categoryLabel = CATEGORY_LABELS[category] ?? meta.category;

	const {
		progress,
		state,
		selectedItems,
		toggleSelect,
		downloadSingleItem,
		formatItemName,
		getAltText,
		getPalette,
	} = useGalleryData();

	const info = state.loadedImages.get(meta.filename);
	const history = state.itemHistory.get(meta.filename) || [];
	const imagePath = info?.path ?? `/images/${meta.latestVersion}/${meta.filename}`;
	const versionTag = info?.versionTag ?? meta.latestVersion;
	const ready = progress.text === 'Done!';

	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			<main className="container flex-1 pb-12 pt-4">
				<nav className="breadcrumbs" aria-label="Breadcrumb">
					<a href="/">Home</a>
					<span className="sep">›</span>
					<a href={`/items/category/${meta.category}`}>{categoryLabel}</a>
					<span className="sep">›</span>
					<span>{meta.displayName}</span>
				</nav>

				<section className="item-page-hero card">
					<div className="item-page-hero-visual">
						<img
							src={ready ? imagePath : `/images/${meta.latestVersion}/${meta.filename}`}
							alt={getAltText(meta.filename)}
							className="item-page-hero-img pixelated"
							onError={(e) => {
								(e.currentTarget as HTMLImageElement).src = '/assets/missing.svg';
							}}
						/>
					</div>
					<div className="item-page-hero-meta">
						<h1 className="gradient-text item-page-title">{meta.displayName}</h1>
						<div className="item-page-chips">
							<span className="item-page-chip">{categoryLabel}</span>
							<span className="item-page-chip">Since {meta.firstSeen}</span>
							<span className="item-page-chip">Latest {meta.latestVersion}</span>
							{meta.removed && <span className="item-page-chip item-page-chip--removed">Removed</span>}
							{meta.historyCount > 1 && (
								<span className="item-page-chip">{meta.historyCount} texture versions</span>
							)}
						</div>
						<p className="item-page-lead">
							Transparent PNG icon for <strong>{meta.displayName}</strong>{' '}
							<code className="item-page-filename">{meta.filename}</code>. Download the latest texture,
							compare version history, and copy color palettes below.
						</p>
						<div className="item-page-actions">
							<a
								href={`/images/${meta.latestVersion}/${meta.filename}`}
								className="btn btn-primary"
								download
							>
								Download PNG
							</a>
							<a href="/" className="btn btn-outline">
								Browse full gallery
							</a>
						</div>
					</div>
				</section>

				<div className="my-4">
					<ProgressBar text={progress.text} percent={progress.percent} isError={progress.isError} />
				</div>

				{ready && (
					<section className="card p-6 item-page-details">
						<ItemDetailPanel
							filename={meta.filename}
							currentImagePath={imagePath}
							currentVersionTag={versionTag}
							history={history}
							palette={getPalette(meta.filename)}
							formatName={formatItemName}
							altText={getAltText(meta.filename)}
							onDownloadCurrent={() => {
								if (!info) return;
								void downloadSingleItem(
									meta.filename,
									info.versionTag,
									`${formatItemName(meta.filename)}_${info.versionTag}.png`,
								);
							}}
							onDownloadHistory={(entry) => {
								void downloadSingleItem(
									entry.filename,
									entry.version,
									`${formatItemName(entry.filename)}_${entry.version}.png`,
								);
							}}
							onToggleSelect={toggleSelect}
							selected={selectedItems.has(meta.filename)}
							showItemPageLink={false}
							layout="page"
						/>
					</section>
				)}
			</main>

			<SiteFooter />
		</div>
	);
}

export { filenameToSlug };
