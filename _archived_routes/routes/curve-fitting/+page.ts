import { supabase } from '$lib/api/supabaseClient';
import type { DiceInfo } from '$lib/features/curve-fitting/types';

export interface ClassInfo {
	id: string;
	name: string;
}

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

	// Fetch classes for saving results
	const classesPromise = supabase
		.from('classes')
		.select('id, name')
		.order('position');

	const [diceResult, classesResult] = await Promise.all([dicePromise, classesPromise]);

	if (diceResult.error) {
		console.error('Failed to load dice:', diceResult.error);
		return { dice: [] as DiceInfo[], classes: [] as ClassInfo[] };
	}

	// Calculate mean for each die
	const dice: DiceInfo[] = (diceResult.data ?? []).map((d) => {
		const sides = (d.dice_sides ?? [])
			.map((s: { reward_value: string }) => parseFloat(s.reward_value))
			.filter((v: number) => !isNaN(v));
		const mean = sides.length > 0 ? sides.reduce((a: number, b: number) => a + b, 0) / sides.length : 0;

		return {
			id: d.id,
			name: d.name,
			mean: Math.round(mean * 100) / 100,
			sides
		};
	});

	const classes: ClassInfo[] = (classesResult.data ?? []).map((c) => ({
		id: c.id,
		name: c.name
	}));

	return { dice, classes };
}
