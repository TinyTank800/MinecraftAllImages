"use client";



import React, { useMemo, useRef, useEffect, useState } from 'react';

import { ItemCard } from './ItemCard';

import type { LoadedImageInfo } from '@/lib/types';

import type { ItemCategory } from '@/lib/categories';



const RENDER_BATCH_SIZE = 100;



export function Gallery(props: {

	items: string[];

	loadedImages: Map<string, LoadedImageInfo>;

	markedAsRemoved: Set<string>;

	selected: Set<string>;

	onToggle: (fn: string) => void;

	onOpen: (fn: string) => void;

	formatName: (fn: string) => string;

	getAltText: (fn: string) => string;

	getCategory: (fn: string) => ItemCategory | null;

}) {

	const { items, loadedImages, markedAsRemoved, selected, onToggle, onOpen, formatName, getAltText, getCategory } = props;

	const [visible, setVisible] = useState<string[]>(items.slice(0, RENDER_BATCH_SIZE));

	const containerRef = useRef<HTMLDivElement | null>(null);

	const sentinelRef = useRef<HTMLDivElement | null>(null);

	const observerRef = useRef<IntersectionObserver | null>(null);



	useEffect(() => {

		setVisible(items.slice(0, RENDER_BATCH_SIZE));

	}, [items]);



	useEffect(() => {

		if (!containerRef.current) return;

		if (observerRef.current) observerRef.current.disconnect();

		if (!sentinelRef.current) return;

		observerRef.current = new IntersectionObserver(

			(entries) => {

				if (entries[0].isIntersecting) {

					const next = items.slice(0, Math.min(visible.length + RENDER_BATCH_SIZE, items.length));

					setVisible(next);

				}

			},

			{ root: containerRef.current },

		);

		observerRef.current.observe(sentinelRef.current);

		return () => observerRef.current?.disconnect();

	}, [items, visible.length]);



	const grid = useMemo(() => {

		return (

			<div ref={containerRef} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 max-h-[75vh] min-h-[400px] overflow-y-auto p-2 border rounded-xl" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>

				{visible.length === 0 ? (

					<div className="col-span-full text-center py-8" style={{ color: 'var(--text-muted)' }}>No items found matching your criteria.</div>

				) : (

					<>

						{visible.map((f) => (

							<ItemCard

								key={f}

								filename={f}

								info={loadedImages.get(f)}

								removed={markedAsRemoved.has(f)}

								selected={selected.has(f)}

								onToggle={onToggle}

								onOpen={onOpen}

								formatName={formatName}

								altText={getAltText(f)}

								category={getCategory(f)}

							/>

						))}

						{visible.length < items.length && (

							<div ref={sentinelRef} className="col-span-full text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading more items...</div>

						)}

					</>

				)}

			</div>

		);

	}, [items, loadedImages, markedAsRemoved, selected, onToggle, onOpen, formatName, getAltText, getCategory, visible.length]);



	return grid;

}


