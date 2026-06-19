import type { ParticleKind, ParticleMeta } from './types';

const SEQUENCE_SUFFIX = /^(.+)_(\d+)$/;

export function formatParticleName(id: string, meta?: ParticleMeta | null): string {
	if (meta?.displayName) return meta.displayName;
	return id
		.replace(/__/g, ' / ')
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function particleDisplayPath(version: string, displayFile: string): string {
	return `/particles/${version}/${displayFile.replace(/\\/g, '/')}`;
}

export function particleAssetPath(version: string, relativePath: string): string {
	return `/particles/${version}/${relativePath.replace(/\\/g, '/')}`;
}

export function altTextForParticle(displayName: string, version: string): string {
	return `Minecraft ${displayName} particle texture (${version})`;
}

export function isSequencePartId(id: string): boolean {
	return SEQUENCE_SUFFIX.test(id);
}

export function sequenceBaseId(id: string): string | null {
	const match = id.match(SEQUENCE_SUFFIX);
	return match ? match[1] : null;
}

export function particleKindLabel(kind: ParticleKind, animated: boolean, frameCount: number): string {
	if (kind === 'sequence') return `GIF · ${frameCount} frames`;
	if (animated) return `GIF · ${frameCount}f`;
	return 'PNG';
}
