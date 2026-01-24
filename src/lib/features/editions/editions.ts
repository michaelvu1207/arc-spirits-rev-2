import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { EditionRow, CostDuplicates } from '$lib/types/gameData';

export type { EditionRow, CostDuplicates };

export interface EditionFormData {
	id?: string;
	name: string;
	description: string;
	origin_ids: string[];
	cost_duplicates: CostDuplicates;
	is_default: boolean;
}

export const DEFAULT_COST_DUPLICATES: CostDuplicates = {
	'1': 3,
	'3': 2,
	'4': 1,
	'5': 1,
	'7': 1,
	'9': 1,
	'11': 1,
	'13': 1,
	'15': 1,
	'17': 1
};

export function emptyEditionForm(): EditionFormData {
	return {
		name: '',
		description: '',
		origin_ids: [],
		cost_duplicates: { ...DEFAULT_COST_DUPLICATES },
		is_default: false
	};
}

export function editionRowToForm(row: EditionRow): EditionFormData {
	return {
		id: row.id,
		name: row.name,
		description: row.description ?? '',
		origin_ids: row.origin_ids ?? [],
		cost_duplicates: { ...DEFAULT_COST_DUPLICATES, ...(row.cost_duplicates ?? {}) },
		is_default: row.is_default
	};
}

export async function fetchEditionRecords(client: Rev2Client = supabase): Promise<EditionRow[]> {
	const { data, error } = await client
		.from('editions')
		.select('*')
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function fetchDefaultEdition(client: Rev2Client = supabase): Promise<EditionRow | null> {
	const { data, error } = await client
		.from('editions')
		.select('*')
		.eq('is_default', true)
		.single();
	if (error) {
		// If no default found, get the first one
		const { data: firstData } = await client
			.from('editions')
			.select('*')
			.order('created_at', { ascending: true })
			.limit(1)
			.single();
		return firstData ?? null;
	}
	return data ?? null;
}

export async function saveEditionRecord(
	form: EditionFormData,
	client: Rev2Client = supabase
): Promise<EditionRow> {
	const sanitized = sanitizeEditionForm(form);
	let editionId = sanitized.id;

	const payload = {
		name: sanitized.name.trim(),
		description: sanitized.description.trim() || null,
		origin_ids: sanitized.origin_ids,
		cost_duplicates: sanitized.cost_duplicates,
		is_default: sanitized.is_default,
		updated_at: new Date().toISOString()
	};

	if (editionId) {
		// If setting as default, unset all other defaults first
		if (sanitized.is_default) {
			await client.from('editions').update({ is_default: false }).neq('id', editionId);
		}
		const { error } = await client.from('editions').update(payload).eq('id', editionId);
		if (error) throw error;
	} else {
		// If setting as default, unset all other defaults first
		if (sanitized.is_default) {
			await client.from('editions').update({ is_default: false });
		}
		const { data, error } = await client.from('editions').insert(payload).select('*').single();
		if (error) throw error;
		editionId = data?.id ?? null;
	}

	if (!editionId) {
		throw new Error('Unable to determine edition id after save.');
	}

	const { data, error } = await client.from('editions').select('*').eq('id', editionId).single();
	if (error) throw error;
	return data;
}

export async function deleteEditionRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('editions').delete().eq('id', id);
	if (error) throw error;
}

function sanitizeEditionForm(form: EditionFormData): EditionFormData {
	return {
		...form,
		name: form.name.trim(),
		description: form.description.trim(),
		origin_ids: form.origin_ids.filter(Boolean),
		cost_duplicates: form.cost_duplicates
	};
}
