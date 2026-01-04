export interface DiceInfo {
	id: string;
	name: string;
	mean: number;
	sides: number[];
}

export interface AttackDiceTierRanges {
	basic: [number, number];
	critical: [number, number];
	exalted: [number, number];
}

export type CurveType = 'sigmoid' | 'linear' | 'custom';

export interface CurveParams {
	type: CurveType;
	min: number;
	max: number;
	inflection: number; // For sigmoid: trait where curve is steepest
	steepness: number; // For sigmoid: how sharp the S-curve is
	customPoints?: { trait: number; value: number }[];
}

export type ColorTier = 'bronze' | 'silver' | 'gold' | 'prismatic';

export interface ColorThresholds {
	bronze: [number, number];
	silver: [number, number];
	gold: [number, number];
	prismatic: [number, number];
}

export interface DiceAvailabilityMode {
	mode: 'global' | 'per-tier' | 'per-trait';
	// Global mode: same dice for all traits
	globalAllowed?: string[];
	// Per-tier mode: dice allowed per color tier
	tierDice?: Record<ColorTier, string[]>;
	// Per-trait mode: dice allowed per trait level
	traitDice?: Record<number, string[]>;
}

export interface FitConstraints {
	traitRange: [number, number];
	maxDice: number;
	runeMultiplier?: number; // For Sorcerer-type classes
	monotonic: boolean;
	diceAvailability: DiceAvailabilityMode;
	colorThresholds: ColorThresholds;
	enforceAttackDiceTierRanges?: boolean;
	attackDiceTierRanges?: AttackDiceTierRanges;
}

export interface DiceCombination {
	dice: { dice_id: string; name: string; quantity: number }[];
	totalDice: number;
	mean: number;
}

export interface FitResult {
	trait: number;
	targetValue: number;
	actualValue: number;
	error: number;
	dice: { dice_id: string; name: string; quantity: number }[];
	color: ColorTier;
	totalDice: number;
}

export interface EffectSchemaEntry {
	count: number;
	color: ColorTier;
	effects: { type: 'dice'; dice_id: string; quantity: number }[];
}

export interface ClassPreset {
	name: string;
	description: string;
	traitRange: [number, number];
	colorThresholds: ColorThresholds;
	diceAvailability: DiceAvailabilityMode;
	runeMultiplier?: number;
	curveParams: CurveParams;
}
