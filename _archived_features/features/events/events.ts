import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { EventRow } from '$lib/types/gameData';

export interface EventFormData {
	id?: string;
	name: string;
	title: string;
	description: string | null;
	image_path: string | null;
	order_num: number;
}

export function emptyEventForm(): EventFormData {
	return {
		name: '',
		title: '',
		description: null,
		image_path: null,
		order_num: 0
	};
}

export function eventRowToForm(row: EventRow): EventFormData {
	return {
		id: row.id,
		name: row.name,
		title: row.title,
		description: row.description,
		image_path: row.image_path,
		order_num: row.order_num ?? 0
	};
}

export async function fetchEventRecords(client: Rev2Client = supabase): Promise<EventRow[]> {
	const { data, error } = await client
		.from('events')
		.select('*')
		.order('order_num', { ascending: true })
		.order('name', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function saveEventRecord(
	form: EventFormData,
	client: Rev2Client = supabase
): Promise<EventRow> {
	const sanitized = sanitizeEventForm(form);
	let eventId = sanitized.id;

	const payload = {
		name: sanitized.name,
		title: sanitized.title,
		description: sanitized.description,
		image_path: sanitized.image_path,
		order_num: sanitized.order_num,
		updated_at: new Date().toISOString()
	};

	if (eventId) {
		const { error } = await client.from('events').update(payload).eq('id', eventId);
		if (error) throw error;
	} else {
		const { data, error } = await client.from('events').insert(payload).select('*').single();
		if (error) throw error;
		eventId = data?.id ?? null;
	}

	if (!eventId) {
		throw new Error('Unable to determine event id after save.');
	}

	const { data, error } = await client.from('events').select('*').eq('id', eventId).single();
	if (error) throw error;
	return data;
}

export async function deleteEventRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('events').delete().eq('id', id);
	if (error) throw error;
}

function sanitizeEventForm(form: EventFormData): EventFormData {
	const name = form.name.trim();
	const title = form.title.trim();
	const description = form.description?.trim() || null;
	const image_path = form.image_path?.trim() || null;
	const order_num = Number.isFinite(form.order_num) ? Math.max(0, Math.round(form.order_num)) : 0;

	return {
		...form,
		name,
		title,
		description,
		image_path,
		order_num
	};
}

