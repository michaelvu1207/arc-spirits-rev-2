/**
 * Shared coercion helpers for layout configs.
 *
 * These were previously duplicated across monsterCardIconPlacer.ts and
 * locationCardLayoutConfig.ts. Both modules now import from here.
 */

import type { Align, PlacedBox } from './layoutTypes';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function isAlign(v: unknown): v is Align {
	return v === 'left' || v === 'center' || v === 'right';
}

export function coerceFinite(v: unknown, fallback: number): number {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : fallback;
}

export function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Box coercion
// ---------------------------------------------------------------------------

export function coerceBox(raw: unknown, fallback: PlacedBox): PlacedBox {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const x = Math.max(0, Math.round(coerceFinite(o.x, fallback.x)));
	const y = Math.max(0, Math.round(coerceFinite(o.y, fallback.y)));
	const w = Math.max(1, Math.round(coerceFinite(o.w, fallback.w)));
	const h = Math.max(1, Math.round(coerceFinite(o.h, fallback.h)));
	return { x, y, w, h };
}

// ---------------------------------------------------------------------------
// Text placement coercion (PlacedBox + fontSize/lineHeight/align/color)
// ---------------------------------------------------------------------------

export type TextPlacement = PlacedBox & {
	fontSize: number;
	lineHeight?: number;
	align: Align;
	color: string;
};

export function coerceTextPlacement(raw: unknown, fallback: TextPlacement): TextPlacement {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const box = coerceBox(o, fallback);
	const fontSize = Math.max(1, Math.round(coerceFinite(o.fontSize, fallback.fontSize)));
	const align = isAlign(o.align) ? o.align : fallback.align;
	const color = typeof o.color === 'string' && o.color.trim() ? o.color : fallback.color;

	const hasLineHeight = Object.prototype.hasOwnProperty.call(o, 'lineHeight');
	const rawLineHeight = hasLineHeight ? o.lineHeight : undefined;
	const lineHeight =
		hasLineHeight && (rawLineHeight === null || rawLineHeight === '' || typeof rawLineHeight === 'undefined')
			? undefined
			: hasLineHeight
				? Math.max(0, Math.round(coerceFinite(rawLineHeight, fallback.lineHeight ?? Math.round(fontSize * 1.15))))
				: fallback.lineHeight;

	return { ...box, fontSize, lineHeight, align, color };
}

// ---------------------------------------------------------------------------
// Icons placement coercion (PlacedBox + iconSize/gap/maxPerRow)
// ---------------------------------------------------------------------------

export type IconsPlacement = PlacedBox & {
	iconSize: number;
	gap: number;
	maxPerRow: number;
};

export function coerceIconsPlacement(raw: unknown, fallback: IconsPlacement): IconsPlacement {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const box = coerceBox(o, fallback);
	const iconSize = Math.max(1, Math.round(coerceFinite(o.iconSize, fallback.iconSize)));
	const gap = Math.max(0, Math.round(coerceFinite(o.gap, fallback.gap)));
	const maxPerRow = Math.max(1, Math.round(coerceFinite(o.maxPerRow, fallback.maxPerRow)));
	return { ...box, iconSize, gap, maxPerRow };
}

// ---------------------------------------------------------------------------
// TextStyle coercion (shared with location configs)
// ---------------------------------------------------------------------------

export type TextStyle = {
	fontSize: number;
	lineHeight?: number;
	align: Align;
	color: string;
};

export function coerceTextStyle(raw: unknown, fallback: TextStyle): TextStyle {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return {
		fontSize: Math.max(1, Math.round(coerceFinite(o.fontSize, fallback.fontSize))),
		lineHeight:
			Object.prototype.hasOwnProperty.call(o, 'lineHeight') &&
			(o as Record<string, unknown>).lineHeight !== null &&
			(o as Record<string, unknown>).lineHeight !== '' &&
			typeof (o as Record<string, unknown>).lineHeight !== 'undefined'
				? Math.max(
						0,
						Math.round(
							coerceFinite(
								(o as Record<string, unknown>).lineHeight,
								fallback.lineHeight ?? Math.round(fallback.fontSize * 1.15)
							)
						)
					)
				: fallback.lineHeight,
		align: isAlign(o.align) ? o.align : fallback.align,
		color: typeof o.color === 'string' && o.color.trim() ? o.color : fallback.color
	};
}
