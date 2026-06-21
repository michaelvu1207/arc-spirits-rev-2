/**
 * Spirit Back Icon Placer Generator
 * Composites origin/class icons (from front config) + rune icons onto back side game prints
 */

import { createCanvas, getContext, loadImage, canvasToBlob, solidifyNonTransparentPixels, loadOpsilonFont, loadVincendoFont } from '../shared/canvas';
import type { SpiritIconData, FrontIconPlacementConfig, FrameTier } from './spiritIconPlacer';
import {
	loadHexSpiritIconPlacementConfig,
	saveHexSpiritIconPlacementConfig
} from './iconPlacementConfigPersistence';

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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let currentLine = '';
	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		if (ctx.measureText(testLine).width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}
	if (currentLine) lines.push(currentLine);
	return lines;
}

export interface IconSlot {
	x: number;
	y: number;
}

export type RuneIconData =
	| { type: 'single'; iconUrl: string }
	| { type: 'or'; iconUrls: string[] };

export type TextBoxFont = 'Opsilon' | 'Vincendo';

export interface TextBoxConfig {
	x: number;
	y: number;
	width: number;
	height: number;
	font_size: number;
	color: string;
	font_family: TextBoxFont;
}

export interface BackIconPlacementConfig {
	_rune_size: number;
	rune_slots: IconSlot[];
	text_box?: TextBoxConfig;
	special_class_icon_slot?: IconSlot | null;
	_special_class_icon_size?: number;
}

export interface GenerateBackWithIconsOptions {
	backSideUrl: string;
	iconSlots: SpiritIconData[];
	runeSlots: RuneIconData[];
	backConfig: BackIconPlacementConfig;
	frontConfig: FrontIconPlacementConfig;
	tier: FrameTier;
	awakenText?: string | null;
	specialClassIconUrl?: string | null;
}

/**
 * Creates a default back icon placement configuration (rune slots only)
 */
export function createDefaultBackConfig(): BackIconPlacementConfig {
	return {
		_rune_size: 120,
		rune_slots: [
			{ x: 0, y: 0 },
			{ x: 0, y: 0 },
			{ x: 0, y: 0 },
			{ x: 0, y: 0 },
			{ x: 0, y: 0 }
		]
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasSavedConfigPayload(value: unknown): boolean {
	return isRecord(value) && Object.keys(value).length > 0;
}

function normalizeBackIconPlacementConfig(raw: unknown): BackIconPlacementConfig {
	const defaults = createDefaultBackConfig();
	if (!isRecord(raw)) return defaults;

	const result: BackIconPlacementConfig = {
		_rune_size: typeof raw._rune_size === 'number' ? raw._rune_size : defaults._rune_size,
		rune_slots: Array.isArray(raw.rune_slots) ? (raw.rune_slots as IconSlot[]) : defaults.rune_slots
	};

	if (isRecord(raw.text_box)) {
		result.text_box = raw.text_box as unknown as TextBoxConfig;
	}
	if (isRecord(raw.special_class_icon_slot)) {
		result.special_class_icon_slot = raw.special_class_icon_slot as unknown as IconSlot;
	}
	if (typeof raw._special_class_icon_size === 'number') {
		result._special_class_icon_size = raw._special_class_icon_size;
	}

	return result;
}

/**
 * Load back icon placement configuration from localStorage
 */
export function loadBackIconPlacementConfig(): BackIconPlacementConfig {
	if (typeof window === 'undefined') return createDefaultBackConfig();

	const stored = localStorage.getItem('back_icon_placement_config');
	if (stored) {
		try {
			const result = normalizeBackIconPlacementConfig(JSON.parse(stored));
			saveBackIconPlacementConfig(result);
			return result;
		} catch {
			return createDefaultBackConfig();
		}
	}

	return createDefaultBackConfig();
}

/**
 * Save back icon placement configuration to localStorage
 */
export function saveBackIconPlacementConfig(config: BackIconPlacementConfig): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('back_icon_placement_config', JSON.stringify(config));
}

export async function loadBackIconPlacementConfigFromDatabase(): Promise<BackIconPlacementConfig> {
	try {
		const stored = await loadHexSpiritIconPlacementConfig('back');
		const config = hasSavedConfigPayload(stored)
			? normalizeBackIconPlacementConfig(stored)
			: loadBackIconPlacementConfig();
		saveBackIconPlacementConfig(config);
		return config;
	} catch (err) {
		console.warn('Failed to load back icon placement config from database:', err);
		return loadBackIconPlacementConfig();
	}
}

export async function saveBackIconPlacementConfigToDatabase(
	config: BackIconPlacementConfig
): Promise<void> {
	saveBackIconPlacementConfig(config);
	try {
		await saveHexSpiritIconPlacementConfig('back', config);
	} catch (err) {
		console.warn('Failed to save back icon placement config to database:', err);
	}
}

/**
 * Draws multiple full-size rune icons laid out horizontally with a bold "/" slash between them.
 * Each icon renders at 100% runeSize; the total width extends beyond the single slot.
 */
async function drawOrRuneSlot(
	ctx: CanvasRenderingContext2D,
	iconUrls: string[],
	x: number,
	y: number,
	runeSize: number
): Promise<void> {
	const count = iconUrls.length;
	if (count === 0) return;

	if (count === 1) {
		const img = await loadImage(iconUrls[0]);
		drawImageContain(ctx, img, x, y, runeSize, runeSize);
		return;
	}

	const slashGap = Math.round(runeSize * 0.35);
	const slashFontSize = runeSize;

	ctx.save();
	ctx.font = `bold ${slashFontSize}px Arial`;
	ctx.fillStyle = '#FFFFFF';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	// Total width: count icons + (count-1) slash gaps
	const totalWidth = count * runeSize + (count - 1) * slashGap;
	// Center the group around the original slot center
	let curX = x + (runeSize - totalWidth) / 2;

	for (let i = 0; i < count; i++) {
		try {
			const img = await loadImage(iconUrls[i]);
			drawImageContain(ctx, img, curX, y, runeSize, runeSize);
		} catch (err) {
			console.warn(`Failed to load OR rune icon ${i}:`, err);
		}
		curX += runeSize;

		if (i < count - 1) {
			ctx.fillText('/', curX + slashGap / 2, y + runeSize / 2);
			curX += slashGap;
		}
	}

	ctx.restore();
}

/**
 * Generate a back side image with origin/class icons (from front config) + rune icons
 */
export async function generateBackWithIcons(
	options: GenerateBackWithIconsOptions
): Promise<Blob> {
	const { backSideUrl, iconSlots, runeSlots, backConfig, frontConfig, tier, awakenText, specialClassIconUrl } = options;

	const backSideImage = await loadImage(backSideUrl);

	const canvas = createCanvas(backSideImage.width, backSideImage.height);
	const ctx = getContext(canvas);

	ctx.drawImage(backSideImage, 0, 0);

	const iconLayer = createCanvas(backSideImage.width, backSideImage.height);
	const iconCtx = getContext(iconLayer);

	// Origin/class positions come from the front config's tier
	const tierConfig = frontConfig[tier];
	const originPlacements = (typeof tierConfig !== 'number' && tierConfig?.origin_slots) || [];
	const classPlacements = (typeof tierConfig !== 'number' && tierConfig?.class_slots) || [];
	const iconSize = frontConfig._icon_size || 80;
	const classColor = (typeof tierConfig !== 'number' && tierConfig?.class_icon_color === 'white') ? '#FFFFFF' : null;

	// Rune positions come from the back config
	const runePlacements = backConfig.rune_slots ?? [];
	const runeSize = backConfig._rune_size || 120;

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

	for (let i = 0; i < Math.min(runeSlots.length, runePlacements.length); i++) {
		const slot = runeSlots[i];
		const placement = runePlacements[i];
		try {
			if (slot.type === 'single') {
				const iconImage = await loadImage(slot.iconUrl);
				drawImageContain(iconCtx, iconImage, placement.x, placement.y, runeSize, runeSize);
			} else if (slot.type === 'or' && slot.iconUrls.length > 0) {
				await drawOrRuneSlot(iconCtx, slot.iconUrls, placement.x, placement.y, runeSize);
			}
		} catch (err) {
			console.warn(`Failed to load rune icon at index ${i}:`, err);
		}
	}

	// Draw special class icon if provided (tinted white)
	if (specialClassIconUrl && backConfig.special_class_icon_slot) {
		const scSlot = backConfig.special_class_icon_slot;
		const scSize = backConfig._special_class_icon_size || 80;
		try {
			const scImage = await loadImage(specialClassIconUrl);
			drawTintedIcon(iconCtx, scImage, scSlot.x, scSlot.y, scSize, scSize, '#FFFFFF');
		} catch (err) {
			console.warn('Failed to load special class icon:', err);
		}
	}

	solidifyNonTransparentPixels(iconLayer, 0);
	ctx.drawImage(iconLayer, 0, 0);

	// Draw awaken text if provided and text_box is configured
	if (awakenText && backConfig.text_box) {
		const tb = backConfig.text_box;
		const fontFamily = tb.font_family || 'Opsilon';
		if (fontFamily === 'Opsilon') await loadOpsilonFont();
		else await loadVincendoFont();

		ctx.save();
		ctx.fillStyle = tb.color || '#FFFFFF';
		ctx.font = `bold ${tb.font_size}px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';

		const lines = wrapText(ctx, awakenText, tb.width);
		const lineHeight = tb.font_size * 1.2;
		const totalTextHeight = lines.length * lineHeight;
		const startY = tb.y + (tb.height - totalTextHeight) / 2;
		const centerX = tb.x + tb.width / 2;

		for (let i = 0; i < lines.length; i++) {
			ctx.fillText(lines[i], centerX, startY + i * lineHeight);
		}
		ctx.restore();
	}

	solidifyNonTransparentPixels(canvas, 0);

	return canvasToBlob(canvas);
}

/**
 * Generate a preview canvas for back icon placement configuration
 * Shows rune slots only (origin/class come from front config and aren't editable here)
 */
export async function generateBackPlacementPreview(
	backSideUrl: string,
	config: BackIconPlacementConfig,
	displayScale: number = 1
): Promise<{
	canvas: HTMLCanvasElement;
	imageWidth: number;
	imageHeight: number;
}> {
	const backSideImage = await loadImage(backSideUrl);

	const scaledWidth = Math.floor(backSideImage.width * displayScale);
	const scaledHeight = Math.floor(backSideImage.height * displayScale);

	const canvas = createCanvas(scaledWidth, scaledHeight);
	const ctx = getContext(canvas);

	ctx.drawImage(backSideImage, 0, 0, scaledWidth, scaledHeight);

	const runeSlots = config.rune_slots ?? [];
	const scaledRuneSize = (config._rune_size || 120) * displayScale;

	const runeColors = ['#DDA0DD', '#C084FC', '#A78BFA', '#818CF8', '#6366F1'];

	for (let i = 0; i < runeSlots.length; i++) {
		const slot = runeSlots[i];
		const color = runeColors[i % runeColors.length];
		const x = slot.x * displayScale;
		const y = slot.y * displayScale;

		ctx.strokeStyle = color;
		ctx.lineWidth = 3;
		ctx.strokeRect(x, y, scaledRuneSize, scaledRuneSize);

		ctx.fillStyle = color;
		ctx.font = `bold ${14 * displayScale}px Arial`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(`R${i + 1}`, x + scaledRuneSize / 2, y + scaledRuneSize / 2);
	}

	return { canvas, imageWidth: backSideImage.width, imageHeight: backSideImage.height };
}
