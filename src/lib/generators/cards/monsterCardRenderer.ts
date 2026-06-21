/**
 * Monster card renderer for the unified layout system.
 *
 * Custom zones:
 *   - 'rewards': reward track grid with kill-merged cell
 *   - 'effects': two-column special effects grid
 *   - 'dice_pool': dark blue bg icon grid for dice pool
 *
 * Text zones:
 *   - 'name': monster name
 *   - 'damage': damage value
 *   - 'barrier': barrier value
 *   - 'choose_on_kill': static "Choose 1 on kill" label
 */

import type { CardLayoutConfig, CardRenderer, CustomZone } from '$lib/generators/shared/layoutTypes';
import type { ZoneDataMap } from '$lib/generators/shared/layoutRenderer';
import { getIconPoolUrl } from '$lib/utils/iconPool';
import { getMonsterCardUi } from '$lib/i18n/monsterCardUi';
import { computeCenteredGridGeometry } from '$lib/generators/shared/centeredIconGrid';
import type { SpecialEffectType } from '$lib/types/gameData';

// ---------------------------------------------------------------------------
// Monster data type (minimal shape for rendering)
// ---------------------------------------------------------------------------

export type MonsterForLayout = {
	id: string;
	name: string;
	attack_type?: 'damage' | 'dice_pool';
	damage: number | null;
	barrier: number | null;
	/** Flat array of up to 6 icon IDs awarded on kill. */
	reward_track: string[] | null;
	/** Array of icon_pool IDs representing the monster's dice pool. */
	dice_pool: string[] | null;
	/** Number of rewards to choose on kill. 0 = hidden. */
	choose_amount: number;
	card_base_image_path: string | null;
	updated_at?: string | null;
	effects?: { name: string; description: string | null; effect_type?: SpecialEffectType | null }[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REWARD_TRACK_COLS = 6;

const MONSTER_EFFECT_UI = getMonsterCardUi('en');

const EFFECT_TYPE_COLORS: Record<SpecialEffectType, string> = {
	before_combat: '#f59e0b',
	during_combat: '#ef4444',
	after_combat: '#22c55e',
	combat_type: '#8b5cf6'
};

// ---------------------------------------------------------------------------
// Helpers (extracted from monsterCardIconPlacer.ts)
// ---------------------------------------------------------------------------

function toTitleCase(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to']);
	const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);
	return trimmed
		.toLowerCase()
		.split(/\s+/)
		.map((word, wordIndex) => {
			const parts = word.split('-');
			return parts.map((part, partIndex) => {
				const isFirst = wordIndex === 0 && partIndex === 0;
				if (!isFirst && smallWords.has(part)) return part;
				return cap(part);
			}).join('-');
		}).join(' ');
}

function formatEffectTypeTag(effectType: SpecialEffectType | null | undefined): string {
	const key = (effectType ?? 'during_combat') as SpecialEffectType;
	const raw = MONSTER_EFFECT_UI.effectType[key] ?? MONSTER_EFFECT_UI.effectType.during_combat;
	return toTitleCase(raw);
}

function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	let text = html.replace(/<[^>]*>/g, '');
	text = text
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
	return text;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const normalized = (text ?? '').replace(/\r\n/g, '\n');
	const paragraphs = normalized.split('\n');
	const lines: string[] = [];
	for (const p of paragraphs) {
		const words = p.split(/\s+/).filter(Boolean);
		if (words.length === 0) { lines.push(''); continue; }
		let line = words[0];
		for (let i = 1; i < words.length; i++) {
			const test = `${line} ${words[i]}`;
			if (ctx.measureText(test).width <= maxWidth) { line = test; }
			else { lines.push(line); line = words[i]; }
		}
		lines.push(line);
	}
	return lines;
}

function normalizeRewardTrack(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((id): id is string => typeof id === 'string')
		.map((id) => id.trim())
		.filter(Boolean)
		.slice(0, REWARD_TRACK_COLS);
}

// ---------------------------------------------------------------------------
// Draw reward track (single merged row of up to 6 on-kill icons)
// ---------------------------------------------------------------------------

function drawRewardTrackGrid(
	ctx: CanvasRenderingContext2D,
	box: { x: number; y: number; w: number; h: number },
	gap: number,
	maxPerRow: number,
	rewardUrls: (string | null)[],
	imageByUrl: Map<string, HTMLImageElement>
): void {
	const cols = Math.max(1, maxPerRow);
	const urls = rewardUrls.slice(0, cols);
	if (urls.length === 0) return;

	ctx.save();
	ctx.beginPath();
	ctx.rect(box.x, box.y, box.w, box.h);
	ctx.clip();

	// Always compute geometry for maxPerRow columns so cell size stays constant
	const geometry = computeCenteredGridGeometry(
		box,
		{ cols, rows: 1, gap, alignY: 'bottom' }
	);

	const cellSize = geometry.cellSize;
	const gapPx = geometry.gap;
	const startX = geometry.startX;
	const startY = geometry.startY;

	const strokeWidth = Math.max(1, cellSize * 0.0325);
	const pad = Math.max(strokeWidth, Math.round(cellSize * 0.14));
	const maxSide = Math.max(1, cellSize - pad * 2);

	ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
	ctx.lineWidth = strokeWidth;

	// Center the actual icons within the full-width grid
	const actualCols = urls.length;
	const offset = (cols - actualCols) / 2;

	// Single merged cell with dark red background spanning actual icons
	const cellX = startX + offset * (cellSize + gapPx);
	const cellY = startY;
	const cellW = actualCols * cellSize + gapPx * (actualCols - 1);
	const inset = strokeWidth / 2;
	const boxH = Math.max(0, cellSize - strokeWidth);
	const boxW = Math.max(0, cellW - strokeWidth);

	ctx.fillStyle = 'rgba(69, 10, 10, 0.85)';
	ctx.fillRect(cellX + inset, cellY + inset, boxW, boxH);
	ctx.strokeRect(cellX + inset, cellY + inset, boxW, boxH);

	// Draw icons inside the merged cell (no inner borders)
	for (let i = 0; i < actualCols; i++) {
		const url = urls[i];
		if (!url) continue;
		const img = imageByUrl.get(url);
		if (!img) continue;

		const px = cellX + i * (cellSize + gapPx);
		const py = cellY;

		const iw = Math.max(1, img.width);
		const ih = Math.max(1, img.height);
		const scaleFactor = maxSide / Math.max(iw, ih);
		const dw = iw * scaleFactor;
		const dh = ih * scaleFactor;
		const dx = px + (cellSize - dw) / 2;
		const dy = py + (cellSize - dh) / 2;
		ctx.drawImage(img, dx, dy, dw, dh);
	}

	ctx.restore();
}

// ---------------------------------------------------------------------------
// Draw dice pool grid (dark blue bg icon grid)
// ---------------------------------------------------------------------------

function drawDicePoolGrid(
	ctx: CanvasRenderingContext2D,
	box: { x: number; y: number; w: number; h: number },
	gap: number,
	maxPerRow: number,
	iconUrls: (string | null)[],
	imageByUrl: Map<string, HTMLImageElement>
): void {
	const urls = iconUrls.filter((u): u is string => typeof u === 'string');
	if (urls.length === 0) return;

	const cols = Math.min(urls.length, Math.max(1, maxPerRow));

	ctx.save();
	ctx.beginPath();
	ctx.rect(box.x, box.y, box.w, box.h);
	ctx.clip();

	const geometry = computeCenteredGridGeometry(
		box,
		{ cols, rows: 1, gap, alignY: 'bottom' }
	);

	const cellSize = geometry.cellSize;
	const gapPx = geometry.gap;
	const startX = geometry.startX;
	const startY = geometry.startY;

	const strokeWidth = Math.max(1, cellSize * 0.0325);
	const pad = Math.max(strokeWidth, Math.round(cellSize * 0.14));
	const maxSide = Math.max(1, cellSize - pad * 2);

	ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
	ctx.lineWidth = strokeWidth;

	const inset = strokeWidth / 2;
	const cellW = cols * cellSize + gapPx * (cols - 1);
	const boxH = Math.max(0, cellSize - strokeWidth);
	const boxW = Math.max(0, cellW - strokeWidth);

	ctx.fillStyle = 'rgba(10, 30, 69, 0.85)';
	ctx.fillRect(startX + inset, startY + inset, boxW, boxH);
	ctx.strokeRect(startX + inset, startY + inset, boxW, boxH);

	for (let i = 0; i < cols; i++) {
		const url = urls[i];
		if (!url) continue;
		const img = imageByUrl.get(url);
		if (!img) continue;

		const px = startX + i * (cellSize + gapPx);
		const py = startY;

		const iw = Math.max(1, img.width);
		const ih = Math.max(1, img.height);
		const scaleFactor = maxSide / Math.max(iw, ih);
		const dw = iw * scaleFactor;
		const dh = ih * scaleFactor;
		const dx = px + (cellSize - dw) / 2;
		const dy = py + (cellSize - dh) / 2;
		ctx.drawImage(img, dx, dy, dw, dh);
	}

	ctx.restore();
}

// ---------------------------------------------------------------------------
// Draw special effects grid (from monsterCardIconPlacer.ts drawSpecialEffectsGrid)
// ---------------------------------------------------------------------------

type EffectForRender = { name: string; description: string | null; effect_type?: SpecialEffectType | null };

function drawSpecialEffectsGrid(
	ctx: CanvasRenderingContext2D,
	box: { x: number; y: number; w: number; h: number },
	fontSize: number,
	lineHeight: number | undefined,
	color: string,
	effectsRaw: EffectForRender[] | null | undefined
): void {
	const effects = Array.isArray(effectsRaw) ? effectsRaw.filter((e) => e && typeof e.name === 'string' && e.name.trim()) : [];

	if (effects.length === 0) {
		const text = MONSTER_EFFECT_UI.noSpecialEffects || 'No Special Effects';
		ctx.save();
		ctx.beginPath();
		ctx.rect(box.x, box.y, box.w, box.h);
		ctx.clip();
		const pad = 14;
		const innerW = Math.max(1, box.w - pad * 2);
		const innerH = Math.max(1, box.h - pad * 2);
		const fs = Math.max(8, Math.round((Number.isFinite(fontSize) ? fontSize : 24) * 0.82));
		const lh = Math.max(10, Math.round(fs * 1.15));
		ctx.fillStyle = color;
		ctx.font = `400 ${fs}px Vincendo`;
		ctx.textBaseline = 'top';
		ctx.textAlign = 'center';
		const lines = wrapText(ctx, text, innerW);
		const totalH = lines.length * lh;
		let y = box.y + pad + Math.max(0, (innerH - totalH) / 2);
		const x = box.x + box.w / 2;
		for (const line of lines) {
			if (y > box.y + box.h - pad) break;
			ctx.fillText(line, x, y, innerW);
			y += lh;
		}
		ctx.restore();
		return;
	}

	ctx.save();
	ctx.beginPath();
	ctx.rect(box.x, box.y, box.w, box.h);
	ctx.clip();

	const padX = 14;
	const padY = 14;
	const colGap = 18;
	const innerX = box.x + padX;
	const innerY = box.y + padY;
	const innerW = Math.max(0, box.w - padX * 2);
	const innerH = Math.max(0, box.h - padY * 2);
	const typeColW = Math.max(90, Math.floor(innerW * 0.3));
	const effectColW = Math.max(1, innerW - typeColW - colGap);
	const typeX = innerX;
	const effectX = innerX + typeColW + colGap;
	const maxY = innerY + innerH;

	const baseFontSize = Number.isFinite(fontSize) ? fontSize : 12;
	const baseLineHeight = typeof lineHeight === 'number' && Number.isFinite(lineHeight) ? lineHeight : baseFontSize * 1.15;
	const nameFontSize = Math.max(10, Math.round(baseFontSize * 1.18));
	const nameLineHeight = Math.max(12, Math.round(nameFontSize * 1.04));
	const typeFontSize = Math.max(8, Math.round(baseFontSize * 0.62));
	const typeLineHeight = Math.max(10, Math.round(typeFontSize * 1.12));
	const descFontSize = Math.max(8, Math.round(baseFontSize * 0.84));
	const descLineHeight = Math.max(10, Math.round(baseLineHeight * 0.9));
	const rowPadY = Math.max(8, Math.round(baseLineHeight * 0.18));
	const rowGap = Math.max(4, Math.round(baseLineHeight * 0.12));

	let cursorY = innerY;

	for (let idx = 0; idx < effects.length; idx++) {
		const effect = effects[idx];
		if (cursorY >= maxY) break;
		const effectType = ((effect.effect_type ?? 'during_combat') as SpecialEffectType) || 'during_combat';
		const typeLabel = formatEffectTypeTag(effectType);
		const typeColor = EFFECT_TYPE_COLORS[effectType] ?? EFFECT_TYPE_COLORS.during_combat;

		const effectName = (effect.name ?? '').toString().trim();
		ctx.font = `800 ${nameFontSize}px Opsilon`;
		const nameLines = wrapText(ctx, effectName, typeColW);
		const nameBlockH = nameLines.length * nameLineHeight;

		ctx.font = `italic 600 ${typeFontSize}px Vincendo`;
		const typeLines = wrapText(ctx, typeLabel, typeColW);
		const typeBlockH = typeLines.length * typeLineHeight;

		const leftGap = typeBlockH > 0 && nameBlockH > 0 ? Math.max(6, Math.round(baseLineHeight * 0.14)) : 0;
		const leftBlockH = nameBlockH + leftGap + typeBlockH;

		const desc = stripHtml(effect.description).trim();
		ctx.font = `400 ${descFontSize}px Vincendo`;
		const descLines = desc ? wrapText(ctx, desc, effectColW) : [];
		const descBlockH = descLines.length * descLineHeight;

		const rowInnerH = Math.max(leftBlockH, descBlockH);
		const rowH = rowInnerH + rowPadY * 2;
		if (cursorY + rowH > maxY + 0.5) break;

		// Column divider
		ctx.save();
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		const dividerX = effectX - colGap / 2;
		ctx.moveTo(dividerX, cursorY + 6);
		ctx.lineTo(dividerX, cursorY + rowH - 6);
		ctx.stroke();
		ctx.restore();

		// Left column: name + type
		ctx.textBaseline = 'top';
		ctx.textAlign = 'left';
		let leftY = cursorY + rowPadY;
		ctx.fillStyle = color;
		ctx.font = `800 ${nameFontSize}px Opsilon`;
		for (const line of nameLines) {
			if (leftY > cursorY + rowH - rowPadY) break;
			ctx.fillText(line, typeX, leftY, typeColW);
			leftY += nameLineHeight;
		}
		if (leftGap > 0) leftY += leftGap;
		ctx.fillStyle = typeColor;
		ctx.font = `italic 600 ${typeFontSize}px Vincendo`;
		for (const line of typeLines) {
			if (leftY > cursorY + rowH - rowPadY) break;
			ctx.fillText(line, typeX, leftY, typeColW);
			leftY += typeLineHeight;
		}

		// Right column: description
		ctx.fillStyle = color;
		ctx.font = `400 ${descFontSize}px Vincendo`;
		ctx.textBaseline = 'top';
		ctx.textAlign = 'left';
		let descY = cursorY + rowPadY + Math.max(0, (rowInnerH - descBlockH) / 2);
		for (let i = 0; i < descLines.length; i++) {
			if (descY > cursorY + rowH - rowPadY) break;
			ctx.fillText(descLines[i], effectX, descY, effectColW);
			descY += descLineHeight;
		}

		// Row divider
		if (idx < effects.length - 1) {
			ctx.save();
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			const lineY = cursorY + rowH;
			ctx.moveTo(innerX, lineY);
			ctx.lineTo(innerX + innerW, lineY);
			ctx.stroke();
			ctx.restore();
		}

		cursorY += rowH + rowGap;
	}

	ctx.restore();
}

// ---------------------------------------------------------------------------
// Scaled custom zone rendering helper
// ---------------------------------------------------------------------------

function renderCustomZoneAtScale(
	ctx: CanvasRenderingContext2D,
	zone: CustomZone,
	data: MonsterForLayout,
	images: Map<string, HTMLImageElement>,
	scale: number
): void {
	const scaledBox = {
		x: zone.box.x * scale,
		y: zone.box.y * scale,
		w: zone.box.w * scale,
		h: zone.box.h * scale
	};

	if (zone.key === 'rewards') {
		const gap = ((zone.customConfig.gap as number) ?? 0) * scale;
		const maxPerRow = (zone.customConfig.maxPerRow as number) ?? 7;
		const rewardIconIds = normalizeRewardTrack(data.reward_track);
		const rewardUrls: (string | null)[] = rewardIconIds.map((id) => getIconPoolUrl(id));
		drawRewardTrackGrid(ctx, scaledBox, gap, maxPerRow, rewardUrls, images);
	} else if (zone.key === 'effects') {
		const fontSize = ((zone.customConfig.fontSize as number) ?? 56) * scale;
		const rawLh = zone.customConfig.lineHeight as number | undefined;
		const lineHeight = rawLh != null ? rawLh * scale : undefined;
		const color = (zone.customConfig.color as string) ?? '#ffffff';
		drawSpecialEffectsGrid(ctx, scaledBox, fontSize, lineHeight, color, data.effects);
	} else if (zone.key === 'dice_pool') {
		const gap = ((zone.customConfig.gap as number) ?? 14) * scale;
		const maxPerRow = (zone.customConfig.maxPerRow as number) ?? 4;
		const dicePoolIds: string[] = Array.isArray(data.dice_pool) ? data.dice_pool : [];
		const dicePoolUrls: (string | null)[] = dicePoolIds.map((id) => getIconPoolUrl(id));
		drawDicePoolGrid(ctx, scaledBox, gap, maxPerRow, dicePoolUrls, images);
	}
}

// ---------------------------------------------------------------------------
// CardRenderer implementation
// ---------------------------------------------------------------------------

export const monsterCardRenderer: CardRenderer<MonsterForLayout> = {
	renderCustomZone(ctx, zone, data, images) {
		renderCustomZoneAtScale(ctx, zone, data, images, 1);
	},

	renderCustomZonePreview(ctx, zone, data, images, scale) {
		renderCustomZoneAtScale(ctx, zone, data, images, scale);
	},

	collectImageUrls(_config, data) {
		const urls: string[] = [];

		// Reward track icons
		const rewardIconIds = normalizeRewardTrack(data.reward_track);
		for (const id of rewardIconIds) {
			const url = getIconPoolUrl(id);
			if (url) urls.push(url);
		}

		// Dice pool icons
		const dicePoolIds: string[] = Array.isArray(data.dice_pool) ? data.dice_pool : [];
		for (const id of dicePoolIds) {
			const url = getIconPoolUrl(id);
			if (url) urls.push(url);
		}

		return urls;
	},

	getDefaultConfig(): CardLayoutConfig {
		return {
			_version: 1,
			_ref_w: 2550,
			_ref_h: 3300,
			cardType: 'monster',
			zones: [
				{
					type: 'text',
					key: 'damage',
					label: 'Damage',
					box: { x: 81, y: 887, w: 160, h: 200 },
					fontSize: 180,
					align: 'center',
					color: '#ffffff'
				},
				{
					type: 'text',
					key: 'barrier',
					label: 'Barrier',
					box: { x: 2257, y: 884, w: 160, h: 200 },
					fontSize: 180,
					align: 'center',
					color: '#ffffff'
				},
				{
					type: 'custom',
					key: 'effects',
					label: 'Special Effects',
					box: { x: 339, y: 1028, w: 2000, h: 800 },
					customConfig: { fontSize: 72, lineHeight: 86, color: '#ffffff' }
				},
				{
					type: 'custom',
					key: 'dice_pool',
					label: 'Dice Pool',
					box: { x: 550, y: 1439, w: 1000, h: 400 },
					customConfig: { gap: 14, maxPerRow: 4 }
				},
				{
					type: 'custom',
					key: 'rewards',
					label: 'Reward Track',
					box: { x: 314, y: 1932, w: 2000, h: 900 },
					customConfig: { gap: 0, maxPerRow: 7 }
				},
				{
					type: 'text',
					key: 'choose_on_kill',
					label: 'Choose 1 on Kill',
					box: { x: 0, y: 0, w: 950, h: 100 },
					fontSize: 64,
					align: 'center',
					color: '#ffffff',
					fontWeight: '700',
					fontFamily: 'Vincendo'
				}
			]
		};
	}
};

// ---------------------------------------------------------------------------
// Zone data builder
// ---------------------------------------------------------------------------

export function buildMonsterZoneData(monster: MonsterForLayout, _config: CardLayoutConfig): ZoneDataMap {
	const showDamage = !monster.attack_type || monster.attack_type === 'damage';
	return {
		texts: {
			damage: showDamage ? `Damage: ${monster.damage ?? 0}` : '',
			barrier: `Barrier: ${monster.barrier ?? 0}`,
			choose_on_kill: monster.choose_amount > 0 ? `Choose ${monster.choose_amount} on kill` : ''
		},
		iconGrids: {},
		images: {}
	};
}
