"use client";



import React, { useState } from 'react';

import type { LoadedImageInfo } from '@/lib/types';

import type { ItemCategory } from '@/lib/categories';

import { ItemTooltip } from './ItemTooltip';



export function ItemCard(props: {

	filename: string;

	info: LoadedImageInfo | undefined;

	removed: boolean;

	selected: boolean;

	onToggle: (filename: string) => void;

	onOpen: (filename: string) => void;

	formatName: (f: string) => string;

	altText: string;

	category: ItemCategory | null;

}) {

	const { filename, info, removed, selected, onToggle, onOpen, formatName, altText, category } = props;

	const [hover, setHover] = useState(false);

	const name = formatName(filename);

	return (

		<div

			role="button"

			tabIndex={0}

			aria-pressed={selected}

			className={`item-card has-tooltip ${selected ? 'is-selected' : ''} ${removed ? 'is-removed' : ''}`}

			onClick={() => onToggle(filename)}

			onMouseEnter={() => setHover(true)}

			onMouseLeave={() => setHover(false)}

			onFocus={() => setHover(true)}

			onBlur={() => setHover(false)}

			onKeyDown={(e) => {

				if (e.key === 'Enter' || e.key === ' ') {

					e.preventDefault();

					onToggle(filename);

				}

			}}

			title={`Select/Deselect: ${name}\nFilename: ${filename}\nVersion: ${info?.versionTag ?? '?'}`}

		>

			{hover && (
				<ItemTooltip
					filename={filename}
					info={info}
					displayName={name}
					category={category}
					removed={removed}
				/>
			)}

			<button

				type="button"

				className="item-card-info"

				onClick={(e) => {

					e.stopPropagation();

					onOpen(filename);

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

						const target = e.currentTarget as HTMLImageElement;

						target.src = '/assets/missing.svg';

					}}

				/>

			) : (

				<img src="/assets/missing.svg" alt={`${name} missing`} loading="lazy" className="mx-auto my-2 h-16 w-16 object-contain [image-rendering:pixelated]" />

			)}

			<div className="item-card-name">{name}</div>

			<span className="item-card-badge">{info?.versionTag ?? '?'}</span>

			{removed && <span className="item-card-removed">Removed</span>}

		</div>

	);

}


