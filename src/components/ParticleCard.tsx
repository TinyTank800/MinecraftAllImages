"use client";

import { useState } from 'react';
import type { LoadedParticleInfo, ParticleMeta } from '@/lib/types';
import { particleKindLabel } from '@/lib/particles';

export function ParticleCard(props: {
	particleId: string;
	info: LoadedParticleInfo | undefined;
	meta: ParticleMeta | null;
	removed: boolean;
	selected: boolean;
	onToggle: (id: string) => void;
	onOpen: (id: string) => void;
	formatName: (id: string) => string;
	altText: string;
}) {
	const { particleId, info, meta, removed, selected, onToggle, onOpen, formatName, altText } = props;
	const [hover, setHover] = useState(false);
	const name = formatName(particleId);

	return (
		<div
			role="button"
			tabIndex={0}
			aria-pressed={selected}
			className={`item-card ${selected ? 'is-selected' : ''} ${removed ? 'is-removed' : ''}`}
			onClick={() => onToggle(particleId)}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			onFocus={() => setHover(true)}
			onBlur={() => setHover(false)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onToggle(particleId);
				}
			}}
			title={`Select/Deselect: ${name}\nID: ${particleId}\nVersion: ${info?.versionTag ?? '?'}`}
		>
			{hover && (
				<div className="item-tooltip" role="tooltip">
					<strong>{name}</strong>
					<div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
						{meta ? particleKindLabel(meta.kind, meta.animated, meta.frameCount) : ''}
					</div>
				</div>
			)}

			<button
				type="button"
				className="item-card-info"
				onClick={(e) => {
					e.stopPropagation();
					onOpen(particleId);
				}}
				aria-label={`Details for ${name}`}
			>
				i
			</button>

			{info ? (
				<img
					src={info.path}
					alt={altText}
					loading="lazy"
					className="mx-auto my-2 h-16 w-16 object-contain [image-rendering:pixelated]"
					onError={(e) => {
						(e.currentTarget as HTMLImageElement).src = '/assets/missing.svg';
					}}
				/>
			) : (
				<img src="/assets/missing.svg" alt={`${name} missing`} loading="lazy" className="mx-auto my-2 h-16 w-16 object-contain [image-rendering:pixelated]" />
			)}

			<div className="item-card-name">{name}</div>
			<span className="item-card-badge">
				{meta ? particleKindLabel(meta.kind, meta.animated, meta.frameCount) : info?.versionTag ?? '?'}
			</span>
			{removed && <span className="item-card-removed">Removed</span>}
		</div>
	);
}
