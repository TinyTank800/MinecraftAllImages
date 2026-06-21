"use client";

import { useEffect, useState, type ReactNode } from 'react';

interface CollapsiblePanelProps {
	summary: string;
	hint?: string;
	children: ReactNode;
	className?: string;
}

function isMobileViewport() {
	return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
}

export function CollapsiblePanel({ summary, hint, children, className }: CollapsiblePanelProps) {
	// Closed <details> hides content via the `hidden` attribute — CSS cannot override that on desktop.
	const [isOpen, setIsOpen] = useState(() => !isMobileViewport());

	useEffect(() => {
		const mql = window.matchMedia('(max-width: 640px)');
		const sync = () => setIsOpen(!mql.matches);
		sync();
		mql.addEventListener('change', sync);
		return () => mql.removeEventListener('change', sync);
	}, []);

	return (
		<details
			className={`toolbar-panel ${className ?? ''}`.trim()}
			open={isOpen}
			onToggle={(event) => {
				const mobile = isMobileViewport();
				if (mobile) {
					setIsOpen(event.currentTarget.open);
					return;
				}
				event.currentTarget.open = true;
				setIsOpen(true);
			}}
		>
			<summary className="toolbar-panel-summary">
				<span className="toolbar-panel-label">{summary}</span>
				{hint ? <span className="toolbar-panel-hint">{hint}</span> : null}
			</summary>
			<div className="toolbar-panel-body">{children}</div>
		</details>
	);
}

function sortModeLabel(mode: string): string {
	switch (mode) {
		case 'za':
			return 'Z-A';
		case 'version':
			return 'Newest';
		case 'length':
			return 'Length';
		default:
			return 'A-Z';
	}
}

export { sortModeLabel };
