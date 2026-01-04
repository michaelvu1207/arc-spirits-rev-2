import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { MonsterRow, RewardRow, RewardRowType } from '$lib/types/gameData';

export type MonsterClassification = 'monster' | 'abyss_guardian' | 'boss';

export interface MonsterFormData {
	id?: string;
	name: string;
	damage: number;
	barrier: number;
	state: 'tainted' | 'corrupt' | 'fallen' | 'arcane';
	monster_classification: MonsterClassification;
	icon: string | null;
	image_path: string | null;
	reward_rows: RewardRow[];
	order_num: number;
	special_conditions: string | null;
	/** Number of copies of this monster in the deck. Defaults to 1. */
	quantity: number;
}

const DEFAULT_DAMAGE = 0;
const DEFAULT_BARRIER = 0;
const DEFAULT_STATE: MonsterFormData['state'] = 'tainted';
const DEFAULT_CLASSIFICATION: MonsterFormData['monster_classification'] = 'monster';

export function emptyMonsterForm(): MonsterFormData {
	return {
		name: '',
		damage: DEFAULT_DAMAGE,
		barrier: DEFAULT_BARRIER,
		state: DEFAULT_STATE,
		monster_classification: DEFAULT_CLASSIFICATION,
		icon: null,
		image_path: null,
		reward_rows: [],
		order_num: 0,
		special_conditions: null,
		quantity: 1
	};
}

export function emptyRewardRow(type: RewardRowType = 'all_in_combat'): RewardRow {
	return {
		type,
		icon_ids: []
	};
}

export function monsterRowToForm(row: MonsterRow): MonsterFormData {
	// Handle legacy data migration from reward_icons + reward_header_type to reward_rows
	let rewardRows: RewardRow[] = row.reward_rows ?? [];
	
	// If reward_rows is empty but legacy fields exist, migrate them
	if (rewardRows.length === 0 && row.reward_icons && row.reward_icons.length > 0) {
		const legacyType: RewardRowType = row.reward_header_type === 'tournament' ? 'tournament' : 'all_in_combat';
		rewardRows = [{
			type: legacyType,
			icon_ids: row.reward_icons
		}];
	}

	return {
		id: row.id,
		name: row.name,
		damage: row.damage,
		barrier: row.barrier,
		state: row.state,
		monster_classification: row.monster_classification ?? DEFAULT_CLASSIFICATION,
		icon: row.icon,
		image_path: row.image_path,
		reward_rows: rewardRows,
		order_num: row.order_num ?? 0,
		special_conditions: row.special_conditions ?? null,
		quantity: row.quantity ?? 1
	};
}

export async function fetchMonsterRecords(client: Rev2Client = supabase): Promise<MonsterRow[]> {
	const { data, error } = await client
		.from('monsters')
		.select('*')
		.order('order_num', { ascending: true })
		.order('name', { ascending: true });
	if (error) throw error;
	return (
		data ?? []
	);
}

export async function saveMonsterRecord(
	form: MonsterFormData,
	client: Rev2Client = supabase
): Promise<MonsterRow> {
	const sanitized = sanitizeMonsterForm(form);
	let monsterId = sanitized.id;

	const payload = {
		name: sanitized.name,
		damage: sanitized.damage,
		barrier: sanitized.barrier,
		state: sanitized.state,
		monster_classification: sanitized.monster_classification,
		icon: sanitized.icon,
		image_path: sanitized.image_path,
		order_num: sanitized.order_num,
		reward_rows: sanitized.reward_rows,
		special_conditions: sanitized.special_conditions,
		quantity: sanitized.quantity,
		updated_at: new Date().toISOString()
	};

	if (monsterId) {
		const { error } = await client.from('monsters').update(payload).eq('id', monsterId);
		if (error) throw error;
	} else {
		const { data, error } = await client.from('monsters').insert(payload).select('*').single();
		if (error) throw error;
		monsterId = data?.id ?? null;
	}

	if (!monsterId) {
		throw new Error('Unable to determine monster id after save.');
	}

	const { data, error } = await client.from('monsters').select('*').eq('id', monsterId).single();
	if (error) throw error;
	return {
		...data,
		barrier: (data as any).barrier ?? DEFAULT_BARRIER,
		reward_rows: (data as any).reward_rows ?? [],
		state: (data as any).state ?? DEFAULT_STATE,
		order_num: (data as any).order_num ?? 0
	};
}

export async function deleteMonsterRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('monsters').delete().eq('id', id);
	if (error) throw error;
}

function sanitizeRewardRow(row: RewardRow): RewardRow {
	const validTypes: RewardRowType[] = [
		'all_in_combat',
		'all_in_combat_pick_one',
		'all_losers',
		'all_winners',
		'one_winner',
		'tournament'
	];
	return {
		type: validTypes.includes(row.type) ? row.type : 'all_in_combat',
		icon_ids: Array.isArray(row.icon_ids) 
			? row.icon_ids.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim())
			: [],
		label: row.label?.trim() || undefined
	};
}

function sanitizeMonsterForm(form: MonsterFormData): MonsterFormData {
	const name = form.name.trim();
	const damage = Number.isFinite(form.damage) ? Math.max(0, Math.round(form.damage)) : DEFAULT_DAMAGE;
	const barrier = Number.isFinite(form.barrier) ? Math.max(0, Math.round(form.barrier)) : DEFAULT_BARRIER;
	const state: MonsterFormData['state'] = form.state ?? DEFAULT_STATE;
	const classification: MonsterFormData['monster_classification'] =
		form.monster_classification === 'abyss_guardian' || form.monster_classification === 'boss'
			? form.monster_classification
			: DEFAULT_CLASSIFICATION;
	const icon = form.icon?.trim() || null;
	const image_path = form.image_path?.trim() || null;
	const order_num = Number.isFinite(form.order_num) ? Math.max(0, Math.round(form.order_num)) : 0;
	const reward_rows = Array.isArray(form.reward_rows)
		? form.reward_rows.map(sanitizeRewardRow).filter(row => row.icon_ids.length > 0)
		: [];
	const special_conditions = form.special_conditions?.trim() || null;
	const quantity = Number.isFinite(form.quantity) ? Math.max(1, Math.round(form.quantity)) : 1;

	return {
		...form,
		name,
		damage,
		barrier,
		state,
		monster_classification: classification,
		icon,
		image_path,
		order_num,
		reward_rows,
		special_conditions,
		quantity
	};
}
