import type { AttackDiceTierRanges } from './types';

export type AttackDiceTier = 'basic' | 'critical' | 'exalted' | 'other';

export const DEFAULT_ATTACK_DICE_TIER_RANGES: AttackDiceTierRanges = {
	basic: [1, 5],
	critical: [4, 8],
	exalted: [7, 10]
};

function normalizeDiceName(name: string): string {
	return name.trim().toLowerCase();
}

export function getAttackDiceTier(diceName: string): AttackDiceTier {
	const normalized = normalizeDiceName(diceName);
	if (normalized.includes('basic attack')) return 'basic';
	if (normalized.includes('critical attack')) return 'critical';
	if (normalized.includes('exalted attack')) return 'exalted';
	return 'other';
}

export function getAttackDiceTierRank(tier: AttackDiceTier): number {
	switch (tier) {
		case 'basic':
			return 0;
		case 'critical':
			return 1;
		case 'exalted':
			return 2;
		default:
			return 3;
	}
}

export function isAttackDiceTierAllowedAtBreakpoint(
	tier: AttackDiceTier,
	breakpoint: number,
	ranges: AttackDiceTierRanges = DEFAULT_ATTACK_DICE_TIER_RANGES
): boolean {
	if (tier === 'other') return true;
	const [min, max] = ranges[tier];
	return breakpoint >= min && breakpoint <= max;
}
