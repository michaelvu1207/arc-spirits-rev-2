import type { AwakenRuneToken } from '$lib/types/gameData';

export type AwakenOrRuneToken = Extract<AwakenRuneToken, { kind: 'or' }>;

export function isAwakenOrRuneToken(token: AwakenRuneToken): token is AwakenOrRuneToken {
	return !!token && typeof token === 'object' && (token as AwakenOrRuneToken).kind === 'or';
}

export function normalizeAwakenRuneTokens(input: unknown): AwakenRuneToken[] {
	if (!Array.isArray(input)) return [];
	const tokens: AwakenRuneToken[] = [];

	for (const item of input) {
		if (typeof item === 'string') {
			tokens.push(item);
			continue;
		}

		if (!item || typeof item !== 'object') continue;
		const kind = (item as any).kind;
		if (kind !== 'or') continue;

		const runeIdsRaw = (item as any).rune_ids;
		const rune_ids = Array.isArray(runeIdsRaw) ? runeIdsRaw.filter((id: any) => typeof id === 'string') : [];
		tokens.push({ kind: 'or', rune_ids });
	}

	return tokens;
}

export function awakenRuneTokenSlotCost(_token: AwakenRuneToken): number {
	return 1;
}

export function awakenRuneTokensSlotsUsed(tokens: AwakenRuneToken[]): number {
	if (!Array.isArray(tokens)) return 0;
	return tokens.reduce((acc, t) => acc + awakenRuneTokenSlotCost(t), 0);
}

export function awakenRuneTokenRuneIds(token: AwakenRuneToken): string[] {
	if (typeof token === 'string') return [token];
	if (isAwakenOrRuneToken(token)) return token.rune_ids ?? [];
	return [];
}

export function allAwakenRuneIds(tokens: AwakenRuneToken[]): string[] {
	if (!Array.isArray(tokens)) return [];
	return tokens.flatMap(awakenRuneTokenRuneIds);
}
