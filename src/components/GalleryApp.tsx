"use client";

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Controls } from '@/components/Controls';
import { SearchBar } from '@/components/SearchBar';
import { Gallery } from '@/components/Gallery';
import { ProgressBar } from '@/components/ProgressBar';
import { ItemModal } from '@/components/ItemModal';
import { BackToTop } from '@/components/BackToTop';
import { Supporters } from '@/components/Supporters';
import { SiteFooter } from '@/components/SiteFooter';
import { useGalleryData } from '@/hooks/useGalleryData';
import type { ItemCategory } from '@/lib/categories';

export interface GalleryAppProps {
	/** Pre-filter to a category (category browse pages). */
	initialCategory?: ItemCategory;
	/** Show only removed items (removed archive page). */
	removedOnly?: boolean;
}

export function GalleryApp(props: GalleryAppProps) {
	const {
		availableVersions,
		baseVersion,
		currentVersion,
		sortMode,
		searchTerm,
		categoryFilter,
		showRemovedItems,
		imageSource,
		setImageSource,
		progress,
		state,
		selectedItems,
		setCurrentVersion,
		setSortMode,
		setSearchTerm,
		setCategoryFilter,
		setShowRemovedItems,
		toggleSelect,
		clearSelection,
		selectVisible,
		shareSelection,
		downloadItemsAsZip,
		downloadSingleItem,
		formatItemName,
		getAltText,
		getCategory,
		getPalette,
	} = useGalleryData({
		initialCategory: props.initialCategory ?? null,
		removedOnly: props.removedOnly ?? false,
	});

	const [modalOpen, setModalOpen] = useState(false);
	const [modalFilename, setModalFilename] = useState<string | null>(null);
	const [shareCopied, setShareCopied] = useState(false);

	const openModal = (filename: string) => {
		setModalFilename(filename);
		setModalOpen(true);
	};

	const onShareSelection = () => {
		shareSelection();
		setShareCopied(true);
		setTimeout(() => setShareCopied(false), 2000);
	};

	const onDownloadAll = () => {
		const files = selectedItems.size > 0
			? Array.from(selectedItems)
			: state.displayedItems.filter((f) => state.loadedImages.has(f));
		const name = selectedItems.size > 0
			? `Minecraft_Items_${currentVersion}_Selected.zip`
			: `Minecraft_Items_${currentVersion}_AllVisible.zip`;
		void downloadItemsAsZip(files, name);
	};

	const currentInfo = modalFilename ? state.loadedImages.get(modalFilename) : undefined;
	const historyEntries = modalFilename ? (state.itemHistory.get(modalFilename) || []) : [];

	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			<section className="hero">
					<div className="container">
						<h1 className="gradient-text">
							{props.removedOnly
								? 'Removed Minecraft Item Textures'
								: props.initialCategory
									? 'Browse by Category'
									: 'Every Minecraft Item Image, All Versions'}
						</h1>
						<p className="hero-lead">
							Browse and download high-quality transparent PNGs of every Minecraft item across all
							game versions. Search, filter by category, compare texture history, and grab bulk ZIPs.
						</p>
					</div>
				</section>

			<main className="container flex-1 pb-12">
				<details className="info-details" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
						<summary className="info-summary">Info &amp; How to Use</summary>
						<div className="info-body">
							<h3>About this project</h3>
							<p>
								This gallery showcases Minecraft item images captured in-game with transparent
								backgrounds. Ideal for wikis, guides, resource packs, and server websites.
							</p>
							<h3>Key features</h3>
							<ul>
								<li><strong>Select items:</strong> Click a card to select or deselect. Use Select Visible and bulk download for ZIPs.</li>
								<li><strong>Search &amp; categories:</strong> Find items fast with text search and creative-tab-style filters.</li>
								<li><strong>Version history:</strong> Click the <code>i</code> icon to compare textures across versions with a drag slider.</li>
								<li><strong>Item pages:</strong> Hover a card for a link to that item&apos;s dedicated page (e.g. <code>/items/diamond-sword</code>).</li>
								<li><strong>Color palettes:</strong> Copy vanilla hex colors from any item for your own textures.</li>
								<li><strong>Share selection:</strong> Select items and use Share Selection to copy a link that pre-fills them for others.</li>
								<li><strong>Bulk download:</strong> Download selected or all visible items as a ZIP.</li>
							</ul>
							<p style={{ marginTop: '1.25rem', fontStyle: 'italic' }}>
								Not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang AB.
							</p>
							<p className="text-sm" style={{ marginTop: '0.75rem', color: 'var(--text-muted)' }}>
								<a href="/docs">Documentation</a> — API access, CDN URLs, and packaging workflow for maintainers.
							</p>
						</div>
					</details>

				<div className="sticky-controls">
					<div className="card p-4">
						<Controls
							availableVersions={availableVersions}
							currentVersion={currentVersion}
							setCurrentVersion={setCurrentVersion}
							sortMode={sortMode}
							setSortMode={setSortMode}
							showRemovedItems={showRemovedItems}
							setShowRemovedItems={setShowRemovedItems}
							imageSource={imageSource}
							setImageSource={setImageSource}
							categoryFilter={categoryFilter}
							setCategoryFilter={setCategoryFilter}
							hideRemovedToggle={props.removedOnly}
						/>
						<div className="my-3">
							<SearchBar
								search={searchTerm}
								setSearch={setSearchTerm}
								selectVisible={selectVisible}
								clearSelection={clearSelection}
								shareSelection={onShareSelection}
								displayedCount={state.displayedItems.length}
								totalCount={state.allItems.length}
								selectedCount={selectedItems.size}
								onDownloadAll={onDownloadAll}
							/>
							{shareCopied && (
								<p className="text-center text-xs mt-1" style={{ color: 'var(--accent-muted)' }}>
									Selection link copied to clipboard!
								</p>
							)}
						</div>
					</div>
				</div>

				<div className="card p-6 mt-4">
					<div className="my-3">
						<ProgressBar text={progress.text} percent={progress.percent} isError={progress.isError} />
					</div>

					<div id="gallery-container">
						<Gallery
							items={state.displayedItems}
							loadedImages={state.loadedImages}
							markedAsRemoved={state.markedAsRemoved}
							selected={selectedItems}
							onToggle={toggleSelect}
							onOpen={openModal}
							formatName={formatItemName}
							getAltText={getAltText}
							getCategory={getCategory}
						/>
					</div>

					<div className="mt-4">
						<Supporters />
					</div>
				</div>
			</main>

			<SiteFooter />

			<ItemModal
				open={modalOpen}
				filename={modalFilename}
				currentImagePath={currentInfo?.path ?? null}
				currentVersionTag={currentInfo?.versionTag ?? null}
				history={historyEntries}
				palette={modalFilename ? getPalette(modalFilename) : []}
				formatName={formatItemName}
				altText={modalFilename ? getAltText(modalFilename) : ''}
				onClose={() => setModalOpen(false)}
				onDownloadCurrent={() => {
					if (!modalFilename || !currentInfo) return;
					void downloadSingleItem(modalFilename, currentInfo.versionTag, `${formatItemName(modalFilename)}_${currentInfo.versionTag}.png`);
				}}
				onDownloadHistory={(entry) => {
					void downloadSingleItem(entry.filename, entry.version, `${formatItemName(entry.filename)}_${entry.version}.png`);
				}}
				onToggleSelect={(fn) => toggleSelect(fn)}
				selected={modalFilename ? selectedItems.has(modalFilename) : false}
			/>

			<div className="container">
				<BackToTop containerId="gallery-container" />
			</div>
		</div>
	);
}
