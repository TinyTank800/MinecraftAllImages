"use client";

import React, { useState } from 'react';

export function PaletteSwatches(props: { colors: string[] }) {
	const { colors } = props;
	const [copied, setCopied] = useState<string | null>(null);

	if (!colors.length) return null;

	const copy = async (hex: string) => {
		try {
			await navigator.clipboard.writeText(hex);
			setCopied(hex);
			setTimeout(() => setCopied(null), 1500);
		} catch {}
	};

	return (
		<div>
			<h4 className="text-sm font-semibold mt-2 mb-1" style={{ color: 'var(--text)' }}>Color Palette</h4>
			<div className="palette-row">
				{colors.map((hex) => (
					<button
						key={hex}
						type="button"
						className="palette-swatch"
						style={{ background: hex }}
						title={`Copy ${hex}`}
						aria-label={`Copy color ${hex}`}
						onClick={() => void copy(hex)}
					/>
				))}
			</div>
			{copied && (
				<p className="text-xs" style={{ color: 'var(--text-muted)' }}>Copied {copied}</p>
			)}
		</div>
	);
}
