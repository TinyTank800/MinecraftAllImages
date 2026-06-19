"use client";

export function ProgressBar(props: { text: string; percent: number | null; isError?: boolean }) {
	const { text, percent, isError } = props;
	if (percent === null && !text) return null;
	return (
		<div className="w-full rounded-xl h-6 relative overflow-hidden" style={{ background: 'var(--surface)' }} role="progressbar" aria-valuenow={percent ?? undefined} aria-valuemin={0} aria-valuemax={100} aria-label={text || 'Progress'}>
			<div
				className="h-full transition-[width]"
				style={{ width: percent !== null ? `${percent}%` : '100%', background: isError ? '#b91c1c' : 'linear-gradient(90deg, var(--accent), #9b0f1c)' }}
			/>
			<span className="absolute inset-0 grid place-items-center text-xs font-bold" style={{ color: 'var(--text)' }}>
				{text}
			</span>
		</div>
	);
}


