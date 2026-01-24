import type { Json, StageCardKind } from './gameData';

export type StageEventRenderStyle =
	| 'event_v6'
	| 'event_v6_ember'
	| 'event_v6_frost'
	| 'event_v6_verdant'
	| 'event_v6_shadow'
	| 'event_v6_radiant'
	| 'event_v6_crimson'
	| 'event_v6_void'
	| 'event_v6_fairy'
	| (string & {});
export type StageLocationRenderStyle =
	| 'stage_location_v6_arcane'
	| 'stage_location_v6_ember'
	| 'stage_location_v6_frost'
	| 'stage_location_v6_verdant'
	| 'stage_location_v6_shadow'
	| 'stage_location_v6_radiant'
	| 'stage_location_v6_crimson'
	| 'stage_location_v6_void'
	| 'stage_location_v6_fairy'
	| 'stage_location_v6_parchment'
	| 'stage_location_v6_cartographer'
	| 'stage_location_v6_merchant'
	| 'stage_location_v6_ancient'
	| (string & {});
export type StageCardRenderStyle = StageEventRenderStyle | StageLocationRenderStyle;

export const DEFAULT_STAGE_EVENT_RENDER_STYLE: StageEventRenderStyle = 'event_v6';
export const DEFAULT_STAGE_LOCATION_RENDER_STYLE: StageLocationRenderStyle = 'stage_location_v6_arcane';

export const STAGE_EVENT_RENDER_STYLE_OPTIONS: { value: StageEventRenderStyle; label: string }[] = [
	{ value: 'event_v6', label: 'Arcane' },
	{ value: 'event_v6_ember', label: 'Ember' },
	{ value: 'event_v6_frost', label: 'Frost' },
	{ value: 'event_v6_verdant', label: 'Verdant' },
	{ value: 'event_v6_shadow', label: 'Shadow' },
	{ value: 'event_v6_radiant', label: 'Radiant' },
	{ value: 'event_v6_crimson', label: 'Crimson' },
	{ value: 'event_v6_void', label: 'Void' },
	{ value: 'event_v6_fairy', label: 'Fairy' }
];

export const STAGE_LOCATION_RENDER_STYLE_OPTIONS: { value: StageLocationRenderStyle; label: string }[] = [
	{ value: 'stage_location_v6_arcane', label: 'Arcane' },
	{ value: 'stage_location_v6_ember', label: 'Ember' },
	{ value: 'stage_location_v6_frost', label: 'Frost' },
	{ value: 'stage_location_v6_verdant', label: 'Verdant' },
	{ value: 'stage_location_v6_shadow', label: 'Shadow' },
	{ value: 'stage_location_v6_radiant', label: 'Radiant' },
	{ value: 'stage_location_v6_crimson', label: 'Crimson' },
	{ value: 'stage_location_v6_void', label: 'Void' },
	{ value: 'stage_location_v6_fairy', label: 'Fairy' },
	{ value: 'stage_location_v6_parchment', label: 'Parchment' },
	{ value: 'stage_location_v6_cartographer', label: 'Cartographer' },
	{ value: 'stage_location_v6_merchant', label: 'Merchant' },
	{ value: 'stage_location_v6_ancient', label: 'Ancient' }
];

function asPlainObject(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

export function getStageCardRenderStyle(cardKind: StageCardKind | string, data: unknown): StageCardRenderStyle {
	const obj = asPlainObject(data);
	const raw = obj?.render_style;
	if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim() as StageCardRenderStyle;

	if (cardKind === 'stage_location') return DEFAULT_STAGE_LOCATION_RENDER_STYLE;
	return DEFAULT_STAGE_EVENT_RENDER_STYLE;
}

export function setStageCardRenderStyleInData(existingData: Json | unknown, renderStyle: StageCardRenderStyle): Json {
	const base = asPlainObject(existingData) ?? {};
	return { ...base, render_style: renderStyle } as unknown as Json;
}
