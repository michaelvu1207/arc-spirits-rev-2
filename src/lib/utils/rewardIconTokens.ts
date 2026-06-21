import type { RewardIconToken } from '$lib/types/gameData';

export type RewardOrIconToken = Extract<RewardIconToken, { kind: 'or' }>;

export function isRewardOrIconToken(token: RewardIconToken): token is RewardOrIconToken {
	return !!token && typeof token === 'object' && (token as RewardOrIconToken).kind === 'or';
}

export function rewardIconTokenSlotCost(token: RewardIconToken): number {
	if (typeof token === 'string') return 1;
	if (!token || !isRewardOrIconToken(token)) return 1;
	const count = token.icon_ids?.length ?? 0;
	// OR slots are meant to be visually larger by spanning multiple slots.
	// Default to 2 slots even when empty; allow up to 5 icons/slots.
	if (count <= 0) return 2;
	return Math.max(2, Math.min(5, count));
}

export function rewardIconTokensSlotsUsed(tokens: RewardIconToken[]): number {
	if (!Array.isArray(tokens)) return 0;
	return tokens.reduce((acc, t) => acc + rewardIconTokenSlotCost(t), 0);
}

export function normalizeRewardIconTokens(input: unknown): RewardIconToken[] {
	if (!Array.isArray(input)) return [];
	const tokens: RewardIconToken[] = [];

	for (const item of input) {
		if (typeof item === 'string') {
			tokens.push(item);
			continue;
		}

		if (!item || typeof item !== 'object') continue;
		const kind = (item as any).kind;
		if (kind !== 'or') continue;

		const iconIdsRaw = (item as any).icon_ids;
		const icon_ids = Array.isArray(iconIdsRaw) ? iconIdsRaw.filter((id: any) => typeof id === 'string') : [];
		tokens.push({ kind: 'or', icon_ids });
	}

	return tokens;
}

export function clampRewardIconTokens(tokens: RewardIconToken[], maxSlots: number): RewardIconToken[] {
	if (!Array.isArray(tokens)) return [];
	if (!Number.isFinite(maxSlots) || maxSlots <= 0) return [];
	return tokens.slice(0, maxSlots);
}

export function clampRewardIconTokensBySlots(tokens: RewardIconToken[], maxSlots: number): RewardIconToken[] {
	if (!Array.isArray(tokens)) return [];
	if (!Number.isFinite(maxSlots) || maxSlots <= 0) return [];

	let used = 0;
	const out: RewardIconToken[] = [];
	for (const token of tokens) {
		const cost = rewardIconTokenSlotCost(token);
		if (used + cost > maxSlots) break;
		out.push(token);
		used += cost;
	}
	return out;
}

export function rewardIconTokenIconIds(token: RewardIconToken): string[] {
	if (typeof token === 'string') return [token];
	if (isRewardOrIconToken(token)) return token.icon_ids ?? [];
	return [];
}

export function rewardIconTokensHaveAnyIcons(tokens: RewardIconToken[]): boolean {
	if (!Array.isArray(tokens)) return false;
	for (const token of tokens) {
		if (typeof token === 'string') {
			if (token.trim().length > 0) return true;
			continue;
		}
		if (isRewardOrIconToken(token) && (token.icon_ids?.length ?? 0) > 0) return true;
	}
	return false;
}
