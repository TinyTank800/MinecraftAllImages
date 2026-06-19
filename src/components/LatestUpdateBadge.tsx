"use client";

import { useEffect, useState } from 'react';

const VERSION_JSON_URL =
	'https://raw.githubusercontent.com/TinyTank800/MinecraftAllImages/main/version.json';

function formatDatePart(raw: string): string {
	const parts = raw.split('/').map((p) => parseInt(p, 10));
	if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return raw;
	const [month, day, year] = parts;
	const fullYear = year < 100 ? 2000 + year : year;
	const date = new Date(fullYear, month - 1, day);
	if (Number.isNaN(date.getTime())) return raw;
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatVersionMessage(message: string): string {
	const match = message.match(/^(.+?)\s*\((.+?)\)\s*$/);
	if (!match) return message.trim();
	return `${match[1].trim()} · ${formatDatePart(match[2].trim())}`;
}

export function LatestUpdateBadge() {
	const [detail, setDetail] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch(VERSION_JSON_URL);
				if (res.ok) {
					const data = (await res.json()) as { message?: string };
					if (data.message) {
						setDetail(formatVersionMessage(data.message));
						return;
					}
				}
			} catch {}

			try {
				const res = await fetch('/images/versions.json');
				if (res.ok) {
					const data = (await res.json()) as { versions?: string[] };
					if (data.versions?.[0]) setDetail(data.versions[0]);
				}
			} catch {}
		})();
	}, []);

	if (!detail) return null;

	return (
		<p className="latest-update-badge" aria-label={`Latest image update: ${detail}`}>
			<span className="latest-update-label">Latest Update</span>
			<span className="latest-update-value">{detail}</span>
		</p>
	);
}
