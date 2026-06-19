"use client";

import { useState } from 'react';
import { Header } from '@/components/Header';
import { SiteFooter } from '@/components/SiteFooter';
import { ProgressBar } from '@/components/ProgressBar';
import { SearchBar } from '@/components/SearchBar';
import { BackToTop } from '@/components/BackToTop';
import { ParticleControls } from '@/components/ParticleControls';
import { ParticleGallery } from '@/components/ParticleGallery';
import { ParticleModal } from '@/components/ParticleModal';
import { useParticleGalleryData } from '@/hooks/useParticleGalleryData';

export function ParticlesApp() {
	const {
		availableVersions,
		currentVersion,
		sortMode,
		searchTerm,
		showRemovedItems,
		progress,
		state,
		selectedParticles,
		setCurrentVersion,
		setSortMode,
		setSearchTerm,
		setShowRemovedItems,
		toggleSelect,
		clearSelection,
		selectVisible,
		shareSelection,
		downloadParticlesAsZip,
		downloadDisplayFile,
		downloadFrameFiles,
		formatName,
		getAltText,
		getMeta,
	} = useParticleGalleryData();

	const [modalOpen, setModalOpen] = useState(false);
	const [modalId, setModalId] = useState<string | null>(null);
	const [shareCopied, setShareCopied] = useState(false);

	const openModal = (id: string) => {
		setModalId(id);
		setModalOpen(true);
	};

	const onShareSelection = () => {
		shareSelection();
		setShareCopied(true);
		setTimeout(() => setShareCopied(false), 2000);
	};

	const onDownloadAll = () => {
		const ids =
			selectedParticles.size > 0
				? Array.from(selectedParticles)
				: state.displayedParticles.filter((id) => state.loadedParticles.has(id));
		const name =
			selectedParticles.size > 0
				? `Minecraft_Particles_${currentVersion}_Selected.zip`
				: `Minecraft_Particles_${currentVersion}_AllVisible.zip`;
		void downloadParticlesAsZip(ids, name);
	};

	const currentInfo = modalId ? state.loadedParticles.get(modalId) : undefined;
	const historyEntries = modalId ? state.particleHistory.get(modalId) || [] : [];

	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			<section className="hero">
				<div className="container">
					<h1 className="gradient-text">Minecraft Particle Textures</h1>
					<p className="hero-lead">
						Browse and download every Minecraft particle sprite across game versions. Animated effects
						play as GIFs; multi-file sequences and strip animations include individual frame PNGs in the
						detail view.
					</p>
				</div>
			</section>

			<main className="container flex-1 pb-12">
				<details className="info-details" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
					<summary className="info-summary">Info &amp; How to Use</summary>
					<div className="info-body">
						<h3>About this gallery</h3>
						<p>
							Particle textures are the small sprites Minecraft uses for effects like flame, smoke, potion
							bubbles, crit stars, and block breaking. This gallery collects them from vanilla resource
							packs, grouped by effect name.
						</p>
						<h3>Key features</h3>
						<ul>
							<li>
								<strong>Animated particles:</strong> Multi-frame effects (vertical strips or numbered
								sequences like big smoke) display as looping GIFs in the grid.
							</li>
							<li>
								<strong>Version history:</strong> Click the <code>i</code> icon to compare how a particle
								changed across Minecraft versions with a drag slider.
							</li>
							<li>
								<strong>Frame downloads:</strong> In the detail panel, download every individual frame
								PNG for animated particles, or grab the current GIF/PNG directly.
							</li>
							<li>
								<strong>Share selection:</strong> Select particles and use Share Selection to copy a link
								that pre-fills them for others.
							</li>
							<li>
								<strong>Bulk download:</strong> Download selected or all visible particles as a ZIP.
							</li>
						</ul>
						<p style={{ marginTop: '1.25rem', fontStyle: 'italic' }}>
							Not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang AB.
						</p>
					</div>
				</details>

				<div className="sticky-controls">
					<div className="card p-4">
						<ParticleControls
							availableVersions={availableVersions}
							currentVersion={currentVersion}
							setCurrentVersion={setCurrentVersion}
							sortMode={sortMode}
							setSortMode={setSortMode}
							showRemovedItems={showRemovedItems}
							setShowRemovedItems={setShowRemovedItems}
						/>
						<div className="my-3">
							<SearchBar
								search={searchTerm}
								setSearch={setSearchTerm}
								selectVisible={selectVisible}
								clearSelection={clearSelection}
								shareSelection={onShareSelection}
								displayedCount={state.displayedParticles.length}
								totalCount={state.allParticles.length}
								selectedCount={selectedParticles.size}
								onDownloadAll={onDownloadAll}
								searchPlaceholder="Search particles..."
								entityLabel="particles"
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

					<div id="particle-gallery-container">
						<ParticleGallery
							items={state.displayedParticles}
							loadedParticles={state.loadedParticles}
							particleMeta={state.particleMeta}
							markedAsRemoved={state.markedAsRemoved}
							selected={selectedParticles}
							onToggle={toggleSelect}
							onOpen={openModal}
							formatName={formatName}
							getAltText={getAltText}
						/>
					</div>
				</div>
			</main>

			<SiteFooter />

			<ParticleModal
				open={modalOpen}
				particleId={modalId}
				currentImagePath={currentInfo?.path ?? null}
				currentVersionTag={currentInfo?.versionTag ?? null}
				history={historyEntries}
				meta={modalId ? getMeta(modalId) : null}
				formatName={formatName}
				altText={modalId ? getAltText(modalId) : ''}
				onClose={() => setModalOpen(false)}
				onDownloadCurrent={() => {
					if (!modalId || !currentInfo) return;
					void downloadDisplayFile(modalId, currentInfo.versionTag, currentInfo.displayFile);
				}}
				onDownloadHistory={(entry) => {
					void downloadDisplayFile(modalId!, entry.version, entry.displayFile);
				}}
				onDownloadFrames={() => {
					if (!modalId) return;
					void downloadFrameFiles(modalId);
				}}
				onToggleSelect={toggleSelect}
				selected={modalId ? selectedParticles.has(modalId) : false}
			/>

			<div className="container">
				<BackToTop containerId="particle-gallery-container" />
			</div>
		</div>
	);
}
