"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';

export function CompareSlider(props: {
	beforeSrc: string;
	afterSrc: string;
	beforeLabel: string;
	afterLabel: string;
	alt: string;
}) {
	const { beforeSrc, afterSrc, beforeLabel, afterLabel, alt } = props;
	const [pct, setPct] = useState(50);
	const dragging = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setPct(50);
	}, [beforeSrc, afterSrc]);

	const updateFromClientX = useCallback((clientX: number) => {
		const el = containerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
		setPct((x / rect.width) * 100);
	}, []);

	const onPointerDown = (e: React.PointerEvent) => {
		dragging.current = true;
		containerRef.current?.setPointerCapture(e.pointerId);
		updateFromClientX(e.clientX);
	};

	const onPointerMove = (e: React.PointerEvent) => {
		if (!dragging.current) return;
		updateFromClientX(e.clientX);
	};

	const onPointerUp = () => {
		dragging.current = false;
	};

	return (
		<div className="compare-slider-wrap">
			<p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
				Drag the divider — <strong style={{ color: 'var(--text)' }}>{beforeLabel}</strong> on the left,{' '}
				<strong style={{ color: 'var(--text)' }}>{afterLabel}</strong> on the right
			</p>
			<div
				ref={containerRef}
				className="compare-slider"
				style={{ '--split': `${pct}%` } as React.CSSProperties}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				role="slider"
				aria-label={`Compare ${beforeLabel} and ${afterLabel}`}
				aria-valuenow={Math.round(pct)}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div className="compare-frame">
					<div className="compare-layer compare-layer--after">
						<img
							src={afterSrc}
							alt={`${alt} (${afterLabel})`}
							className="pixelated"
							draggable={false}
						/>
					</div>
					<div className="compare-layer compare-layer--before">
						<img
							src={beforeSrc}
							alt={`${alt} (${beforeLabel})`}
							className="pixelated"
							draggable={false}
						/>
					</div>
					<div className="compare-handle" />
				</div>
			</div>
		</div>
	);
}
