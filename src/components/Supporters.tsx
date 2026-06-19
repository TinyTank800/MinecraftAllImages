"use client";

import React, { useEffect, useState } from 'react';

interface Supporter { name: string; tier?: number }

export function Supporters() {
	const [supporters, setSupporters] = useState<Supporter[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const url = 'https://raw.githubusercontent.com/TinyTank800/MinecraftAllImages/main/members.json';
				const resp = await fetch(`${url}?t=${Date.now()}`);
				if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
				const data = (await resp.json()) as Supporter[];
				if (!Array.isArray(data)) throw new Error('Invalid format');
				data.sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0) || a.name.localeCompare(b.name));
				setSupporters(data);
			} catch (e: unknown) {
				setError(e instanceof Error ? e.message : 'Error');
			}
		})();
	}, []);

	return (
		<div className="mt-6 rounded-xl p-4 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
			<div className="mb-2 text-center font-semibold" style={{ color: 'var(--accent)' }}>Our Supporters</div>
			{error && <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>Could not load supporter list.</p>}
			{!error && !supporters && <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading supporters...</p>}
			{supporters && supporters.length === 0 && <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>No supporters listed currently.</p>}
			{supporters && supporters.length > 0 && (
				<div className="flex flex-wrap gap-2 justify-center">
					{supporters.map((s, idx) => (
						<span key={`${s.name}-${idx}`} className="px-3 py-2 rounded text-sm border-2"
							style={{
								color: s.tier === 0 ? '#ffffff' : s.tier === 1 ? '#faa61a' : s.tier === 2 ? '#9032e2' : '#9cff9a',
								borderColor: s.tier === 0 ? '#a7a7a7' : s.tier === 1 ? '#c98716' : s.tier === 2 ? '#601f99' : '#6fb86e',
							}}
						>
							{s.name}
						</span>
					))}
				</div>
			)}
			<div className="text-center mt-4">
				<a href="https://discord.jemsire.com" target="_blank" rel="noopener noreferrer" className="btn btn-primary">Become a Supporter!</a>
			</div>
		</div>
	);
}


