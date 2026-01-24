/**
 * Spirit Icon Placer Generator
 * Composites origin/class icons and rune icons onto hex spirit game print images
 */

import { createCanvas, getContext, loadImage, canvasToBlob, solidifyNonTransparentPixels } from '../shared/canvas';

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

// Cost to folder mapping (matches Python script)
export const COST_TO_FOLDER: Record<number, string> = {
	1: 'Human',
	3: 'Minor',
	5: 'Minor2',
	7: 'Greater',
	9: 'Exalted',
	11: 'Ancient'
};

export const FOLDER_TYPES = ['Human', 'Minor', 'Minor2', 'Greater', 'Exalted', 'Ancient'] as const;
export type FolderType = (typeof FOLDER_TYPES)[number];

export interface IconSlot {
	x: number;
	y: number;
}

export interface IconPlacementConfig {
	_icon_size: number;
	_rune_size: number;
	[folder: string]: number | { icon_slots: IconSlot[]; rune_slots: IconSlot[] };
}

export interface SpiritIconData {
	type: 'origin' | 'class';
	iconUrl: string;
}

export interface RuneIconData {
	iconUrl: string;
}

export interface GenerateSpiritWithIconsOptions {
	gamePrintUrl: string;
	iconSlots: SpiritIconData[];
	runeSlots: RuneIconData[];
	config: IconPlacementConfig;
	folderType: FolderType;
}

/**
 * Get folder type from spirit cost
 * Returns null for unmatched costs (those spirits should be skipped)
 */
export function getFolderFromCost(cost: number): FolderType | null {
	if (cost === 1) return 'Human';
	if (cost >= 2 && cost <= 3) return 'Minor';
	if (cost >= 4 && cost <= 5) return 'Minor2';
	if (cost === 7) return 'Greater';
	if (cost === 9) return 'Exalted';
	if (cost === 11) return 'Ancient';
	return null;
}

/**
 * Creates a default icon placement configuration
 */
export function createDefaultConfig(): IconPlacementConfig {
	const config: IconPlacementConfig = {
		_icon_size: 80,
		_rune_size: 60
	};

	// Default positions for each folder type
	// These are starting positions - user will configure via UI
	for (const folder of FOLDER_TYPES) {
		config[folder] = {
			icon_slots: [
				{ x: 20, y: 20 },
				{ x: 110, y: 20 },
				{ x: 20, y: 110 },
				{ x: 110, y: 110 }
			],
			rune_slots: [
				{ x: 200, y: 20 },
				{ x: 270, y: 20 }
			]
		};
	}

	return config;
}

/**
 * Load icon placement configuration from localStorage
 */
export function loadIconPlacementConfig(): IconPlacementConfig {
	if (typeof window === 'undefined') return createDefaultConfig();

	const stored = localStorage.getItem('spirit_icon_placement_config');
	if (stored) {
		try {
			return JSON.parse(stored) as IconPlacementConfig;
		} catch {
			return createDefaultConfig();
		}
	}
	return createDefaultConfig();
}

/**
 * Save icon placement configuration to localStorage
 */
export function saveIconPlacementConfig(config: IconPlacementConfig): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('spirit_icon_placement_config', JSON.stringify(config));
}

/**
 * Generate a spirit game print with icons composited onto it
 */
export async function generateSpiritWithIcons(
	options: GenerateSpiritWithIconsOptions
): Promise<Blob> {
	const { gamePrintUrl, iconSlots, runeSlots, config, folderType } = options;

	// Load the base game print image
	const gamePrintImage = await loadImage(gamePrintUrl);

	// Create canvas with same dimensions as game print
	const canvas = createCanvas(gamePrintImage.width, gamePrintImage.height);
	const ctx = getContext(canvas);

	// Draw base game print
	ctx.drawImage(gamePrintImage, 0, 0);

	// Draw icons onto a separate layer so we can force any non-empty icon pixels to be fully opaque
	// without changing transparency in the base image.
	const iconLayer = createCanvas(gamePrintImage.width, gamePrintImage.height);
	const iconCtx = getContext(iconLayer);

	// Get placement config for this folder
	const folderConfig = config[folderType];
	if (typeof folderConfig === 'number') {
		// This is _icon_size or _rune_size, skip
		return canvasToBlob(canvas);
	}

	const iconPlacements = folderConfig?.icon_slots ?? [];
	const runePlacements = folderConfig?.rune_slots ?? [];
	const iconSize = config._icon_size || 80;
	const runeSize = config._rune_size || 60;

	// Place icons (origin/class)
	for (let i = 0; i < Math.min(iconSlots.length, iconPlacements.length); i++) {
		const slot = iconSlots[i];
		const placement = iconPlacements[i];

		try {
			const iconImage = await loadImage(slot.iconUrl);
			drawImageContain(iconCtx, iconImage, placement.x, placement.y, iconSize, iconSize);
		} catch (err) {
			console.warn(`Failed to load icon at index ${i}:`, err);
		}
	}

	// Place rune icons
	for (let i = 0; i < Math.min(runeSlots.length, runePlacements.length); i++) {
		const slot = runeSlots[i];
		const placement = runePlacements[i];

		try {
			const runeImage = await loadImage(slot.iconUrl);
			drawImageContain(iconCtx, runeImage, placement.x, placement.y, runeSize, runeSize);
		} catch (err) {
			console.warn(`Failed to load rune at index ${i}:`, err);
		}
	}

	// Force any icon layer pixel with alpha > 0 to full opacity; keeps fully-transparent pixels transparent.
	solidifyNonTransparentPixels(iconLayer, 0);
	ctx.drawImage(iconLayer, 0, 0);

	// If the base game print has any semi-transparent pixels inside the artwork,
	// force all non-empty pixels in the final composite to be fully opaque.
	// Fully-transparent pixels remain transparent.
	solidifyNonTransparentPixels(canvas, 0);

	return canvasToBlob(canvas);
}

/**
 * Generate a preview canvas for icon placement configuration
 */
export async function generatePlacementPreview(
	gamePrintUrl: string,
	config: IconPlacementConfig,
	folderType: FolderType,
	slotType: 'icon_slots' | 'rune_slots',
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

	// Draw scaled game print
	ctx.drawImage(gamePrintImage, 0, 0, scaledWidth, scaledHeight);

	// Get folder config
	const folderConfig = config[folderType];
	if (typeof folderConfig === 'number') {
		return { canvas, imageWidth: gamePrintImage.width, imageHeight: gamePrintImage.height };
	}

	const slots = folderConfig?.[slotType] ?? [];
	const size = slotType === 'icon_slots' ? config._icon_size : config._rune_size;
	const scaledSize = size * displayScale;

	// Colors for different slot types
	const colors =
		slotType === 'icon_slots'
			? ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
			: ['#FFD93D', '#FF8C42'];

	// Draw slot rectangles
	for (let i = 0; i < slots.length; i++) {
		const slot = slots[i];
		const color = colors[i % colors.length];
		const x = slot.x * displayScale;
		const y = slot.y * displayScale;

		// Draw rectangle outline
		ctx.strokeStyle = color;
		ctx.lineWidth = 3;
		ctx.strokeRect(x, y, scaledSize, scaledSize);

		// Draw slot number
		ctx.fillStyle = color;
		ctx.font = `bold ${14 * displayScale}px Arial`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(String(i + 1), x + scaledSize / 2, y + scaledSize / 2);
	}

	return { canvas, imageWidth: gamePrintImage.width, imageHeight: gamePrintImage.height };
}
