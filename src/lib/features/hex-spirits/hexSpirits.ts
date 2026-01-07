import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { HexSpiritRow } from '$lib/types/gameData';

export type HexSpiritNameTranslation = { lang: string; name: string };

export interface HexSpiritFormData {
	id?: string;
	name: string;
	/** Optional localized names. Primary name remains `name`. */
	name_translations: HexSpiritNameTranslation[];
	cost: number;
	origin_id?: string | null; // UI convenience
	class_id?: string | null; // UI convenience
	traits: {
		origin_ids: string[];
		class_ids: string[];
	};
	game_print_image_path: string | null;
	game_print_no_icons: string | null;
	art_raw_image_path: string | null;
	/** Optional override for the PSD folder used during Photoshop export */
	psd_folder_override: string | null;
	/** If true, game_print_image_path is manually set and should not be overwritten by icon placer */
	manual_game_print: boolean;
	/** Array of rune IDs required to play this spirit. Duplicates mean multiple of that rune needed. */
	rune_cost: string[];
}

const DEFAULT_COST = 1;

export function emptyHexSpiritForm(): HexSpiritFormData {
	return {
		name: '',
		name_translations: [],
		cost: DEFAULT_COST,
		origin_id: null,
		class_id: null,
		traits: { origin_ids: [], class_ids: [] },
		game_print_image_path: null,
		game_print_no_icons: null,
		art_raw_image_path: null,
		psd_folder_override: null,
		manual_game_print: false,
		rune_cost: []
	};
}

export function hexSpiritRowToForm(row: HexSpiritRow): HexSpiritFormData {
	// Load traits directly - duplicates are allowed
	const origin_ids = row.traits?.origin_ids ?? [];
	const class_ids = row.traits?.class_ids ?? [];
	const translations = normalizeNameTranslations((row as { name_translations?: unknown }).name_translations);

	return {
		id: row.id,
		name: row.name,
		name_translations: translations,
		cost: row.cost,
		origin_id: origin_ids[0] ?? null, // UI convenience only
		class_id: class_ids[0] ?? null, // UI convenience only
		traits: { origin_ids, class_ids },
		game_print_image_path: row.game_print_image_path,
		game_print_no_icons: row.game_print_no_icons,
		art_raw_image_path: row.art_raw_image_path,
		psd_folder_override: row.psd_folder_override,
		manual_game_print: row.manual_game_print ?? false,
		rune_cost: row.rune_cost ?? []
	};
}

export async function fetchHexSpiritRecords(
	client: Rev2Client = supabase
): Promise<HexSpiritRow[]> {
	const { data, error } = await client.from('hex_spirits').select('*').order('name', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function saveHexSpiritRecord(
	form: HexSpiritFormData,
	client: Rev2Client = supabase
): Promise<HexSpiritRow> {
	const sanitized = sanitizeHexSpiritForm(form);
	let spiritId = sanitized.id;
	const name_translations = nameTranslationsToRecord(sanitized.name_translations);

	const payload = {
		name: sanitized.name,
		name_translations,
		cost: sanitized.cost,
		traits: sanitized.traits,
		game_print_image_path: sanitized.game_print_image_path,
		game_print_no_icons: sanitized.game_print_no_icons,
		art_raw_image_path: sanitized.art_raw_image_path,
		psd_folder_override: sanitized.psd_folder_override,
		manual_game_print: sanitized.manual_game_print,
		rune_cost: sanitized.rune_cost,
		updated_at: new Date().toISOString()
	};

	if (spiritId) {
		const { error } = await client.from('hex_spirits').update(payload).eq('id', spiritId);
		if (error) throw error;
	} else {
		const { data, error } = await client.from('hex_spirits').insert(payload).select('*').single();
		if (error) throw error;
		spiritId = data?.id ?? null;
	}

	if (!spiritId) {
		throw new Error('Unable to determine hex spirit id after save.');
	}

	const { data, error } = await client.from('hex_spirits').select('*').eq('id', spiritId).single();
	if (error) throw error;
	return data;
}

export async function deleteHexSpiritRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('hex_spirits').delete().eq('id', id);
	if (error) throw error;
}

function sanitizeHexSpiritForm(form: HexSpiritFormData): HexSpiritFormData {
	const name = form.name.trim();
	const name_translations = normalizeNameTranslations(form.name_translations);
	const cost = Number.isFinite(form.cost) ? Math.max(1, Math.round(form.cost)) : DEFAULT_COST;

	// Use traits directly - the page manages origin_ids and class_ids arrays
	// Duplicates are allowed (e.g., 2x of the same origin)
	const origin_ids = (form.traits?.origin_ids ?? []).filter((v): v is string => Boolean(v));
	const class_ids = (form.traits?.class_ids ?? []).filter((v): v is string => Boolean(v));

	const game_print_image_path = form.game_print_image_path?.trim() || null;
	const game_print_no_icons = form.game_print_no_icons?.trim() || null;
	const art_raw_image_path = form.art_raw_image_path?.trim() || null;
	const psd_folder_override = form.psd_folder_override?.trim() || null;
	const manual_game_print = Boolean(form.manual_game_print);
	const rune_cost = (form.rune_cost ?? []).filter((v): v is string => Boolean(v));

	return {
		...form,
		name,
		name_translations,
		cost,
		traits: { origin_ids, class_ids },
		game_print_image_path,
		game_print_no_icons,
		art_raw_image_path,
		psd_folder_override,
		manual_game_print,
		rune_cost
	};
}

function normalizeNameTranslations(input: unknown): HexSpiritNameTranslation[] {
	const normalizedRows: HexSpiritNameTranslation[] = [];

	if (Array.isArray(input)) {
		for (const row of input) {
			const langRaw = typeof (row as any)?.lang === 'string' ? (row as any).lang : '';
			const nameRaw = typeof (row as any)?.name === 'string' ? (row as any).name : '';
			const lang = langRaw.trim().replace(/_/g, '-').toLowerCase();
			const name = nameRaw.trim();
			if (!lang || !name) continue;
			normalizedRows.push({ lang, name });
		}
	} else if (input && typeof input === 'object') {
		for (const [langRaw, nameRaw] of Object.entries(input as Record<string, unknown>)) {
			if (typeof nameRaw !== 'string') continue;
			const lang = String(langRaw).trim().replace(/_/g, '-').toLowerCase();
			const name = nameRaw.trim();
			if (!lang || !name) continue;
			normalizedRows.push({ lang, name });
		}
	}

	const deduped = new Map<string, string>();
	for (const row of normalizedRows) {
		deduped.set(row.lang, row.name);
	}

	return [...deduped.entries()]
		.map(([lang, name]) => ({ lang, name }))
		.sort((a, b) => a.lang.localeCompare(b.lang));
}

function nameTranslationsToRecord(rows: HexSpiritNameTranslation[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const row of rows) {
		out[row.lang] = row.name;
	}
	return out;
}
