import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { CustomDiceRow, DiceSideRow } from '$lib/types/gameData';

export type DiceType = CustomDiceRow['dice_type'];

export type CustomDiceWithSides = CustomDiceRow & {
	dice_sides: DiceSideRow[];
};

export type DiceFormSide = {
	id?: string;
	side_number: number;
	reward_type: DiceType;
	reward_value: string;
	reward_description: string;
	icon: string;
};

export type DiceFormData = {
	id?: string;
	name: string;
	description: string;
	icon: string;
	color: string;
	dice_type: DiceType;
	dice_sides: DiceFormSide[];
	background_image_path?: string | null;
};

export const DICE_TYPE_ICONS: Record<DiceType, string> = {
	attack: '⚔️',
	special: '✨'
};

export const DICE_TYPE_LABELS: Record<DiceType, string> = {
	attack: 'Attack Dice',
	special: 'Special Dice'
};

const DEFAULT_COLOR = '#4a9eff';
const DEFAULT_SIDE_COUNT = 6;

export function createDefaultSide(type: DiceType, index: number): DiceFormSide {
	return {
		side_number: index + 1,
		reward_type: type,
		reward_value: type === 'attack' ? String(index + 1) : `Effect ${index + 1}`,
		reward_description: '',
		icon: DICE_TYPE_ICONS[type]
	};
}

export function normalizeSides(type: DiceType, sides?: DiceFormSide[]): DiceFormSide[] {
	const base = sides ?? [];
	return Array.from({ length: DEFAULT_SIDE_COUNT }, (_, index) => {
		const existing = base[index];
		const rewardValue = existing?.reward_value?.trim();
		const icon = existing?.icon?.trim() || DICE_TYPE_ICONS[type];
		return {
			id: existing?.id,
			side_number: index + 1,
			reward_type: type,
			reward_value:
				type === 'attack'
					? sanitizeAttackValue(rewardValue, index + 1)
					: rewardValue && rewardValue.length > 0
						? rewardValue
						: `Effect ${index + 1}`,
			reward_description: existing?.reward_description?.trim() ?? '',
			icon
		};
	});
}

export function createInitialForm(type: DiceType = 'attack'): DiceFormData {
	return {
		name: '',
		description: '',
		icon: DICE_TYPE_ICONS[type],
		color: DEFAULT_COLOR,
		dice_type: type,
		dice_sides: normalizeSides(type),
		background_image_path: null
	};
}

export function toFormData(dice: CustomDiceWithSides): DiceFormData {
	const type: DiceType = dice.dice_type ?? 'attack';
	const sortedSides = [...(dice.dice_sides ?? [])].sort((a, b) => a.side_number - b.side_number);
	const formSides: DiceFormSide[] = sortedSides.map((side) => ({
		id: side.id,
		side_number: side.side_number,
		reward_type: side.reward_type === 'special' ? 'special' : 'attack',
		reward_value: String(side.reward_value ?? ''),
		reward_description: side.reward_description ?? '',
		icon: side.icon ?? DICE_TYPE_ICONS[type]
	}));

	return {
		id: dice.id,
		name: dice.name,
		description: dice.description ?? '',
		icon: dice.icon ?? DICE_TYPE_ICONS[type],
		color: dice.color ?? DEFAULT_COLOR,
		dice_type: type,
		dice_sides: normalizeSides(type, formSides),
		background_image_path: dice.background_image_path ?? null
	};
}

export async function fetchDiceRecords(client: Rev2Client = supabase): Promise<CustomDiceWithSides[]> {
	const { data, error } = await client
		.from('custom_dice')
		.select(
			'id, name, name_translations, description, description_translations, icon, color, dice_type, background_image_path, exported_template_path, created_at, updated_at, dice_sides (id, dice_id, side_number, reward_type, reward_value, reward_description, reward_description_translations, icon, image_path, template_x, template_y, created_at)'
		)
		.order('created_at', { ascending: false });

	if (error) {
		throw error;
	}

	return (data ?? []).map((record) => ({
		...record,
		dice_type: record.dice_type === 'special' ? 'special' : 'attack',
		dice_sides: (record.dice_sides ?? []).map((side: any) => ({
			...side,
			image_path: side.image_path ?? null,
			template_x: side.template_x ?? null,
			template_y: side.template_y ?? null,
			reward_type: side.reward_type === 'special' ? 'special' : 'attack'
		})) as DiceSideRow[]
	})) as CustomDiceWithSides[];
}

export async function saveDiceRecord(
	form: DiceFormData,
	client: Rev2Client = supabase
): Promise<CustomDiceWithSides> {
	const sanitized = sanitizeDiceForm(form);
	let diceId = sanitized.id;

	if (diceId) {
		const { error } = await client
			.from('custom_dice')
			.update({
				name: sanitized.name,
				description: sanitized.description,
				icon: sanitized.icon,
				color: sanitized.color,
				dice_type: sanitized.dice_type,
				background_image_path: sanitized.background_image_path ?? null,
				updated_at: new Date().toISOString()
			})
			.eq('id', diceId);

		if (error) {
			throw error;
		}
	} else {
		const { data, error } = await client
			.from('custom_dice')
			.insert({
				name: sanitized.name,
				description: sanitized.description,
				icon: sanitized.icon,
				color: sanitized.color,
				dice_type: sanitized.dice_type,
				background_image_path: sanitized.background_image_path ?? null
			})
			.select('id')
			.single();

		if (error) {
			throw error;
		}

		diceId = data?.id ?? null;
	}

	if (!diceId) {
		throw new Error('Unable to determine dice id after save.');
	}

	await syncDiceSides(client, diceId, sanitized.dice_type, sanitized.dice_sides);

	return await fetchDiceById(client, diceId);
}

export async function deleteDiceRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('custom_dice').delete().eq('id', id);
	if (error) {
		throw error;
	}
}

function sanitizeDiceForm(form: DiceFormData): DiceFormData {
	const name = form.name.trim();
	const description = form.description.trim();
	const icon = form.icon.trim();
	const color = form.color.trim() || DEFAULT_COLOR;
	const dice_type: DiceType = form.dice_type ?? 'attack';

	return {
		...form,
		name,
		description,
		icon: icon || DICE_TYPE_ICONS[dice_type],
		color,
		dice_type,
		dice_sides: normalizeSides(dice_type, form.dice_sides)
	};
}

function sanitizeAttackValue(value: string | undefined, fallback: number): string {
	if (!value) {
		return String(fallback);
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return String(fallback);
	}
	return String(Math.floor(parsed));
}

async function syncDiceSides(
	client: Rev2Client,
	diceId: string,
	type: DiceType,
	sides: DiceFormSide[]
) {
	const payload = sides.map((side, index) => ({
		// Omit `id` when the side is new — PostgREST serialises `undefined` to
		// `null`, which overrides the column's `gen_random_uuid()` default and
		// trips the NOT NULL constraint. Only send `id` when the row already
		// exists (edit case); for inserts let the DB generate the UUID.
		...(side.id ? { id: side.id } : {}),
		dice_id: diceId,
		side_number: index + 1,
		reward_type: type,
		reward_value: type === 'attack' ? sanitizeAttackValue(side.reward_value, index + 1) : side.reward_value,
		reward_description: side.reward_description.trim() || null,
		icon: side.icon.trim() || DICE_TYPE_ICONS[type]
	}));

	const { error: upsertError } = await client
		.from('dice_sides')
		.upsert(payload, { onConflict: 'dice_id,side_number' });

	if (upsertError) {
		throw upsertError;
	}

	const maxSideNumber = payload.length;
	const { error: cleanupError } = await client
		.from('dice_sides')
		.delete()
		.eq('dice_id', diceId)
		.gt('side_number', maxSideNumber);

	if (cleanupError) {
		throw cleanupError;
	}
}

async function fetchDiceById(client: Rev2Client, id: string): Promise<CustomDiceWithSides> {
	const { data, error } = await client
		.from('custom_dice')
		.select(
			'id, name, name_translations, description, description_translations, icon, color, dice_type, background_image_path, exported_template_path, created_at, updated_at, dice_sides (id, dice_id, side_number, reward_type, reward_value, reward_description, reward_description_translations, icon, image_path, template_x, template_y, created_at)'
		)
		.eq('id', id)
		.maybeSingle();

	if (error) {
		throw error;
	}

	if (!data) {
		throw new Error(`Dice with id ${id} was not found after save.`);
	}

	return {
		...data,
		dice_type: data.dice_type === 'special' ? 'special' : 'attack',
		dice_sides: (data.dice_sides ?? []).map((side: any) => ({
			...side,
			image_path: side.image_path ?? null,
			template_x: side.template_x ?? null,
			template_y: side.template_y ?? null,
			reward_type: side.reward_type === 'special' ? 'special' : 'attack'
		})) as DiceSideRow[]
	} as CustomDiceWithSides;
}
