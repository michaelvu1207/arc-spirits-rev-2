/**
 * Spirit Front Icon Placer Generator
 * Composites origin/class icons onto hex spirit game print images
 */

import { createCanvas, getContext, loadImage, canvasToBlob, solidifyNonTransparentPixels } from '../shared/canvas';
import {
	loadHexSpiritIconPlacementConfig,
	saveHexSpiritIconPlacementConfig
} from './iconPlacementConfigPersistence';

/**
 * Draw an icon tinted to a specific color.
 * Draws onto a temp canvas, recolors non-transparent pixels, then composites onto the target ctx.
 */
function drawTintedIcon(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number,
	color: string
): void {
	const tmp = createCanvas(w, h);
	const tmpCtx = getContext(tmp);
	drawImageContain(tmpCtx, img, 0, 0, w, h);
	solidifyNonTransparentPixels(tmp, 0);
	tmpCtx.globalCompositeOperation = 'source-in';
	tmpCtx.fillStyle = color;
	tmpCtx.fillRect(0, 0, w, h);
	tmpCtx.globalCompositeOperation = 'source-over';
	ctx.drawImage(tmp, x, y);
}

function drawImageContain(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number
) {
	const naturalW = img.naturalWidth || img.width || w;
	const naturalH = img.naturalHeight || img.height || h;
	const safeW = naturalW > 0 ? naturalW : w;
	const safeH = naturalH > 0 ? naturalH : h;
	const scale = Math.min(w / safeW, h / safeH);
	const drawW = safeW * scale;
	const drawH = safeH * scale;
	const drawX = x + (w - drawW) / 2;
	const drawY = y + (h - drawH) / 2;
	ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

export const FRAME_TIERS = ['spirit_world', 'abyss', 'abyss_void_astral', 'arcane', 'fairy', 'human_enclave', 'royal_family'] as const;
export type FrameTier = (typeof FRAME_TIERS)[number];

export interface IconSlot {
	x: number;
	y: number;
}

export interface FrontIconTierConfig {
	origin_slots: IconSlot[];
	class_slots: IconSlot[];
	class_icon_color?: IconColor;
}

export interface FrontIconPlacementConfig {
	_icon_size: number;
	[tier: string]: number | FrontIconTierConfig;
}

export type IconColor = 'dark' | 'white';

export interface SpiritIconData {
	type: 'origin' | 'class';
	iconUrl: string;
}

export interface GenerateSpiritWithIconsOptions {
	gamePrintUrl: string;
	iconSlots: SpiritIconData[];
	config: FrontIconPlacementConfig;
	tier: FrameTier;
}

/**
 * Creates a default front icon placement configuration
 * 2 origin slots + 3 class slots per tier
 */
export function createDefaultConfig(): FrontIconPlacementConfig {
	const config: FrontIconPlacementConfig = {
		_icon_size: 80
	};

	const defaults: Record<FrameTier, { origin_slots: IconSlot[]; class_slots: IconSlot[] }> = {
		spirit_world: {
			origin_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			],
			class_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			]
		},
		abyss: {
			origin_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			],
			class_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			]
		},
		abyss_void_astral: {
			origin_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			],
			class_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			]
		},
		arcane: {
			origin_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			],
			class_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			]
		},
		fairy: {
			origin_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			],
			class_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			]
		},
		human_enclave: {
			origin_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			],
			class_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			]
		},
		royal_family: {
			origin_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			],
			class_slots: [
				{ x: 0, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: 0 }
			]
		}
	};

	for (const tier of FRAME_TIERS) {
		config[tier] = defaults[tier];
	}

	return config;
}

/**
 * Migrate old tier config format (icon_slots) to new format (origin_slots + class_slots)
 */
function migrateTierConfig(tierConfig: Record<string, unknown>): FrontIconTierConfig {
	if (tierConfig.origin_slots || tierConfig.class_slots) {
		return tierConfig as unknown as FrontIconTierConfig;
	}
	if (Array.isArray(tierConfig.icon_slots)) {
		const oldSlots = tierConfig.icon_slots as IconSlot[];
		return {
			origin_slots: oldSlots.slice(0, 2),
			class_slots: oldSlots.slice(2)
		};
	}
	return { origin_slots: [], class_slots: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasSavedConfigPayload(value: unknown): boolean {
	return isRecord(value) && Object.keys(value).length > 0;
}

function normalizeFrontIconPlacementConfig(raw: unknown): FrontIconPlacementConfig {
	const defaults = createDefaultConfig();
	if (!isRecord(raw)) return defaults;

	const next: Record<string, unknown> = {
		...raw,
		_icon_size: typeof raw._icon_size === 'number' ? raw._icon_size : defaults._icon_size
	};

	for (const tier of FRAME_TIERS) {
		const tierConfig = next[tier];
		if (!tierConfig) {
			next[tier] = defaults[tier];
			continue;
		}

		if (isRecord(tierConfig)) {
			next[tier] = migrateTierConfig(tierConfig);
		} else {
			next[tier] = defaults[tier];
		}
	}

	return next as unknown as FrontIconPlacementConfig;
}

/**
 * Load front icon placement configuration from localStorage
 */
export function loadFrontIconPlacementConfig(): FrontIconPlacementConfig {
	if (typeof window === 'undefined') return createDefaultConfig();

	const stored = localStorage.getItem('front_icon_placement_config');
	if (stored) {
		try {
			const parsed = normalizeFrontIconPlacementConfig(JSON.parse(stored));
			saveFrontIconPlacementConfig(parsed);
			return parsed;
		} catch {
			return createDefaultConfig();
		}
	}

	// Migrate from old key if present
	const oldStored = localStorage.getItem('spirit_icon_placement_config');
	if (oldStored) {
		try {
			const oldConfig = JSON.parse(oldStored);
			const newConfig = createDefaultConfig();
			if (typeof oldConfig._icon_size === 'number') {
				newConfig._icon_size = oldConfig._icon_size;
			}
			saveFrontIconPlacementConfig(newConfig);
			localStorage.removeItem('spirit_icon_placement_config');
			return newConfig;
		} catch {
			return createDefaultConfig();
		}
	}

	return createDefaultConfig();
}

/**
 * Save front icon placement configuration to localStorage
 */
export function saveFrontIconPlacementConfig(config: FrontIconPlacementConfig): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('front_icon_placement_config', JSON.stringify(config));
}

export async function loadFrontIconPlacementConfigFromDatabase(): Promise<FrontIconPlacementConfig> {
	try {
		const stored = await loadHexSpiritIconPlacementConfig('front');
		const config = hasSavedConfigPayload(stored)
			? normalizeFrontIconPlacementConfig(stored)
			: loadFrontIconPlacementConfig();
		saveFrontIconPlacementConfig(config);
		return config;
	} catch (err) {
		console.warn('Failed to load front icon placement config from database:', err);
		return loadFrontIconPlacementConfig();
	}
}

export async function saveFrontIconPlacementConfigToDatabase(
	config: FrontIconPlacementConfig
): Promise<void> {
	saveFrontIconPlacementConfig(config);
	try {
		await saveHexSpiritIconPlacementConfig('front', config);
	} catch (err) {
		console.warn('Failed to save front icon placement config to database:', err);
	}
}

/**
 * Generate a spirit game print with icons composited onto it.
 * Origin icons are placed into origin_slots, class icons into class_slots.
 */
export async function generateSpiritWithIcons(
	options: GenerateSpiritWithIconsOptions
): Promise<Blob> {
	const { gamePrintUrl, iconSlots, config, tier } = options;

	const gamePrintImage = await loadImage(gamePrintUrl);

	const canvas = createCanvas(gamePrintImage.width, gamePrintImage.height);
	const ctx = getContext(canvas);

	ctx.drawImage(gamePrintImage, 0, 0);

	const iconLayer = createCanvas(gamePrintImage.width, gamePrintImage.height);
	const iconCtx = getContext(iconLayer);

	const tierConfig = config[tier];
	if (typeof tierConfig === 'number' || !tierConfig) {
		return canvasToBlob(canvas);
	}

	const originPlacements = tierConfig.origin_slots ?? [];
	const classPlacements = tierConfig.class_slots ?? [];
	const iconSize = config._icon_size || 80;

	const originIcons = iconSlots.filter((s) => s.type === 'origin');
	const classIcons = iconSlots.filter((s) => s.type === 'class');

	for (let i = 0; i < Math.min(originIcons.length, originPlacements.length); i++) {
		const slot = originIcons[i];
		const placement = originPlacements[i];
		try {
			const iconImage = await loadImage(slot.iconUrl);
			drawImageContain(iconCtx, iconImage, placement.x, placement.y, iconSize, iconSize);
		} catch (err) {
			console.warn(`Failed to load origin icon at index ${i}:`, err);
		}
	}

	const classColor = tierConfig.class_icon_color === 'white' ? '#FFFFFF' : null;

	for (let i = 0; i < Math.min(classIcons.length, classPlacements.length); i++) {
		const slot = classIcons[i];
		const placement = classPlacements[i];
		try {
			const iconImage = await loadImage(slot.iconUrl);
			if (classColor) {
				drawTintedIcon(iconCtx, iconImage, placement.x, placement.y, iconSize, iconSize, classColor);
			} else {
				drawImageContain(iconCtx, iconImage, placement.x, placement.y, iconSize, iconSize);
			}
		} catch (err) {
			console.warn(`Failed to load class icon at index ${i}:`, err);
		}
	}

	solidifyNonTransparentPixels(iconLayer, 0);
	ctx.drawImage(iconLayer, 0, 0);
	solidifyNonTransparentPixels(canvas, 0);

	return canvasToBlob(canvas);
}

/**
 * Generate a preview canvas for front icon placement configuration
 */
export async function generatePlacementPreview(
	gamePrintUrl: string,
	config: FrontIconPlacementConfig,
	tier: FrameTier,
	displayScale: number = 1
): Promise<{
	canvas: HTMLCanvasElement;
	imageWidth: number;
	imageHeight: number;
}> {
	const gamePrintImage = await loadImage(gamePrintUrl);

	const scaledWidth = Math.floor(gamePrintImage.width * displayScale);
	const scaledHeight = Math.floor(gamePrintImage.height * displayScale);

	const canvas = createCanvas(scaledWidth, scaledHeight);
	const ctx = getContext(canvas);

	ctx.drawImage(gamePrintImage, 0, 0, scaledWidth, scaledHeight);

	const tierConfig = config[tier];
	if (typeof tierConfig === 'number' || !tierConfig) {
		return { canvas, imageWidth: gamePrintImage.width, imageHeight: gamePrintImage.height };
	}

	const originSlots = tierConfig.origin_slots ?? [];
	const classSlots = tierConfig.class_slots ?? [];
	const scaledSize = (config._icon_size || 80) * displayScale;

	const originColors = ['#FF6B6B', '#FF9F43'];
	const classColors = ['#4ECDC4', '#45B7D1', '#96CEB4'];

	for (let i = 0; i < originSlots.length; i++) {
		const slot = originSlots[i];
		const color = originColors[i % originColors.length];
		const x = slot.x * displayScale;
		const y = slot.y * displayScale;

		ctx.strokeStyle = color;
		ctx.lineWidth = 3;
		ctx.strokeRect(x, y, scaledSize, scaledSize);

		ctx.fillStyle = color;
		ctx.font = `bold ${14 * displayScale}px Arial`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(`O${i + 1}`, x + scaledSize / 2, y + scaledSize / 2);
	}

	for (let i = 0; i < classSlots.length; i++) {
		const slot = classSlots[i];
		const color = classColors[i % classColors.length];
		const x = slot.x * displayScale;
		const y = slot.y * displayScale;

		ctx.strokeStyle = color;
		ctx.lineWidth = 3;
		ctx.strokeRect(x, y, scaledSize, scaledSize);

		ctx.fillStyle = color;
		ctx.font = `bold ${14 * displayScale}px Arial`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(`C${i + 1}`, x + scaledSize / 2, y + scaledSize / 2);
	}

	return { canvas, imageWidth: gamePrintImage.width, imageHeight: gamePrintImage.height };
}
