import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { HexSpiritRow, OriginRow } from '$lib/types/gameData';

export interface OriginFormData {
	id?: string;
	name: string;
	is_enabled: boolean;
	position: number;
	icon_emoji: string;
	icon_png: string | null;
	icon_token_png: string | null;
	color: string;
	description: string;
}

const DEFAULT_ICON_EMOJI = '';
const DEFAULT_COLOR = '#64748b';
const ORIGIN_DISABLE_REASON = 'origin_disabled';

type DisabledOriginRow = {
	origin_id: string;
};

export function emptyOriginForm(position = 1): OriginFormData {
	return {
		name: '',
		is_enabled: true,
		position,
		icon_emoji: DEFAULT_ICON_EMOJI,
		icon_png: null,
		icon_token_png: null,
		color: DEFAULT_COLOR,
		description: ''
	};
}

export function originRowToForm(row: OriginRow): OriginFormData {
	return {
		id: row.id,
		name: row.name,
		is_enabled: row.is_enabled ?? true,
		position: row.position,
		icon_emoji: row.icon_emoji ?? DEFAULT_ICON_EMOJI,
		icon_png: row.icon_png,
		icon_token_png: row.icon_token_png,
		color: row.color ?? DEFAULT_COLOR,
		description: row.description ?? ''
	};
}

export async function fetchOriginRecords(client: Rev2Client = supabase): Promise<OriginRow[]> {
	const [originResult, disabledResult] = await Promise.all([
		client.from('origins').select('*').order('position', { ascending: true }),
		client.from('disabled_origins').select('origin_id')
	]);

	if (originResult.error) throw originResult.error;

	let disabledOriginIds = new Set<string>();
	if (disabledResult.error) {
		if (!isMissingDisabledOriginsTableError(disabledResult.error)) {
			throw disabledResult.error;
		}
	} else {
		disabledOriginIds = new Set(
			(disabledResult.data as DisabledOriginRow[] | null | undefined ?? []).map((row) => row.origin_id)
		);
	}

	const rows = (originResult.data ?? []) as (OriginRow & { is_enabled?: boolean | null })[];
	return rows.map((origin) => ({
		...origin,
		is_enabled: !disabledOriginIds.has(origin.id)
	}));
}

export async function saveOriginRecord(
	form: OriginFormData,
	client: Rev2Client = supabase
): Promise<OriginRow> {
	const sanitized = sanitizeOriginForm(form);
	let originId = sanitized.id;

	const payload = {
		name: sanitized.name,
		position: sanitized.position,
		icon_emoji: sanitized.icon_emoji || null,
		icon_png: sanitized.icon_png || null,
		icon_token_png: sanitized.icon_token_png || null,
		color: sanitized.color || null,
		description: sanitized.description || null,
		updated_at: new Date().toISOString()
	};

	if (originId) {
		const { error } = await client.from('origins').update(payload).eq('id', originId);
		if (error) throw error;
	} else {
		const { data, error } = await client.from('origins').insert(payload).select('*').single();
		if (error) throw error;
		originId = data?.id ?? null;
	}

	if (!originId) {
		throw new Error('Unable to determine origin id after save.');
	}

	await syncOriginEnabledState(originId, sanitized.is_enabled, client);

	const { data, error } = await client.from('origins').select('*').eq('id', originId).single();
	if (error) throw error;
	return {
		...(data as OriginRow),
		is_enabled: sanitized.is_enabled
	};
}

export async function deleteOriginRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('origins').delete().eq('id', id);
	if (error) throw error;
	try {
		const { error: disabledDeleteError } = await client.from('disabled_origins').delete().eq('origin_id', id);
		if (disabledDeleteError && !isMissingDisabledOriginsTableError(disabledDeleteError)) {
			throw disabledDeleteError;
		}
	} catch (err) {
		if (!isMissingDisabledOriginsTableError(err)) {
			throw err;
		}
	}
}

export async function setOriginEnabled(
	originId: string,
	enabled: boolean,
	client: Rev2Client = supabase
): Promise<void> {
	const now = new Date().toISOString();
	await syncOriginEnabledState(originId, enabled, client, now);
	if (enabled) {
		await restoreLinkedSpiritsForOrigin(originId, client);
		return;
	}
	await archiveLinkedSpiritsForOrigin(originId, client, now);
}

function sanitizeOriginForm(form: OriginFormData): OriginFormData {
	const name = form.name.trim();
	const position = Number.isFinite(form.position) ? Math.max(1, Math.round(form.position)) : 1;
	const icon_emoji = form.icon_emoji.trim();
	const icon_png = form.icon_png?.trim() || null;
	const icon_token_png = form.icon_token_png?.trim() || null;
	const color = form.color.trim() || DEFAULT_COLOR;
	const description = form.description.replace(/\r\n/g, '\n').trim();

	return {
		...form,
		name,
		position,
		icon_emoji,
		icon_png,
		icon_token_png,
		color,
		description
	};
}

function isMissingDisabledOriginsTableError(error: unknown): boolean {
	const err = error as { code?: string; message?: string; details?: string } | undefined | null;
	const code = err?.code;
	const message = (err?.message ?? err?.details ?? '').toLowerCase();
	return (
		code === '42P01' ||
		code === 'PGRST116' ||
		code === 'PGRST404' ||
		message.includes('relation \"disabled_origins\" does not exist') ||
		message.includes('relation "disabled_origins" does not exist')
	);
}

function isMissingDisabledSpiritsTableError(error: unknown): boolean {
	const err = error as { code?: string; message?: string; details?: string } | undefined | null;
	const code = err?.code;
	const message = (err?.message ?? err?.details ?? '').toLowerCase();
	return (
		code === '42P01' ||
		code === 'PGRST116' ||
		code === 'PGRST404' ||
		message.includes('relation \"disabled_hex_spirits\" does not exist') ||
		message.includes('relation "disabled_hex_spirits" does not exist')
	);
}

async function syncOriginEnabledState(
	originId: string,
	enabled: boolean,
	client: Rev2Client,
	updatedAt = new Date().toISOString()
): Promise<void> {
	try {
		if (enabled) {
			const { error } = await client.from('disabled_origins').delete().eq('origin_id', originId);
			if (error && !isMissingDisabledOriginsTableError(error)) throw error;
		} else {
			const { error } = await client
				.from('disabled_origins')
				.upsert(
					{ origin_id: originId, disabled_at: updatedAt, reason: ORIGIN_DISABLE_REASON },
					{ onConflict: 'origin_id' }
				);
			if (error) {
				const err = error as { code?: string; message?: string } | null | undefined;
				if (
					isMissingDisabledOriginsTableError(error) ||
					err?.code === '23505' ||
					(err?.message ?? '').toLowerCase().includes('duplicate key')
				) {
					// Ignore duplicate-disable attempts and missing-table edge cases.
				} else {
					throw error;
				}
			}
		}
	} catch (error) {
		if (!isMissingDisabledOriginsTableError(error)) {
			throw error;
		}
	}

}

type ArchivedSpiritRow = HexSpiritRow & {
	disabled_at: string | null;
	disabled_origin_id: string | null;
};

function getOriginIdsFromTraits(traits: unknown): string[] {
	if (!traits || typeof traits !== 'object' || Array.isArray(traits)) return [];
	const raw = (traits as { origin_ids?: unknown }).origin_ids;
	if (!Array.isArray(raw)) return [];
	return raw.filter((value): value is string => typeof value === 'string');
}

function toActiveSpiritPayload(row: ArchivedSpiritRow): HexSpiritRow {
	const { disabled_at: _disabledAt, disabled_origin_id: _disabledOriginId, ...spirit } = row;
	return spirit as HexSpiritRow;
}

async function archiveLinkedSpiritsForOrigin(
	originId: string,
	client: Rev2Client,
	updatedAt: string
): Promise<void> {
	const { data, error } = await client.from('hex_spirits').select('*');
	if (error) throw error;

	const linked = ((data ?? []) as HexSpiritRow[]).filter((spirit) =>
		getOriginIdsFromTraits(spirit.traits).includes(originId)
	);
	if (linked.length === 0) return;

	const linkedIds = linked.map((spirit) => spirit.id);
	const { data: existingArchived, error: existingArchivedError } = await client
		.from('disabled_hex_spirits')
		.select('id')
		.in('id', linkedIds);
	if (existingArchivedError) {
		if (isMissingDisabledSpiritsTableError(existingArchivedError)) {
			throw new Error('disabled_hex_spirits archive table is missing. Run the latest migration.');
		}
		throw existingArchivedError;
	}

	const existingArchivedIds = new Set(
		((existingArchived ?? []) as { id: string }[]).map((row) => row.id)
	);
	const archivePayload = linked
		.filter((spirit) => !existingArchivedIds.has(spirit.id))
		.map((spirit) => ({
			...spirit,
			disabled_at: updatedAt,
			disabled_origin_id: originId
		}));

	if (archivePayload.length > 0) {
		const { error: archiveError } = await client.from('disabled_hex_spirits').insert(archivePayload);
		if (archiveError) {
			if (isMissingDisabledSpiritsTableError(archiveError)) {
				throw new Error('disabled_hex_spirits archive table is missing. Run the latest migration.');
			}
			throw archiveError;
		}
	}

	const { error: deleteError } = await client
		.from('hex_spirits')
		.delete()
		.in('id', linked.map((spirit) => spirit.id));
	if (deleteError) throw deleteError;
}

async function restoreLinkedSpiritsForOrigin(originId: string, client: Rev2Client): Promise<void> {
	const { data: archivedData, error: archivedError } = await client
		.from('disabled_hex_spirits')
		.select('*');
	if (archivedError) {
		if (isMissingDisabledSpiritsTableError(archivedError)) {
			throw new Error('disabled_hex_spirits archive table is missing. Run the latest migration.');
		}
		throw archivedError;
	}

	const linkedArchived = ((archivedData ?? []) as ArchivedSpiritRow[]).filter((spirit) =>
		getOriginIdsFromTraits(spirit.traits).includes(originId)
	);
	if (linkedArchived.length === 0) return;

	const { data: disabledOriginsData, error: disabledOriginsError } = await client
		.from('disabled_origins')
		.select('origin_id');
	if (disabledOriginsError && !isMissingDisabledOriginsTableError(disabledOriginsError)) {
		throw disabledOriginsError;
	}

	const disabledOriginIds = new Set(
		(disabledOriginsData as DisabledOriginRow[] | null | undefined ?? []).map((row) => row.origin_id)
	);
	const restoreCandidates = linkedArchived.filter((spirit) =>
		getOriginIdsFromTraits(spirit.traits).every((linkedOriginId) => !disabledOriginIds.has(linkedOriginId))
	);
	if (restoreCandidates.length === 0) return;

	const payload = restoreCandidates.map(toActiveSpiritPayload);
	const { error: restoreError } = await client.from('hex_spirits').upsert(payload, { onConflict: 'id' });
	if (restoreError) throw restoreError;

	const { error: cleanupError } = await client
		.from('disabled_hex_spirits')
		.delete()
		.in('id', restoreCandidates.map((spirit) => spirit.id));
	if (cleanupError) throw cleanupError;
}
