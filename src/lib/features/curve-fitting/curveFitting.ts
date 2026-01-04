import type {
	DiceInfo,
	CurveParams,
	FitConstraints,
	FitResult,
	DiceCombination,
	ColorTier,
	EffectSchemaEntry,
	ClassPreset
} from './types';
import { generateCurveValues } from './curveTypes';
import { generateAllCombinations, filterCombinations } from './diceCombinations';
import { DEFAULT_ATTACK_DICE_TIER_RANGES, getAttackDiceTier, isAttackDiceTierAllowedAtBreakpoint } from './diceTiers';

/**
 * Get the color tier for a given trait based on thresholds
 */
export function getColorForTrait(trait: number, constraints: FitConstraints): ColorTier {
	const { colorThresholds } = constraints;

	if (trait >= colorThresholds.prismatic[0] && trait <= colorThresholds.prismatic[1]) {
		return 'prismatic';
	}
	if (trait >= colorThresholds.gold[0] && trait <= colorThresholds.gold[1]) {
		return 'gold';
	}
	if (trait >= colorThresholds.silver[0] && trait <= colorThresholds.silver[1]) {
		return 'silver';
	}
	return 'bronze';
}

/**
 * Get allowed dice IDs for a given trait based on availability mode
 */
export function getAllowedDiceForTrait(
	trait: number,
	constraints: FitConstraints,
	allDice: DiceInfo[]
): string[] {
	const { diceAvailability } = constraints;
	const allDiceIds = allDice.map((d) => d.id);
	const diceById = new Map(allDice.map((d) => [d.id, d]));

	const baseAllowed = (() => {
		switch (diceAvailability.mode) {
			case 'global':
				return diceAvailability.globalAllowed ?? allDiceIds;

			case 'per-tier': {
				const tier = getColorForTrait(trait, constraints);
				return diceAvailability.tierDice?.[tier] ?? allDiceIds;
			}

			case 'per-trait':
				return diceAvailability.traitDice?.[trait] ?? allDiceIds;

			default:
				return allDiceIds;
		}
	})();

	// Enforce breakpoint windows for Basic/Critical/Exalted attack dice.
	if (constraints.enforceAttackDiceTierRanges === false) {
		return baseAllowed;
	}

	const attackRanges = constraints.attackDiceTierRanges ?? DEFAULT_ATTACK_DICE_TIER_RANGES;
	return baseAllowed.filter((id) => {
		const die = diceById.get(id);
		if (!die) return true;
		const attackTier = getAttackDiceTier(die.name);
		return isAttackDiceTierAllowedAtBreakpoint(attackTier, trait, attackRanges);
	});
}

/**
 * Find the best dice combination for a target value
 */
function findBestCombination(
	target: number,
	combinations: DiceCombination[],
	runeMultiplier?: number
): DiceCombination | null {
	if (combinations.length === 0) return null;

	// Calculate effective value considering rune multiplier
	const getEffectiveValue = (combo: DiceCombination) => {
		return runeMultiplier ? combo.mean * runeMultiplier : combo.mean;
	};

	// Sort combinations by:
	// 1. Error (distance from target) - primary
	// 2. Fewer dice - secondary (simpler is better)
	// 3. Higher mean per die - tertiary (prefer powerful dice)
	const scored = combinations.map((combo) => ({
		combo,
		effectiveValue: getEffectiveValue(combo),
		error: Math.abs(getEffectiveValue(combo) - target)
	}));

	scored.sort((a, b) => {
		// Primary: minimize error
		const errorDiff = a.error - b.error;
		if (Math.abs(errorDiff) > 0.01) return errorDiff;

		// Secondary: prefer fewer dice
		const diceDiff = a.combo.totalDice - b.combo.totalDice;
		if (diceDiff !== 0) return diceDiff;

		// Tertiary: prefer higher mean (more exciting dice)
		return b.combo.mean - a.combo.mean;
	});

	return scored[0]?.combo ?? null;
}

/**
 * Main curve fitting function
 * Finds optimal dice combinations for each trait to match target curve
 */
export function fitCurve(
	curveParams: CurveParams,
	constraints: FitConstraints,
	dice: DiceInfo[]
): FitResult[] {
	const { traitRange, maxDice, runeMultiplier, monotonic } = constraints;
	const [minTrait, maxTrait] = traitRange;

	// Generate target curve values
	const targetValues = generateCurveValues(curveParams, traitRange);

	// Pre-generate all possible combinations
	const allCombinations = generateAllCombinations(dice, maxDice);

	const results: FitResult[] = [];
	let previousValue = 0;

	for (let trait = minTrait; trait <= maxTrait; trait++) {
		const targetPoint = targetValues.find((t) => t.trait === trait);
		let target = targetPoint?.value ?? 0;

		// Enforce monotonicity: target can't be less than previous actual
		if (monotonic && target < previousValue) {
			target = previousValue;
		}

		// Get allowed dice for this trait
		const allowedDiceIds = getAllowedDiceForTrait(trait, constraints, dice);
		const filteredCombinations = filterCombinations(allCombinations, allowedDiceIds);

		// Find best combination
		const best = findBestCombination(target, filteredCombinations, runeMultiplier);

		if (best) {
			const effectiveValue = runeMultiplier ? best.mean * runeMultiplier : best.mean;

			// Enforce monotonicity on actual value
			const actualValue = monotonic ? Math.max(effectiveValue, previousValue) : effectiveValue;

			results.push({
				trait,
				targetValue: target,
				actualValue,
				error: Math.abs(actualValue - target),
				dice: best.dice,
				color: getColorForTrait(trait, constraints),
				totalDice: best.totalDice
			});

			previousValue = actualValue;
		} else {
			// No valid combination found
			results.push({
				trait,
				targetValue: target,
				actualValue: 0,
				error: target,
				dice: [],
				color: getColorForTrait(trait, constraints),
				totalDice: 0
			});
		}
	}

	return results;
}

/**
 * Convert fit results to effect_schema format for database
 */
export function resultsToEffectSchema(results: FitResult[]): EffectSchemaEntry[] {
	return results.map((r) => ({
		count: r.trait,
		color: r.color,
		effects: r.dice.map((d) => ({
			type: 'dice' as const,
			dice_id: d.dice_id,
			quantity: d.quantity
		}))
	}));
}

/**
 * Calculate total error across all fit results
 */
export function calculateTotalError(results: FitResult[]): number {
	return results.reduce((sum, r) => sum + r.error, 0);
}

/**
 * Calculate mean squared error
 */
export function calculateMSE(results: FitResult[]): number {
	if (results.length === 0) return 0;
	const sumSquaredError = results.reduce((sum, r) => sum + r.error * r.error, 0);
	return sumSquaredError / results.length;
}

/**
 * Predefined presets for Swordsman, Archer, and Sorcerer
 */
export const CLASS_PRESETS: Record<string, ClassPreset> = {
	swordsman: {
		name: 'Swordsman',
		description: 'Physical fighter using Basic and Exalted attacks (traits 2-9)',
		traitRange: [2, 9],
		colorThresholds: {
			bronze: [2, 4],
			silver: [5, 6],
			gold: [7, 8],
			prismatic: [9, 9]
		},
		diceAvailability: {
			mode: 'global',
			globalAllowed: [] // Will be populated with Basic and Exalted IDs
		},
		curveParams: {
			type: 'sigmoid',
			min: 0.5,
			max: 6.0,
			inflection: 5,
			steepness: 1.0
		}
	},
	archer: {
		name: 'Archer',
		description: 'Precision fighter with Basic, Critical, and Exalted (traits 2-9)',
		traitRange: [2, 9],
		colorThresholds: {
			bronze: [2, 4],
			silver: [5, 6],
			gold: [7, 8],
			prismatic: [9, 9]
		},
		diceAvailability: {
			mode: 'global',
			globalAllowed: [] // Will be populated with Basic, Critical, and Exalted IDs
		},
		curveParams: {
			type: 'sigmoid',
			min: 0.5,
			max: 6.0,
			inflection: 5,
			steepness: 1.0
		}
	},
	sorcerer: {
		name: 'Sorcerer',
		description: 'Rune multiplier class (traits 3-7, ×3-4 runes)',
		traitRange: [3, 7],
		colorThresholds: {
			bronze: [3, 4],
			silver: [5, 6],
			gold: [7, 7],
			prismatic: [8, 8] // Not used for Sorcerer
		},
		diceAvailability: {
			mode: 'global',
			globalAllowed: [] // Will be populated based on selection
		},
		runeMultiplier: 3,
		curveParams: {
			type: 'sigmoid',
			min: 1.5, // At 3 runes
			max: 6.5,
			inflection: 5,
			steepness: 0.8
		}
	}
};
