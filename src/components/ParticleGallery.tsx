"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LoadedParticleInfo, ParticleMeta } from '@/lib/types';
import { ParticleCard } from './ParticleCard';

const RENDER_BATCH_SIZE = 100;

export function ParticleGallery(props: {
	items: string[];
	loadedParticles: Map<string, LoadedParticleInfo>;
	particleMeta: Map<string, ParticleMeta>;
	markedAsRemoved: Set<string>;
	selected: Set<string>;
	onToggle: (id: string) => void;
	onOpen: (id: string) => void;
	formatName: (id: string) => string;
	getAltText: (id: string) => string;
}) {
	const { items, loadedParticles, particleMeta, markedAsRemoved, selected, onToggle, onOpen, formatName, getAltText } = props;
	const [visible, setVisible] = useState<string[]>(items.slice(0, RENDER_BATCH_SIZE));
	const containerRef = useRef<HTMLDivElement | null>(null);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const observerRef = useRef<IntersectionObserver | null>(null);

	useEffect(() => {
		setVisible(items.slice(0, RENDER_BATCH_SIZE));
	}, [items]);

	useEffect(() => {
		if (!containerRef.current || !sentinelRef.current) return;
		if (observerRef.current) observerRef.current.disconnect();
		observerRef.current = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					setVisible(items.slice(0, Math.min(visible.length + RENDER_BATCH_SIZE, items.length)));
				}
			},
			{ root: null, rootMargin: '400px' },
		);
		observerRef.current.observe(sentinelRef.current);
		return () => observerRef.current?.disconnect();
	}, [items, visible.length]);

	return useMemo(
		() => (
			<div
				ref={containerRef}
				className="gallery-grid grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-2 border rounded-xl"
				style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
			>
				{visible.length === 0 ? (
					<div className="col-span-full text-center py-8" style={{ color: 'var(--text-muted)' }}>
						No particles found matching your criteria.
					</div>
				) : (
					<>
						{visible.map((id) => (
							<ParticleCard
								key={id}
								particleId={id}
								info={loadedParticles.get(id)}
								meta={particleMeta.get(id) ?? null}
								removed={markedAsRemoved.has(id)}
								selected={selected.has(id)}
								onToggle={onToggle}
								onOpen={onOpen}
								formatName={formatName}
								altText={getAltText(id)}
							/>
						))}
						{visible.length < items.length && (
							<div ref={sentinelRef} className="col-span-full text-center py-4" style={{ color: 'var(--text-muted)' }}>
								Loading more particles...
							</div>
						)}
					</>
				)}
			</div>
		),
		[items.length, visible, loadedParticles, particleMeta, markedAsRemoved, selected, onToggle, onOpen, formatName, getAltText],
	);
}
