import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type {
	AwakenCondition,
	HexSpiritArtRawVariantRow,
	HexSpiritArtRawVariantSource,
	HexSpiritRow
} from '$lib/types/gameData';
import { normalizeAwakenRuneTokens, isAwakenOrRuneToken } from '$lib/utils/awakenRuneTokens';

export type HexSpiritNameTranslation = { lang: string; name: string };
export type HexSpiritDescriptionTranslation = { lang: string; description: string };

export type HexSpiritArtRawVariantOutputPatch = Partial<{
	game_print_no_icons_path: string | null;
	game_print_image_path: string | null;
	back_side_base_path: string | null;
	back_side_export_path: string | null;
	tts_combined_image_path: string | null;
	is_variation_selected: boolean;
	pipeline_status: string | null;
	pipeline_error: string | null;
}>;

export interface HexSpiritFormData {
	id?: string;
	name: string;
	description: string | null;
	/** Optional localized names. Primary name remains `name`. */
	name_translations: HexSpiritNameTranslation[];
	/** Optional localized descriptions. Primary description remains `description`. */
	description_translations: HexSpiritDescriptionTranslation[];
	cost: number;
	origin_id?: string | null; // UI convenience
	class_id?: string | null; // UI convenience
	traits: {
		origin_ids: string[];
		class_ids: string[];
	};
	game_print_image_path: string | null;
	game_print_no_icons_path: string | null;
	art_raw_image_path: string | null;
	/** Optional override for the PSD folder used during Photoshop export */
	psd_folder_override: string | null;
	/** If true, game_print_image_path is manually set and should not be overwritten by icon placer */
	manual_game_print: boolean;
	/** Awaken condition: rune cost or text. Null means no condition. */
	awaken_condition: AwakenCondition | null;
	/** Uploaded base image for the back side (no icons). */
	back_side_base: string | null;
	/** Final back side image (exported with icons or manually set). */
	back_side_export: string | null;
	/** Combined front+back texture for TTS Custom_Model hex tokens. */
	tts_combined_image_path: string | null;
}

const DEFAULT_COST = 1;

export function emptyHexSpiritForm(): HexSpiritFormData {
	return {
		name: '',
		description: null,
		name_translations: [],
		description_translations: [],
		cost: DEFAULT_COST,
		origin_id: null,
		class_id: null,
		traits: { origin_ids: [], class_ids: [] },
		game_print_image_path: null,
		game_print_no_icons_path: null,
		art_raw_image_path: null,
		psd_folder_override: null,
		manual_game_print: false,
		awaken_condition: null,
		back_side_base: null,
		back_side_export: null,
		tts_combined_image_path: null
	};
}

export function hexSpiritRowToForm(row: HexSpiritRow): HexSpiritFormData {
	// Load traits directly - duplicates are allowed
	const origin_ids = row.traits?.origin_ids ?? [];
	const class_ids = row.traits?.class_ids ?? [];
	const translations = normalizeNameTranslations((row as { name_translations?: unknown }).name_translations);
	const descriptionTranslations = normalizeDescriptionTranslations(
		(row as { description_translations?: unknown }).description_translations
	);

	return {
		id: row.id,
		name: row.name,
		description: row.description ?? null,
		name_translations: translations,
		description_translations: descriptionTranslations,
		cost: row.cost,
		origin_id: origin_ids[0] ?? null, // UI convenience only
		class_id: class_ids[0] ?? null, // UI convenience only
		traits: { origin_ids, class_ids },
		game_print_image_path: row.game_print_image_path,
		game_print_no_icons_path: row.game_print_no_icons_path,
		art_raw_image_path: row.art_raw_image_path,
		psd_folder_override: row.psd_folder_override,
		manual_game_print: row.manual_game_print ?? false,
		awaken_condition: row.awaken_condition ?? null,
		back_side_base: row.back_side_base ?? null,
		back_side_export: row.back_side_export ?? null,
		tts_combined_image_path: row.tts_combined_image_path ?? null
	};
}

export async function fetchHexSpiritRecords(
	client: Rev2Client = supabase
): Promise<HexSpiritRow[]> {
	const [spiritResult, disabledOriginsResult] = await Promise.all([
		client
			.from('hex_spirits')
			.select('*')
			.order('cost', { ascending: true })
			.order('name', { ascending: true }),
		client.from('disabled_origins').select('origin_id')
	]);
	if (spiritResult.error) throw spiritResult.error;

	const spirits = (spiritResult.data ?? []) as HexSpiritRow[];
	if (disabledOriginsResult.error) return spirits;

	const disabledOriginIds = new Set(
		((disabledOriginsResult.data ?? []) as { origin_id: string }[]).map((row) => row.origin_id)
	);
	if (disabledOriginIds.size === 0) return spirits;

	return spirits.filter((spirit) => {
		const originIds = spirit.traits?.origin_ids ?? [];
		return !originIds.some((originId) => disabledOriginIds.has(originId));
	});
}

export async function saveHexSpiritRecord(
	form: HexSpiritFormData,
	client: Rev2Client = supabase
): Promise<HexSpiritRow> {
	const sanitized = sanitizeHexSpiritForm(form);
	let spiritId = sanitized.id;
	const name_translations = nameTranslationsToRecord(sanitized.name_translations);
	const description_translations = descriptionTranslationsToRecord(sanitized.description_translations);

	const payload = {
		name: sanitized.name,
		description: sanitized.description,
		name_translations,
		description_translations,
		cost: sanitized.cost,
		traits: sanitized.traits,
		game_print_image_path: sanitized.game_print_image_path,
		game_print_no_icons_path: sanitized.game_print_no_icons_path,
		art_raw_image_path: sanitized.art_raw_image_path,
		psd_folder_override: sanitized.psd_folder_override,
		manual_game_print: sanitized.manual_game_print,
		awaken_condition: sanitized.awaken_condition,
		back_side_base: sanitized.back_side_base,
		back_side_export: sanitized.back_side_export,
		tts_combined_image_path: sanitized.tts_combined_image_path,
		updated_at: new Date().toISOString()
	};

	if (spiritId) {
		const { error } = await client.from('hex_spirits').update(payload).eq('id', spiritId);
		if (error) throw error;
	} else {
		const { data, error } = await client
			.from('hex_spirits')
			.insert(payload)
			.select('*')
			.single();
		if (error) throw error;
		spiritId = data?.id ?? null;
	}

	if (!spiritId) {
		throw new Error('Unable to determine hex spirit id after save.');
	}

	const { data, error } = await client.from('hex_spirits').select('*').eq('id', spiritId).single();
	if (error) throw error;
	return data as HexSpiritRow;
}

export async function deleteHexSpiritRecord(id: string, client: Rev2Client = supabase): Promise<void> {
	const { error } = await client.from('hex_spirits').delete().eq('id', id);
	if (error) throw error;
}

function sanitizeHexSpiritForm(form: HexSpiritFormData): HexSpiritFormData {
	const name = form.name.trim();
	const description = form.description?.trim() || null;
	const name_translations = normalizeNameTranslations(form.name_translations);
	const description_translations = normalizeDescriptionTranslations(form.description_translations);
	const cost = Number.isFinite(form.cost) ? Math.max(1, Math.round(form.cost)) : DEFAULT_COST;

	// Use traits directly - the page manages origin_ids and class_ids arrays
	// Duplicates are allowed (e.g., 2x of the same origin)
	const origin_ids = (form.traits?.origin_ids ?? []).filter((v): v is string => Boolean(v));
	const class_ids = (form.traits?.class_ids ?? []).filter((v): v is string => Boolean(v));

	const game_print_image_path = form.game_print_image_path?.trim() || null;
	const game_print_no_icons_path = form.game_print_no_icons_path?.trim() || null;
	const art_raw_image_path = form.art_raw_image_path?.trim() || null;
	const psd_folder_override = form.psd_folder_override?.trim() || null;
	const manual_game_print = Boolean(form.manual_game_print);
	const back_side_base = form.back_side_base?.trim() || null;
	const back_side_export = form.back_side_export?.trim() || null;
	const tts_combined_image_path = form.tts_combined_image_path?.trim() || null;

	// Sanitize awaken_condition: normalize empty values to null
	let awaken_condition: AwakenCondition | null = null;
	if (form.awaken_condition) {
		if (form.awaken_condition.type === 'rune_cost') {
			const tokens = normalizeAwakenRuneTokens(form.awaken_condition.rune_ids);
			// Filter out empty OR tokens (those with no rune_ids)
			const rune_ids = tokens.filter((t) => {
				if (typeof t === 'string') return Boolean(t);
				if (isAwakenOrRuneToken(t)) return (t.rune_ids?.length ?? 0) > 0;
				return false;
			});
			if (rune_ids.length > 0) {
				awaken_condition = { type: 'rune_cost', rune_ids };
			}
		} else if (form.awaken_condition.type === 'text') {
			const text = (form.awaken_condition.text ?? '').trim();
			if (text.length > 0) {
				awaken_condition = { type: 'text', text };
			}
		}
	}

	return {
		...form,
		name,
		description,
		name_translations,
		description_translations,
		cost,
		traits: { origin_ids, class_ids },
		game_print_image_path,
		game_print_no_icons_path,
		art_raw_image_path,
		psd_folder_override,
		manual_game_print,
		awaken_condition,
		back_side_base,
		back_side_export,
		tts_combined_image_path
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

function normalizeDescriptionTranslations(input: unknown): HexSpiritDescriptionTranslation[] {
	const normalizedRows: HexSpiritDescriptionTranslation[] = [];

	if (Array.isArray(input)) {
		for (const row of input) {
			const langRaw = typeof (row as any)?.lang === 'string' ? (row as any).lang : '';
			const descriptionRaw =
				typeof (row as any)?.description === 'string' ? (row as any).description : '';
			const lang = langRaw.trim().replace(/_/g, '-').toLowerCase();
			const description = descriptionRaw.trim();
			if (!lang || !description) continue;
			normalizedRows.push({ lang, description });
		}
	} else if (input && typeof input === 'object') {
		for (const [langRaw, descriptionRaw] of Object.entries(input as Record<string, unknown>)) {
			if (typeof descriptionRaw !== 'string') continue;
			const lang = String(langRaw).trim().replace(/_/g, '-').toLowerCase();
			const description = descriptionRaw.trim();
			if (!lang || !description) continue;
			normalizedRows.push({ lang, description });
		}
	}

	const deduped = new Map<string, string>();
	for (const row of normalizedRows) {
		deduped.set(row.lang, row.description);
	}

	return [...deduped.entries()]
		.map(([lang, description]) => ({ lang, description }))
		.sort((a, b) => a.lang.localeCompare(b.lang));
}

function descriptionTranslationsToRecord(rows: HexSpiritDescriptionTranslation[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const row of rows) {
		out[row.lang] = row.description;
	}
	return out;
}

export function normalizeArtRawVariantLabel(label: string | null | undefined, fallback: string): string {
	const normalized = (label ?? '').trim().replace(/\s+/g, ' ');
	return normalized || fallback;
}

function sanitizeFileNamePart(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 60);
}

export function buildArtRawVariantUploadTarget({
	spiritId,
	spiritName,
	label
}: {
	spiritId: string;
	spiritName: string;
	label: string;
}): { folder: string; filename: string } {
	const spiritSlug = sanitizeFileNamePart(spiritName) || 'spirit';
	const labelSlug = sanitizeFileNamePart(label) || 'variant';
	return {
		folder: `hex_spirits/${spiritId}/art_raw_variations`,
		filename: `hex_${spiritSlug}_${labelSlug}`
	};
}

export function normalizeHexSpiritBucketPath(path: string | null | undefined): string {
	if (!path) return '';
	let normalized = path.trim().replace(/^\/+/, '');
	if (normalized.startsWith('game_assets/')) {
		normalized = normalized.slice('game_assets/'.length);
	}
	return normalized;
}

export function isArtRawVariantCurrent(
	variant: Pick<HexSpiritArtRawVariantRow, 'storage_path'>,
	currentPath: string | null | undefined
): boolean {
	return normalizeHexSpiritBucketPath(variant.storage_path) === normalizeHexSpiritBucketPath(currentPath);
}

const VARIATION_EXPORT_SEPARATOR = '__variant__';

export function buildVariationExportId(spiritId: string, variantId: string): string {
	return `${spiritId}${VARIATION_EXPORT_SEPARATOR}${variantId}`;
}

export function parseVariationExportId(
	exportId: string | null | undefined
): { spiritId: string; variantId: string } | null {
	if (!exportId) return null;
	const parts = exportId.split(VARIATION_EXPORT_SEPARATOR);
	if (parts.length !== 2) return null;
	const [spiritId, variantId] = parts.map((part) => part.trim());
	if (!spiritId || !variantId) return null;
	return { spiritId, variantId };
}

function normalizeVariantOutputPatch(
	patch: HexSpiritArtRawVariantOutputPatch
): HexSpiritArtRawVariantOutputPatch {
	const pathKeys = [
		'game_print_no_icons_path',
		'game_print_image_path',
		'back_side_base_path',
		'back_side_export_path',
		'tts_combined_image_path'
	] as const;
	const normalized: HexSpiritArtRawVariantOutputPatch = { ...patch };

	for (const key of pathKeys) {
		if (!(key in normalized)) continue;
		const value = normalized[key];
		normalized[key] = value ? normalizeHexSpiritBucketPath(value) : null;
	}

	return normalized;
}

export async function fetchArtRawVariantRecords(
	client: Rev2Client = supabase
): Promise<HexSpiritArtRawVariantRow[]> {
	const { data, error } = await client
		.from('hex_spirit_art_raw_variants')
		.select('*')
		.order('created_at', { ascending: true });
	if (error) throw error;
	return (data ?? []) as HexSpiritArtRawVariantRow[];
}

export async function createArtRawVariantRecord(
	input: {
		hex_spirit_id: string;
		label: string;
		description?: string | null;
		storage_path: string;
		source?: HexSpiritArtRawVariantSource;
		prompt?: string | null;
	},
	client: Rev2Client = supabase
): Promise<HexSpiritArtRawVariantRow> {
	const label = normalizeArtRawVariantLabel(input.label, 'Art raw variation');
	const payload = {
		hex_spirit_id: input.hex_spirit_id,
		label,
		description: input.description?.trim() || null,
		storage_path: normalizeHexSpiritBucketPath(input.storage_path),
		source: input.source ?? 'uploaded',
		prompt: input.prompt?.trim() || null,
		updated_at: new Date().toISOString()
	};
	const { data, error } = await client
		.from('hex_spirit_art_raw_variants')
		.upsert(payload, { onConflict: 'hex_spirit_id,storage_path' })
		.select('*')
		.single();
	if (error) throw error;
	return data as HexSpiritArtRawVariantRow;
}

export async function useArtRawVariantAsCurrent(
	variant: Pick<HexSpiritArtRawVariantRow, 'hex_spirit_id' | 'storage_path'>,
	client: Rev2Client = supabase
): Promise<void> {
	const { error } = await client
		.from('hex_spirits')
		.update({
			art_raw_image_path: normalizeHexSpiritBucketPath(variant.storage_path),
			updated_at: new Date().toISOString()
		})
		.eq('id', variant.hex_spirit_id);
	if (error) throw error;
}

export async function updateArtRawVariantOutputs(
	variantId: string,
	patch: HexSpiritArtRawVariantOutputPatch,
	client: Rev2Client = supabase
): Promise<void> {
	const payload = {
		...normalizeVariantOutputPatch(patch),
		updated_at: new Date().toISOString()
	};
	const { error } = await client
		.from('hex_spirit_art_raw_variants')
		.update(payload)
		.eq('id', variantId);
	if (error) throw error;
}

export async function selectVariationForSpirit(
	spiritId: string,
	variantId: string,
	client: Rev2Client = supabase
): Promise<void> {
	const { error: clearError } = await client
		.from('hex_spirit_art_raw_variants')
		.update({ is_variation_selected: false, updated_at: new Date().toISOString() })
		.eq('hex_spirit_id', spiritId);
	if (clearError) throw clearError;

	const { error: selectError } = await client
		.from('hex_spirit_art_raw_variants')
		.update({ is_variation_selected: true, updated_at: new Date().toISOString() })
		.eq('hex_spirit_id', spiritId)
		.eq('id', variantId);
	if (selectError) throw selectError;
}

export async function clearSelectedVariationForSpirit(
	spiritId: string,
	client: Rev2Client = supabase
): Promise<void> {
	const { error } = await client
		.from('hex_spirit_art_raw_variants')
		.update({ is_variation_selected: false, updated_at: new Date().toISOString() })
		.eq('hex_spirit_id', spiritId);
	if (error) throw error;
}

export async function deleteArtRawVariantRecord(
	variantId: string,
	client: Rev2Client = supabase
): Promise<void> {
	const { error } = await client.from('hex_spirit_art_raw_variants').delete().eq('id', variantId);
	if (error) throw error;
}
