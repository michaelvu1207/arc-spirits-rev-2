import type { DiceInfo, DiceCombination } from './types';
import { getAttackDiceTier, getAttackDiceTierRank } from './diceTiers';

/**
 * Generate all possible dice combinations up to maxDice total
 * using the provided dice types
 */
export function generateAllCombinations(
	dice: DiceInfo[],
	maxDice: number
): DiceCombination[] {
	const combinations: DiceCombination[] = [];

	// Generate combinations using recursion with memoization
	function generate(
		diceIndex: number,
		remaining: number,
		current: Map<string, number>
	): void {
		// Base case: no more dice to add
		if (remaining === 0 || diceIndex >= dice.length) {
			if (current.size > 0) {
				const combo = buildCombination(current, dice);
				combinations.push(combo);
			}
			return;
		}

		const currentDie = dice[diceIndex];

		// Try adding 0 to remaining of this die type
		for (let count = 0; count <= remaining; count++) {
			const newCurrent = new Map(current);
			if (count > 0) {
				newCurrent.set(currentDie.id, count);
			}
			generate(diceIndex + 1, remaining - count, newCurrent);
		}
	}

	// Generate for each total dice count from 1 to maxDice
	for (let total = 1; total <= maxDice; total++) {
		generate(0, total, new Map());
	}

	return combinations;
}

/**
 * Build a DiceCombination object from a map of dice counts
 */
function buildCombination(
	counts: Map<string, number>,
	diceList: DiceInfo[]
): DiceCombination {
	const diceById = new Map(diceList.map((d) => [d.id, d]));
	const diceEntries: { dice_id: string; name: string; quantity: number }[] = [];
	let totalDice = 0;
	let totalMean = 0;

	for (const [diceId, quantity] of counts) {
		const die = diceById.get(diceId);
		if (die) {
			diceEntries.push({
				dice_id: diceId,
				name: die.name,
				quantity
			});
			totalDice += quantity;
			totalMean += die.mean * quantity;
		}
	}

	// Sort by dice name for consistent ordering
	diceEntries.sort((a, b) => {
		const tierA = getAttackDiceTier(a.name);
		const tierB = getAttackDiceTier(b.name);
		const tierDiff = getAttackDiceTierRank(tierA) - getAttackDiceTierRank(tierB);
		if (tierDiff !== 0) return tierDiff;

		// Within a tier, sort by mean (highest first) for consistency
		const dieA = diceById.get(a.dice_id);
		const dieB = diceById.get(b.dice_id);
		const meanDiff = (dieB?.mean ?? 0) - (dieA?.mean ?? 0);
		if (meanDiff !== 0) return meanDiff;

		return a.name.localeCompare(b.name);
	});

	return {
		dice: diceEntries,
		totalDice,
		mean: totalMean
	};
}

/**
 * Filter combinations to only include those using allowed dice
 */
export function filterCombinations(
	combinations: DiceCombination[],
	allowedDiceIds: string[]
): DiceCombination[] {
	const allowedSet = new Set(allowedDiceIds);
	return combinations.filter((combo) =>
		combo.dice.every((d) => allowedSet.has(d.dice_id))
	);
}

/**
 * Calculate the mean value of a dice combination
 */
export function calculateCombinationMean(
	dice: { dice_id: string; quantity: number }[],
	diceInfo: DiceInfo[]
): number {
	const diceById = new Map(diceInfo.map((d) => [d.id, d]));
	let total = 0;
	for (const d of dice) {
		const die = diceById.get(d.dice_id);
		if (die) {
			total += die.mean * d.quantity;
		}
	}
	return total;
}

/**
 * Format a dice combination as a human-readable string
 */
export function formatCombination(
	dice: { dice_id: string; name: string; quantity: number }[]
): string {
	return dice
		.map((d) => {
			const shortName = d.name.replace(' Attack', '');
			return `${d.quantity}× ${shortName}`;
		})
		.join(' + ');
}
