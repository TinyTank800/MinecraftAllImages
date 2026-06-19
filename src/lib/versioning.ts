import type { VersionTag } from './types';

export function compareVersions(a: VersionTag, b: VersionTag): number {
	const partsA = a.split('.').map(Number);
	const partsB = b.split('.').map(Number);
	const len = Math.max(partsA.length, partsB.length);
	for (let i = 0; i < len; i++) {
		const valA = partsA[i] || 0;
		const valB = partsB[i] || 0;
		if (valA !== valB) return valA - valB;
	}
	return 0;
}

export function buildVersionPath(allVersions: VersionTag[], base: VersionTag, target: VersionTag): VersionTag[] {
	const result: VersionTag[] = [base];
	const sorted = [...allVersions].sort(compareVersions);
	for (const v of sorted) {
		if (compareVersions(v, base) > 0 && compareVersions(v, target) <= 0) {
			if (!result.includes(v)) result.push(v);
		}
	}
	return result.sort(compareVersions);
}


