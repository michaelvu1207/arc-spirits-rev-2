/**
 * Shared types and helpers for the Event Card layout system.
 * Used by both the layout configurator (visual editor) and the generator (PNG export).
 */

export type Align = 'left' | 'center' | 'right';

export type TextStyle = {
	fontSize: number;
	lineHeight?: number;
	align: Align;
	color: string;
	fontFamily?: string;
};

export type Transform = {
	x: number;
	y: number;
	rotation: number;
	scale: number;
};

export type Box = { w: number; h: number };

export type EventCardPlacementKey = 'title' | 'description' | 'reward_row';

export type EventCardLayoutConfig = {
	_version: 1;
	_ref_w: number;
	_ref_h: number;
	placements: Record<EventCardPlacementKey, Transform>;
	text_boxes: Record<EventCardPlacementKey, Box>;
	text_styles: Record<EventCardPlacementKey, TextStyle>;
	defaultBaseImagePath?: string | null;
};

export const PLACEMENT_KEYS: { key: EventCardPlacementKey; label: string }[] = [
	{ key: 'title', label: 'Title' },
	{ key: 'description', label: 'Description' },
	{ key: 'reward_row', label: 'Reward Row' }
];

export function createDefaultConfig(refW: number, refH: number): EventCardLayoutConfig {
	return {
		_version: 1,
		_ref_w: refW,
		_ref_h: refH,
		placements: {
			title: { x: refW / 2, y: 50, rotation: 0, scale: 1 },
			description: { x: refW / 2, y: 180, rotation: 0, scale: 1 },
			reward_row: { x: refW / 2, y: refH - 60, rotation: 0, scale: 1 }
		},
		text_boxes: {
			title: { w: Math.round(refW * 0.8), h: 60 },
			description: { w: Math.round(refW * 0.75), h: 160 },
			reward_row: { w: Math.round(refW * 0.85), h: 50 }
		},
		text_styles: {
			title: { fontSize: 28, lineHeight: 32, align: 'center', color: '#ffffff', fontFamily: 'Opsilon' },
			description: { fontSize: 16, lineHeight: 20, align: 'center', color: '#e2e8f0' },
			reward_row: { fontSize: 14, lineHeight: 18, align: 'center', color: '#e2e8f0' }
		}
	};
}

function coerceFinite(v: unknown, fallback: number): number {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : fallback;
}

function isAlign(v: unknown): v is Align {
	return v === 'left' || v === 'center' || v === 'right';
}

function coerceTextStyle(raw: unknown, fallback: TextStyle): TextStyle {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return {
		fontSize: Math.max(1, Math.round(coerceFinite(o.fontSize, fallback.fontSize))),
		lineHeight:
			o.lineHeight != null
				? Math.max(
						0,
						Math.round(coerceFinite(o.lineHeight, fallback.lineHeight ?? fallback.fontSize * 1.2))
					)
				: fallback.lineHeight,
		align: isAlign(o.align) ? o.align : fallback.align,
		color: typeof o.color === 'string' && o.color.trim() ? o.color : fallback.color,
		fontFamily: typeof o.fontFamily === 'string' && o.fontFamily.trim() ? o.fontFamily : fallback.fontFamily
	};
}

export function coerceConfig(raw: unknown, fallbackW?: number, fallbackH?: number): EventCardLayoutConfig | null {
	if (!raw || typeof raw !== 'object') {
		if (fallbackW && fallbackH) return createDefaultConfig(fallbackW, fallbackH);
		return null;
	}
	const o = raw as Record<string, unknown>;
	const refW = typeof o._ref_w === 'number' && o._ref_w > 0 ? o._ref_w : fallbackW;
	const refH = typeof o._ref_h === 'number' && o._ref_h > 0 ? o._ref_h : fallbackH;
	if (!refW || !refH) return null;
	const defaults = createDefaultConfig(refW, refH);

	const keys: EventCardPlacementKey[] = ['title', 'description', 'reward_row'];
	const placements = { ...defaults.placements };
	const text_boxes = { ...defaults.text_boxes };
	const text_styles = { ...defaults.text_styles };

	const op = o.placements as Record<string, unknown> | undefined;
	const otb = o.text_boxes as Record<string, unknown> | undefined;
	const ots = o.text_styles as Record<string, unknown> | undefined;

	for (const k of keys) {
		if (op?.[k]) {
			const p = op[k] as Record<string, unknown>;
			placements[k] = {
				x: coerceFinite(p.x, defaults.placements[k].x),
				y: coerceFinite(p.y, defaults.placements[k].y),
				rotation: coerceFinite(p.rotation, 0),
				scale: Math.max(0.05, coerceFinite(p.scale, 1))
			};
		}
		if (otb?.[k]) {
			const b = otb[k] as Record<string, unknown>;
			text_boxes[k] = {
				w: Math.max(1, coerceFinite(b.w, defaults.text_boxes[k].w)),
				h: Math.max(1, coerceFinite(b.h, defaults.text_boxes[k].h))
			};
		}
		if (ots?.[k]) {
			text_styles[k] = coerceTextStyle(ots[k], defaults.text_styles[k]);
		}
	}

	const defaultBaseImagePath =
		typeof o.defaultBaseImagePath === 'string' && o.defaultBaseImagePath.trim()
			? o.defaultBaseImagePath
			: (o.defaultBaseImagePath === null ? null : undefined);

	return {
		_version: 1,
		_ref_w: refW,
		_ref_h: refH,
		placements,
		text_boxes,
		text_styles,
		defaultBaseImagePath
	};
}
