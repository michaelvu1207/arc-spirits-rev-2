/**
 * Location Icon Placer Generator
 * Composites reward row icons onto location background images.
 *
 * Config is stored in the database (with localStorage fallback/caching).
 */

import { createCanvas, getContext, loadImage, canvasToBlob } from '$lib/generators/shared/canvas';

function drawIconWithOutline(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const outline = 6;
	const naturalW = img.naturalWidth || img.width || w;
	const naturalH = img.naturalHeight || img.height || h;
	const safeW = naturalW > 0 ? naturalW : w;
	const safeH = naturalH > 0 ? naturalH : h;
	const scale = Math.min(w / safeW, h / safeH);
	const drawW = safeW * scale;
	const drawH = safeH * scale;
	const drawX = x + (w - drawW) / 2;
	const drawY = y + (h - drawH) / 2;
	const maskW = safeW;
	const maskH = safeH;
	const maskCanvas = createCanvas(maskW, maskH);
	const maskCtx = getContext(maskCanvas);
	maskCtx.drawImage(img, 0, 0, maskW, maskH);
	maskCtx.globalCompositeOperation = 'source-in';
	maskCtx.fillStyle = '#2b1a12';
	maskCtx.fillRect(0, 0, maskW, maskH);
	maskCtx.globalCompositeOperation = 'source-over';

	for (let dy = -outline; dy <= outline; dy++) {
		for (let dx = -outline; dx <= outline; dx++) {
			if (dx === 0 && dy === 0) continue;
			if (dx * dx + dy * dy > outline * outline) continue;
			ctx.drawImage(maskCanvas, drawX + dx, drawY + dy, drawW, drawH);
		}
	}
	ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

export interface IconSlot {
	x: number;
	y: number;
	/** Optional per-slot width (defaults to `_icon_size`). */
	w?: number;
	/** Optional per-slot height (defaults to `_icon_size`). */
	h?: number;
}

export interface LocationRowPlacement {
	gain_slots: IconSlot[];
	trade_cost_slots: IconSlot[];
	trade_gain_slots: IconSlot[];
}

export interface LocationRowBackgroundConfig {
	/** Storage path in `game_assets` bucket (relative path). */
	path: string | null;
	/** X coordinate in the base image coordinate space. */
	x: number;
	/** Y coordinate in the base image coordinate space. */
	y: number;
	/** Scale multiplier applied to the background image size. */
	scale: number;
}

export interface LocationIconPlacementConfig {
	_icon_size: number;
	/**
	 * Row template slots.
	 *
	 * Only the first row is used as the global template for rendering row PNGs
	 * (gain: 4 slots, trade cost: 2 slots, trade gain: 3 slots).
	 */
	rows: LocationRowPlacement[];
	gain_row_background: LocationRowBackgroundConfig;
	trade_row_background: LocationRowBackgroundConfig;
	text_row_background: LocationRowBackgroundConfig;
}

export type LocationRewardRowIcons = {
	type: 'gain';
	gainIconUrls: string[];
} | {
	type: 'trade';
	costIconUrls: string[];
	gainIconUrls: string[];
};

export interface GenerateLocationWithIconsOptions {
	backgroundUrl: string;
	rewardRows: LocationRewardRowIcons[];
	config: LocationIconPlacementConfig;
	gainRowBackgroundUrl?: string | null;
	tradeRowBackgroundUrl?: string | null;
}

export function createDefaultLocationIconConfig(): LocationIconPlacementConfig {
	const iconSize = 80;
	const defaultRowBackground: LocationRowBackgroundConfig = { path: null, x: 0, y: 0, scale: 1 };

	// Default template (single row): gain=4, trade cost=2, trade gain=3
	const y = 24;
	const gain_slots = Array.from({ length: 4 }, (_, i) => ({ x: 24 + i * 92, y, w: iconSize, h: iconSize }));
	const trade_cost_slots = Array.from({ length: 2 }, (_, i) => ({ x: 24 + i * 92, y, w: iconSize, h: iconSize }));
	const trade_gain_slots = Array.from({ length: 3 }, (_, i) => ({ x: 280 + i * 92, y, w: iconSize, h: iconSize }));
	const rows: LocationRowPlacement[] = [{ gain_slots, trade_cost_slots, trade_gain_slots }];

	return {
		_icon_size: iconSize,
		rows,
		gain_row_background: { ...defaultRowBackground },
		trade_row_background: { ...defaultRowBackground },
		text_row_background: { ...defaultRowBackground }
	};
}

export function normalizeLocationIconPlacementConfig(input: unknown): LocationIconPlacementConfig {
	const defaults = createDefaultLocationIconConfig();
	if (input === null || input === undefined) return defaults;

	let raw: unknown = input;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw) as unknown;
		} catch {
			return defaults;
		}
	}

	if (!raw || typeof raw !== 'object') return defaults;
	const parsed = raw as Partial<LocationIconPlacementConfig>;
	if (typeof parsed._icon_size !== 'number' || !Array.isArray(parsed.rows)) return defaults;

	function sanitizeSlots(
		input: unknown,
		fallback: IconSlot[],
		desiredLength: number,
		defaultSize: number
	): IconSlot[] {
		if (!Array.isArray(input)) return fallback.slice(0, desiredLength);
		const sanitized = input
			.map((slot) => {
				if (!slot || typeof slot !== 'object') return null;
				const obj = slot as Record<string, unknown>;
				const x = typeof obj.x === 'number' && Number.isFinite(obj.x) ? obj.x : null;
				const y = typeof obj.y === 'number' && Number.isFinite(obj.y) ? obj.y : null;
				if (x === null || y === null) return null;
				const wRaw = typeof obj.w === 'number' && Number.isFinite(obj.w) ? obj.w : defaultSize;
				const hRaw = typeof obj.h === 'number' && Number.isFinite(obj.h) ? obj.h : defaultSize;
				const w = Math.max(0, wRaw);
				const h = Math.max(0, hRaw);
				const normalized: IconSlot = { x, y, w, h };
				return normalized;
			})
			.filter((v): v is IconSlot => v !== null);

		// Ensure fixed length by filling from fallback
		const base = [...sanitized];
		for (let i = base.length; i < desiredLength; i++) {
			const src = fallback[i] ?? fallback[fallback.length - 1] ?? { x: 0, y: 0, w: defaultSize, h: defaultSize };
			base.push({ x: src.x, y: src.y, w: src.w ?? defaultSize, h: src.h ?? defaultSize });
		}
		return base.slice(0, desiredLength);
	}

	function sanitizeRowBackground(input: unknown, fallback: LocationRowBackgroundConfig): LocationRowBackgroundConfig {
		if (!input || typeof input !== 'object') return { ...fallback };
		const obj = input as Record<string, unknown>;

		const path = typeof obj.path === 'string' ? obj.path : null;
		const x = typeof obj.x === 'number' && Number.isFinite(obj.x) ? obj.x : fallback.x;
		const y = typeof obj.y === 'number' && Number.isFinite(obj.y) ? obj.y : fallback.y;
		const scaleRaw = typeof obj.scale === 'number' && Number.isFinite(obj.scale) ? obj.scale : fallback.scale;
		const scale = Math.max(0, scaleRaw);

		return { path, x, y, scale };
	}

	// Only the first row is used as the global template.
	const firstRow = (parsed.rows?.[0] as LocationRowPlacement | undefined) ?? defaults.rows[0];
	const defaultSize = typeof parsed._icon_size === 'number' && Number.isFinite(parsed._icon_size)
		? parsed._icon_size
		: defaults._icon_size;
	const rows: LocationRowPlacement[] = [
		{
			gain_slots: sanitizeSlots(firstRow?.gain_slots, defaults.rows[0].gain_slots, 4, defaultSize),
			trade_cost_slots: sanitizeSlots(firstRow?.trade_cost_slots, defaults.rows[0].trade_cost_slots, 2, defaultSize),
			trade_gain_slots: sanitizeSlots(firstRow?.trade_gain_slots, defaults.rows[0].trade_gain_slots, 3, defaultSize)
		}
	];

	return {
		_icon_size: parsed._icon_size,
		rows,
		gain_row_background: sanitizeRowBackground(parsed.gain_row_background, defaults.gain_row_background),
		trade_row_background: sanitizeRowBackground(parsed.trade_row_background, defaults.trade_row_background),
		text_row_background: sanitizeRowBackground((parsed as any).text_row_background, defaults.text_row_background)
	};
}

export function loadLocationIconPlacementConfig(): LocationIconPlacementConfig {
	if (typeof window === 'undefined') return createDefaultLocationIconConfig();
	const stored = localStorage.getItem('location_icon_placement_config');
	if (!stored) return createDefaultLocationIconConfig();
	try {
		return normalizeLocationIconPlacementConfig(stored);
	} catch {
		return createDefaultLocationIconConfig();
	}
}

export function saveLocationIconPlacementConfig(config: LocationIconPlacementConfig): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('location_icon_placement_config', JSON.stringify(config));
}

export async function generateLocationWithIcons(
	options: GenerateLocationWithIconsOptions
): Promise<Blob> {
	const { backgroundUrl, rewardRows, config, gainRowBackgroundUrl, tradeRowBackgroundUrl } = options;

	const background = await loadImage(backgroundUrl);
	const canvas = createCanvas(background.width, background.height);
	const ctx = getContext(canvas);

	ctx.drawImage(background, 0, 0);

	const iconSize = config._icon_size || 80;

	function createDefaultRowPlacement(rowIndex: number): LocationRowPlacement {
		const y = 40 + rowIndex * 140;
		const gain_slots = Array.from({ length: 5 }, (_, i) => ({ x: 40 + i * 90, y }));
		const trade_cost_slots = Array.from({ length: 5 }, (_, i) => ({ x: 40 + i * 90, y }));
		const trade_gain_slots = Array.from({ length: 5 }, (_, i) => ({ x: 520 + i * 90, y }));
		return { gain_slots, trade_cost_slots, trade_gain_slots };
	}

	function ensureRowPlacement(rowIndex: number): LocationRowPlacement {
		return config.rows?.[rowIndex] ?? createDefaultRowPlacement(rowIndex);
	}

	function anchorFor(kind: 'gain' | 'trade', rowIndex: number, placement: LocationRowPlacement): IconSlot {
		const slots = kind === 'gain' ? placement.gain_slots : placement.trade_cost_slots;
		const first = slots?.[0];
		if (first) return first;
		return (kind === 'gain' ? createDefaultRowPlacement(rowIndex).gain_slots[0] : createDefaultRowPlacement(rowIndex).trade_cost_slots[0]) ?? {
			x: 0,
			y: 0
		};
	}

	function rowHasIcons(row: LocationRewardRowIcons): boolean {
		if (row.type === 'gain') return (row.gainIconUrls?.length ?? 0) > 0;
		return (row.costIconUrls?.length ?? 0) > 0 || (row.gainIconUrls?.length ?? 0) > 0;
	}

	let gainBgImage: HTMLImageElement | null = null;
	let tradeBgImage: HTMLImageElement | null = null;

	if (gainRowBackgroundUrl) {
		try {
			gainBgImage = await loadImage(gainRowBackgroundUrl);
		} catch (err) {
			console.warn('Failed to load gain row background', err);
			gainBgImage = null;
		}
	}

	if (tradeRowBackgroundUrl) {
		try {
			tradeBgImage = await loadImage(tradeRowBackgroundUrl);
		} catch (err) {
			console.warn('Failed to load trade row background', err);
			tradeBgImage = null;
		}
	}

	const gainBgCfg = config.gain_row_background ?? { path: null, x: 0, y: 0, scale: 1 };
	const tradeBgCfg = config.trade_row_background ?? { path: null, x: 0, y: 0, scale: 1 };

	const gainRefAnchor = anchorFor('gain', 0, ensureRowPlacement(0));
	const tradeRefAnchor = anchorFor('trade', 0, ensureRowPlacement(0));

	for (let rowIndex = 0; rowIndex < rewardRows.length; rowIndex++) {
		const row = rewardRows[rowIndex];
		if (!rowHasIcons(row)) continue;

		const placement = ensureRowPlacement(rowIndex);

		if (row.type === 'gain' && gainBgImage) {
			const anchor = anchorFor('gain', rowIndex, placement);
			const scale = gainBgCfg.scale ?? 1;
			const x = (gainBgCfg.x ?? 0) + (anchor.x - gainRefAnchor.x);
			const y = (gainBgCfg.y ?? 0) + (anchor.y - gainRefAnchor.y);
			ctx.drawImage(gainBgImage, x, y, gainBgImage.width * scale, gainBgImage.height * scale);
		}

		if (row.type === 'trade' && tradeBgImage) {
			const anchor = anchorFor('trade', rowIndex, placement);
			const scale = tradeBgCfg.scale ?? 1;
			const x = (tradeBgCfg.x ?? 0) + (anchor.x - tradeRefAnchor.x);
			const y = (tradeBgCfg.y ?? 0) + (anchor.y - tradeRefAnchor.y);
			ctx.drawImage(tradeBgImage, x, y, tradeBgImage.width * scale, tradeBgImage.height * scale);
		}
	}

	for (let rowIndex = 0; rowIndex < rewardRows.length; rowIndex++) {
		const row = rewardRows[rowIndex];
		const placement = ensureRowPlacement(rowIndex);
		if (!placement) continue;

		if (row.type === 'gain') {
			for (let i = 0; i < Math.min(row.gainIconUrls.length, placement.gain_slots.length); i++) {
				const url = row.gainIconUrls[i];
				const slot = placement.gain_slots[i];
				try {
					const img = await loadImage(url);
					drawIconWithOutline(ctx, img, slot.x, slot.y, iconSize, iconSize);
				} catch (err) {
					console.warn(`Failed to load gain icon (row ${rowIndex}, i ${i})`, err);
				}
			}
		} else {
			const costCount = Math.min(row.costIconUrls.length, placement.trade_cost_slots.length);
			const gainCount = Math.min(row.gainIconUrls.length, placement.trade_gain_slots.length);
			const sortedCostSlots = [...placement.trade_cost_slots].sort((a, b) => a.x - b.x);
			const sortedGainSlots = [...placement.trade_gain_slots].sort((a, b) => a.x - b.x);
			const costSlots = costCount > 0
				? sortedCostSlots.slice(Math.max(0, sortedCostSlots.length - costCount))
				: [];
			const gainSlots = gainCount > 0 ? sortedGainSlots.slice(0, gainCount) : [];

			for (let i = 0; i < costCount; i++) {
				const url = row.costIconUrls[i];
				const slot = costSlots[i];
				if (!slot) continue;
				try {
					const img = await loadImage(url);
					drawIconWithOutline(ctx, img, slot.x, slot.y, iconSize, iconSize);
				} catch (err) {
					console.warn(`Failed to load cost icon (row ${rowIndex}, i ${i})`, err);
				}
			}

			for (let i = 0; i < gainCount; i++) {
				const url = row.gainIconUrls[i];
				const slot = gainSlots[i];
				if (!slot) continue;
				try {
					const img = await loadImage(url);
					drawIconWithOutline(ctx, img, slot.x, slot.y, iconSize, iconSize);
				} catch (err) {
					console.warn(`Failed to load trade gain icon (row ${rowIndex}, i ${i})`, err);
				}
			}
		}
	}

	return canvasToBlob(canvas);
}
