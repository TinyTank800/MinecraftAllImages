"use client";

import { useEffect, useRef } from 'react';
import type { ParticleHistoryEntry, ParticleMeta } from '@/lib/types';
import { ParticleDetailPanel } from './ParticleDetailPanel';

export function ParticleModal(props: {
	open: boolean;
	particleId: string | null;
	currentImagePath: string | null;
	currentVersionTag: string | null;
	history: ParticleHistoryEntry[];
	meta: ParticleMeta | null;
	formatName: (id: string) => string;
	altText: string;
	onClose: () => void;
	onDownloadCurrent: () => void;
	onDownloadHistory: (entry: ParticleHistoryEntry) => void;
	onDownloadFrames: () => void;
	onToggleSelect: (id: string) => void;
	selected: boolean;
}) {
	const {
		open,
		particleId,
		currentImagePath,
		currentVersionTag,
		history,
		meta,
		formatName,
		altText,
		onClose,
		onDownloadCurrent,
		onDownloadHistory,
		onDownloadFrames,
		onToggleSelect,
		selected,
	} = props;

	const closeBtnRef = useRef<HTMLButtonElement | null>(null);
	const name = particleId ? formatName(particleId) : '';

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		closeBtnRef.current?.focus();
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	if (!open || !particleId) return null;

	return (
		<div
			className="fixed inset-0 z-[1000] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label={`${name} details`}
		>
			<div
				className="w-full max-w-2xl md:max-w-3xl card p-6 text-center relative max-h-[90vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<button
					ref={closeBtnRef}
					className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-lg text-xl leading-none border focus-visible:ring-2 focus-visible:ring-brand-500 outline-none"
					style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
					aria-label="Close"
					onClick={onClose}
				>
					×
				</button>

				<ParticleDetailPanel
					particleId={particleId}
					currentImagePath={currentImagePath}
					currentVersionTag={currentVersionTag}
					history={history}
					meta={meta}
					formatName={formatName}
					altText={altText}
					onDownloadCurrent={onDownloadCurrent}
					onDownloadHistory={onDownloadHistory}
					onDownloadFrames={onDownloadFrames}
					onToggleSelect={onToggleSelect}
					selected={selected}
				/>
			</div>
		</div>
	);
}
