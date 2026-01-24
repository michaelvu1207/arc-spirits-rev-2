export type DiceEffect = {
	type: 'dice';
	dice_id: string | null;
	dice_name?: string;
	quantity: number;
};

export type FlatStatEffect = {
	type: 'flat_stat';
	stat: 'attack' | 'defense';
	value: number;
	condition?: string;
	/** Optional localized condition text keyed by language tag (e.g. 'es', 'fr-CA'). */
	condition_translations?: Record<string, string> | null;
};

export type MultiplierEffect = {
	type: 'multiplier';
	stat: 'attack' | 'defense';
	value: number;
};

export type BackupTrimEffect = {
	type: 'backup_trim';
	value: number;
};

export type BenefitEffect = {
	type: 'benefit';
	description: string;
	/** Optional localized benefit descriptions keyed by language tag (e.g. 'es', 'fr-CA'). */
	description_translations?: Record<string, string> | null;
	value?: number;
	benefit_type?: string;
};

export type Effect =
	| DiceEffect
	| FlatStatEffect
	| MultiplierEffect
	| BenefitEffect
	| BackupTrimEffect;

export type BreakpointColor = 'bronze' | 'silver' | 'gold' | 'prismatic';

export interface EffectBreakpoint {
	count: number | string;
	/** Optional localized count labels (for string counts like "Unique 1"). */
	count_translations?: Record<string, string> | null;
	effects: Effect[];
	color?: BreakpointColor;
	description?: string;
	/** Optional localized breakpoint descriptions keyed by language tag (e.g. 'es', 'fr-CA'). */
	description_translations?: Record<string, string> | null;
}

export interface TraitWithEffects {
	id: string;
	name: string;
	description: string | null;
	effect_schema: EffectBreakpoint[];
}
