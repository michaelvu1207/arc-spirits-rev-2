import { supabase } from '$lib/api/supabaseClient';
import type { DiceInfo } from '$lib/features/curve-fitting/types';
import type { ClassTargets, TraitTarget } from '$lib/features/alternative-dice/types';
import { parseEffectSchema } from '$lib/features/classes/classes';
import type { EffectBreakpoint, DiceEffect } from '$lib/types/effects';

export async function load() {
	// Fetch dice with their sides to calculate mean
	const dicePromise = supabase
		.from('custom_dice')
		.select(
			`
			id,
			name,
			dice_type,
			dice_sides (
				side_number,
				reward_value
			)
		`
		)
		.eq('dice_type', 'attack')
		.order('name');

	// Fetch classes with their effect_schema (only Swordsman and Archer)
	const classesPromise = supabase
		.from('classes')
		.select('id, name, color, effect_schema')
		.in('name', ['Swordsman', 'Archer'])
		.order('position');

	const [diceResult, classesResult] = await Promise.all([dicePromise, classesPromise]);

	if (diceResult.error) {
		console.error('Failed to load dice:', diceResult.error);
		return { dice: [] as DiceInfo[], classTargets: [] as ClassTargets[] };
	}

	// Calculate mean for each die
	const dice: DiceInfo[] = (diceResult.data ?? []).map((d) => {
		const sides = (d.dice_sides ?? [])
			.map((s: { reward_value: string }) => parseFloat(s.reward_value))
			.filter((v: number) => !isNaN(v));
		const mean =
			sides.length > 0
				? sides.reduce((a: number, b: number) => a + b, 0) / sides.length
				: 0;

		return {
			id: d.id,
			name: d.name,
			mean: Math.round(mean * 100) / 100,
			sides
		};
	});

	// Build a dice lookup map
	const diceMap = new Map<string, DiceInfo>();
	for (const d of dice) {
		diceMap.set(d.id, d);
	}

	// Generate targets from actual class effect_schema
	const classTargets: ClassTargets[] = [];

	for (const cls of classesResult.data ?? []) {
		const effectSchema = parseEffectSchema(cls.effect_schema);

		if (effectSchema.length === 0) continue;

		// Sorcerer uses rune multiplier of 3
		const runeMultiplier = cls.name.toLowerCase() === 'sorcerer' ? 3 : 1;

		const targets: TraitTarget[] = [];

		for (const bp of effectSchema) {
			// Get the trait count (could be number or string)
			const trait = typeof bp.count === 'number' ? bp.count : parseInt(bp.count as string, 10);
			if (isNaN(trait)) continue;

			// Calculate EV from dice effects
			let totalEV = 0;
			let totalDice = 0;

			for (const effect of bp.effects ?? []) {
				if (effect.type === 'dice') {
					const diceEffect = effect as DiceEffect;
					const diceInfo = diceEffect.dice_id ? diceMap.get(diceEffect.dice_id) : null;

					if (diceInfo) {
						// Apply rune multiplier for Sorcerer (×3)
						totalEV += diceInfo.mean * (diceEffect.quantity || 1) * runeMultiplier;
						totalDice += diceEffect.quantity || 1;
					}
				}
			}

			targets.push({
				trait,
				targetEV: Math.round(totalEV * 100) / 100,
				diceCount: totalDice,
				color: bp.color ?? 'bronze'
			});
		}

		// Sort by trait
		targets.sort((a, b) => a.trait - b.trait);

		if (targets.length > 0) {
			const minTrait = targets[0].trait;
			const maxTrait = targets[targets.length - 1].trait;

			classTargets.push({
				key: cls.name.toLowerCase(),
				name: cls.name,
				color: cls.color ?? '#3b82f6',
				traitRange: [minTrait, maxTrait],
				targets
			});
		}
	}

	return { dice, classTargets };
}
