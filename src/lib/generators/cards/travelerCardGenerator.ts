import type { GainRow, TradeRow, TravelerRow } from '$lib/types/gameData';
import { getIconPoolUrl } from '$lib/utils/iconPool';
import { canvasToBlob, createCanvas, getContext, loadImage, loadOpsilonFont, roundRect, wrapText } from '../shared/canvas';

export const TRAVELER_CARD_WIDTH = 600;
export const TRAVELER_CARD_HEIGHT = 437;

const ART_PANEL_WIDTH = Math.round(TRAVELER_CARD_WIDTH * 0.4);
const CONTENT_WIDTH = TRAVELER_CARD_WIDTH - ART_PANEL_WIDTH;
const CARD_RADIUS = 16;

const CONTENT_PADDING_X = 24;
const CONTENT_PADDING_TOP = 28;
const CONTENT_GAP = 16;

const ICON_SIZE = 42;
const ICON_GAP = 6;
const ICONS_PER_TRADE_GROUP = 5;
const ICONS_PER_GAIN_GROUP = 6;

type TravelerCardData = TravelerRow & {
	art_url?: string | null;
	traveler_subtext?: string | null;
	traveler_description?: string | null;
};

type ResolvedTradeRow = { leftGroups: string[][]; rightGroups: string[][] };
type ResolvedGainRow = string[][];

function normalizeGroups(groups: string[][] | null | undefined, fallback?: string[] | null): string[][] {
	if (Array.isArray(groups) && groups.length > 0) {
		return groups.map((group) => (Array.isArray(group) ? group : []));
	}
	if (Array.isArray(fallback) && fallback.length > 0) {
		return [fallback];
	}
	return [];
}

function resolveTradeRows(traveler: TravelerCardData): ResolvedTradeRow[] {
	const fromRows = Array.isArray(traveler.trade_rows) ? traveler.trade_rows : [];
	const fallbackLeft = Array.isArray(traveler.trade_left_icon_ids) ? traveler.trade_left_icon_ids : [];
	const fallbackRight = Array.isArray(traveler.trade_right_icon_ids) ? traveler.trade_right_icon_ids : [];
	const rows = fromRows.length > 0
		? fromRows
		: fallbackLeft.length > 0 || fallbackRight.length > 0
			? [{ left_icon_ids: fallbackLeft, right_icon_ids: fallbackRight } as TradeRow]
			: [];

	return rows
		.map((row) => {
			const leftGroups = normalizeGroups(row.left_icon_groups, row.left_icon_ids)
				.map((group) =>
					group
						.map((id) => getIconPoolUrl(id))
						.filter((url): url is string => !!url)
				)
				.map((group) => group.slice(0, ICONS_PER_TRADE_GROUP))
				.filter((group) => group.length > 0);
			const rightGroups = normalizeGroups(row.right_icon_groups, row.right_icon_ids)
				.map((group) =>
					group
						.map((id) => getIconPoolUrl(id))
						.filter((url): url is string => !!url)
				)
				.map((group) => group.slice(0, ICONS_PER_TRADE_GROUP))
				.filter((group) => group.length > 0);

			if (leftGroups.length === 0 && rightGroups.length === 0) return null;
			return { leftGroups, rightGroups };
		})
		.filter((row): row is ResolvedTradeRow => row !== null);
}

function resolveGainRows(traveler: TravelerCardData): ResolvedGainRow[] {
	const fromRows = Array.isArray(traveler.gain_rows) ? traveler.gain_rows : [];

	return fromRows
		.map((row: GainRow) => {
			const groups = normalizeGroups(row.icon_groups, row.icon_ids)
				.map((group) =>
					group
						.map((id) => getIconPoolUrl(id))
						.filter((url): url is string => !!url)
				)
				.map((group) => group.slice(0, ICONS_PER_GAIN_GROUP))
				.filter((group) => group.length > 0);

			return groups.length > 0 ? groups : null;
		})
		.filter((row): row is ResolvedGainRow => row !== null);
}

async function loadImages(urls: string[]): Promise<Map<string, HTMLImageElement>> {
	const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
	const results = await Promise.all(
		uniqueUrls.map(async (url) => {
			try {
				const img = await loadImage(url);
				return [url, img] as const;
			} catch {
				return null;
			}
		})
	);

	return new Map(results.filter((entry): entry is readonly [string, HTMLImageElement] => !!entry));
}

function drawImageWithOutline(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number,
	options?: { outline?: number; color?: string }
): void {
	const outline = options?.outline ?? Math.max(1, Math.round(Math.min(w, h) * 0.075));
	const outlineColor = options?.color ?? '#2b1a12';

	const naturalW = img.naturalWidth || img.width || w;
	const naturalH = img.naturalHeight || img.height || h;
	const safeW = naturalW > 0 ? naturalW : w;
	const safeH = naturalH > 0 ? naturalH : h;

	const scale = Math.min(w / safeW, h / safeH);
	const drawW = safeW * scale;
	const drawH = safeH * scale;
	const drawX = x + (w - drawW) / 2;
	const drawY = y + (h - drawH) / 2;

	const maskCanvas = createCanvas(safeW, safeH);
	const maskCtx = getContext(maskCanvas);
	maskCtx.drawImage(img, 0, 0, safeW, safeH);
	maskCtx.globalCompositeOperation = 'source-in';
	maskCtx.fillStyle = outlineColor;
	maskCtx.fillRect(0, 0, safeW, safeH);
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

function drawFlourish(ctx: CanvasRenderingContext2D, x: number, y: number, flipX: boolean, flipY: boolean) {
	const size = 30;
	const thickness = 2;
	const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
	gradient.addColorStop(0, '#c9a86c');
	gradient.addColorStop(1, '#8b7355');

	ctx.save();
	ctx.globalAlpha = 0.6;
	ctx.translate(x, y);
	ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
	ctx.translate(flipX ? -size : 0, flipY ? -size : 0);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, thickness);
	ctx.fillRect(0, 0, thickness, size);
	ctx.restore();
}

function drawNameBanner(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	skew: number = 12
) {
	// Main banner shape - parallelogram with folded ends
	const bannerGrad = ctx.createLinearGradient(x, y, x, y + height);
	bannerGrad.addColorStop(0, '#5a3a1e');
	bannerGrad.addColorStop(0.3, '#6b4423');
	bannerGrad.addColorStop(0.7, '#5a3a1e');
	bannerGrad.addColorStop(1, '#4a2a14');

	ctx.save();

	// Shadow
	ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
	ctx.shadowBlur = 8;
	ctx.shadowOffsetX = 3;
	ctx.shadowOffsetY = 3;

	// Main banner parallelogram
	ctx.beginPath();
	ctx.moveTo(x + skew, y);
	ctx.lineTo(x + width, y);
	ctx.lineTo(x + width - skew, y + height);
	ctx.lineTo(x, y + height);
	ctx.closePath();
	ctx.fillStyle = bannerGrad;
	ctx.fill();

	ctx.shadowColor = 'transparent';

	// Left folded end (darker triangle)
	ctx.beginPath();
	ctx.moveTo(x, y + height);
	ctx.lineTo(x - 8, y + height + 6);
	ctx.lineTo(x + skew - 4, y + height);
	ctx.closePath();
	ctx.fillStyle = '#2a1a0e';
	ctx.fill();

	// Top highlight
	ctx.beginPath();
	ctx.moveTo(x + skew + 2, y + 2);
	ctx.lineTo(x + width - 4, y + 2);
	ctx.strokeStyle = 'rgba(255, 220, 160, 0.3)';
	ctx.lineWidth = 1;
	ctx.stroke();

	// Bottom edge line
	ctx.beginPath();
	ctx.moveTo(x + 2, y + height - 1);
	ctx.lineTo(x + width - skew - 2, y + height - 1);
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
	ctx.lineWidth = 1;
	ctx.stroke();

	// Decorative diagonal stripes on banner
	ctx.globalAlpha = 0.1;
	ctx.strokeStyle = '#ffd080';
	ctx.lineWidth = 2;
	for (let i = 0; i < 5; i++) {
		const offsetX = x + skew + 20 + i * 25;
		ctx.beginPath();
		ctx.moveTo(offsetX, y);
		ctx.lineTo(offsetX - skew, y + height);
		ctx.stroke();
	}

	ctx.restore();
}

function drawDiagonalStripes(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	stripeWidth: number = 3,
	gap: number = 12,
	color: string = 'rgba(139, 90, 43, 0.06)'
) {
	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, width, height);
	ctx.clip();

	ctx.strokeStyle = color;
	ctx.lineWidth = stripeWidth;

	const diagonal = Math.sqrt(width * width + height * height);
	const count = Math.ceil(diagonal / gap) * 2;

	for (let i = -count; i < count; i++) {
		const startX = x + i * gap;
		ctx.beginPath();
		ctx.moveTo(startX, y);
		ctx.lineTo(startX + height, y + height);
		ctx.stroke();
	}

	ctx.restore();
}

function drawChevronDivider(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	chevronHeight: number = 6
) {
	const midX = x + width / 2;

	ctx.save();

	// Chevron shape pointing down
	const grad = ctx.createLinearGradient(x, y, x + width, y);
	grad.addColorStop(0, 'transparent');
	grad.addColorStop(0.3, '#8b5a2b');
	grad.addColorStop(0.5, '#a06830');
	grad.addColorStop(0.7, '#8b5a2b');
	grad.addColorStop(1, 'transparent');

	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(midX, y + chevronHeight);
	ctx.lineTo(x + width, y);
	ctx.strokeStyle = grad;
	ctx.lineWidth = 2;
	ctx.stroke();

	// Small diamond at center
	ctx.beginPath();
	ctx.moveTo(midX, y - 2);
	ctx.lineTo(midX + 4, y + chevronHeight / 2);
	ctx.lineTo(midX, y + chevronHeight + 2);
	ctx.lineTo(midX - 4, y + chevronHeight / 2);
	ctx.closePath();
	ctx.fillStyle = '#8b5a2b';
	ctx.fill();

	ctx.restore();
}

function measureSpacedText(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
	if (text.length <= 1) return ctx.measureText(text).width;
	let width = 0;
	for (let i = 0; i < text.length; i += 1) {
		width += ctx.measureText(text[i]).width;
		if (i < text.length - 1) width += spacing;
	}
	return width;
}

function drawSpacedText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	spacing: number
): void {
	let cursor = x;
	for (let i = 0; i < text.length; i += 1) {
		ctx.fillText(text[i], cursor, y);
		cursor += ctx.measureText(text[i]).width + spacing;
	}
}

function computeGroupWidth(count: number): number {
	if (count <= 0) return 0;
	return count * ICON_SIZE + (count - 1) * ICON_GAP;
}

function drawIconBlocks(
	ctx: CanvasRenderingContext2D,
	imageMap: Map<string, HTMLImageElement>,
	groups: string[][],
	x: number,
	y: number,
	width: number
): void {
	const visibleGroups = groups.filter((group) => group.length > 0);
	if (visibleGroups.length === 0) return;

	const slashFont = '700 24px "Opsilon", serif';
	ctx.font = slashFont;
	const slashWidth = ctx.measureText('/').width;
	const blocks: Array<{ type: 'group'; icons: string[]; width: number } | { type: 'slash'; width: number }> = [];

	for (let i = 0; i < visibleGroups.length; i += 1) {
		const icons = visibleGroups[i];
		blocks.push({ type: 'group', icons, width: computeGroupWidth(icons.length) });
		if (i < visibleGroups.length - 1) {
			blocks.push({ type: 'slash', width: slashWidth });
		}
	}

	const totalWidth =
		blocks.reduce((sum, block) => sum + block.width, 0) + ICON_GAP * (blocks.length - 1);
	let cursorX = x + (width - totalWidth) / 2;
	const centerY = y + ICON_SIZE / 2;

	for (const block of blocks) {
		if (block.type === 'slash') {
			ctx.save();
			ctx.font = slashFont;
			ctx.fillStyle = '#8b6914';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('/', cursorX + block.width / 2, centerY);
			ctx.restore();
		} else {
			let iconX = cursorX;
			for (const url of block.icons) {
				const img = imageMap.get(url);
				if (img) {
					drawImageWithOutline(ctx, img, iconX, y, ICON_SIZE, ICON_SIZE);
				}
				iconX += ICON_SIZE + ICON_GAP;
			}
		}

		cursorX += block.width + ICON_GAP;
	}
}

export async function drawTravelerCard(
	ctx: CanvasRenderingContext2D,
	traveler: TravelerCardData
): Promise<void> {
	const displayName = traveler.name || 'Traveler';
	const displaySubtext = (traveler.traveler_subtext ?? '').trim() || 'Subtext';
	const displayDescription = (traveler.traveler_description ?? '').trim() || 'Description';

	const tradeRows = resolveTradeRows(traveler);
	const gainRows = resolveGainRows(traveler);

	const iconUrls = [
		...(traveler.art_url ? [traveler.art_url] : []),
		...gainRows.flatMap((row) => row.flat()),
		...tradeRows.flatMap((row) => [...row.leftGroups.flat(), ...row.rightGroups.flat()])
	];
	const imageMap = await loadImages(iconUrls);

	ctx.clearRect(0, 0, TRAVELER_CARD_WIDTH, TRAVELER_CARD_HEIGHT);

	ctx.save();
	roundRect(ctx, 0, 0, TRAVELER_CARD_WIDTH, TRAVELER_CARD_HEIGHT, CARD_RADIUS);
	ctx.clip();

	// Parchment background for content area
	const bgGradient = ctx.createLinearGradient(0, 0, TRAVELER_CARD_WIDTH, TRAVELER_CARD_HEIGHT);
	bgGradient.addColorStop(0, '#e8dcc4');
	bgGradient.addColorStop(0.25, '#d9c9a8');
	bgGradient.addColorStop(0.5, '#e2d4b8');
	bgGradient.addColorStop(0.75, '#d5c4a0');
	bgGradient.addColorStop(1, '#ddd0b5');
	ctx.fillStyle = bgGradient;
	ctx.fillRect(0, 0, TRAVELER_CARD_WIDTH, TRAVELER_CARD_HEIGHT);

	// Diagonal stripe pattern on parchment for texture
	drawDiagonalStripes(
		ctx,
		ART_PANEL_WIDTH,
		0,
		CONTENT_WIDTH,
		TRAVELER_CARD_HEIGHT,
		2,
		18,
		'rgba(139, 90, 43, 0.04)'
	);

	// Paper stains for aged effect
	const stain1 = ctx.createRadialGradient(
		TRAVELER_CARD_WIDTH * 0.6, TRAVELER_CARD_HEIGHT * 0.3, 0,
		TRAVELER_CARD_WIDTH * 0.6, TRAVELER_CARD_HEIGHT * 0.3, TRAVELER_CARD_WIDTH * 0.3
	);
	stain1.addColorStop(0, 'rgba(139, 90, 43, 0.08)');
	stain1.addColorStop(1, 'transparent');
	ctx.fillStyle = stain1;
	ctx.fillRect(0, 0, TRAVELER_CARD_WIDTH, TRAVELER_CARD_HEIGHT);

	const stain2 = ctx.createRadialGradient(
		TRAVELER_CARD_WIDTH * 0.8, TRAVELER_CARD_HEIGHT * 0.7, 0,
		TRAVELER_CARD_WIDTH * 0.8, TRAVELER_CARD_HEIGHT * 0.7, TRAVELER_CARD_WIDTH * 0.25
	);
	stain2.addColorStop(0, 'rgba(120, 80, 30, 0.06)');
	stain2.addColorStop(1, 'transparent');
	ctx.fillStyle = stain2;
	ctx.fillRect(0, 0, TRAVELER_CARD_WIDTH, TRAVELER_CARD_HEIGHT);

	// Dark art panel on the left
	ctx.fillStyle = '#1a1610';
	ctx.fillRect(0, 0, ART_PANEL_WIDTH, TRAVELER_CARD_HEIGHT);

	if (traveler.art_url) {
		const artImg = imageMap.get(traveler.art_url);
		if (artImg) {
			const scale = Math.max(
				ART_PANEL_WIDTH / artImg.width,
				TRAVELER_CARD_HEIGHT / artImg.height
			);
			const drawW = artImg.width * scale;
			const drawH = artImg.height * scale;
			const drawX = (ART_PANEL_WIDTH - drawW) / 2;
			const drawY = (TRAVELER_CARD_HEIGHT - drawH) / 2;

			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, ART_PANEL_WIDTH, TRAVELER_CARD_HEIGHT);
			ctx.clip();
			ctx.filter = 'sepia(20%) saturate(0.9)';
			ctx.drawImage(artImg, drawX, drawY, drawW, drawH);
			ctx.filter = 'none';
			ctx.restore();
		}
	} else {
		ctx.save();
		ctx.fillStyle = 'rgba(139, 105, 20, 0.3)';
		ctx.font = '700 72px "Opsilon", serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('?', ART_PANEL_WIDTH / 2, TRAVELER_CARD_HEIGHT / 2);
		ctx.restore();
	}

	// Vignette from art panel to parchment
	const vignetteRight = ctx.createLinearGradient(0, 0, ART_PANEL_WIDTH, 0);
	vignetteRight.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
	vignetteRight.addColorStop(1, 'rgba(26, 22, 16, 0.6)');
	ctx.fillStyle = vignetteRight;
	ctx.fillRect(0, 0, ART_PANEL_WIDTH, TRAVELER_CARD_HEIGHT);

	const vignetteVertical = ctx.createLinearGradient(0, 0, 0, TRAVELER_CARD_HEIGHT);
	vignetteVertical.addColorStop(0, 'rgba(26, 22, 16, 0.5)');
	vignetteVertical.addColorStop(0.15, 'rgba(0, 0, 0, 0)');
	vignetteVertical.addColorStop(0.85, 'rgba(0, 0, 0, 0)');
	vignetteVertical.addColorStop(1, 'rgba(26, 22, 16, 0.5)');
	ctx.fillStyle = vignetteVertical;
	ctx.fillRect(0, 0, ART_PANEL_WIDTH, TRAVELER_CARD_HEIGHT);

	// Wooden divider between art and content
	const dividerGrad = ctx.createLinearGradient(ART_PANEL_WIDTH - 6, 0, ART_PANEL_WIDTH, 0);
	dividerGrad.addColorStop(0, '#5a3a1e');
	dividerGrad.addColorStop(0.3, '#8b5a2b');
	dividerGrad.addColorStop(0.7, '#6b4423');
	dividerGrad.addColorStop(1, '#4a3520');
	ctx.fillStyle = dividerGrad;
	ctx.fillRect(ART_PANEL_WIDTH - 6, 0, 6, TRAVELER_CARD_HEIGHT);

	// Corner flourishes on parchment side
	drawFlourish(ctx, ART_PANEL_WIDTH + 8, 8, false, false);
	drawFlourish(ctx, TRAVELER_CARD_WIDTH - 38, 8, true, false);
	drawFlourish(ctx, ART_PANEL_WIDTH + 8, TRAVELER_CARD_HEIGHT - 38, false, true);
	drawFlourish(ctx, TRAVELER_CARD_WIDTH - 38, TRAVELER_CARD_HEIGHT - 38, true, true);

	const contentX = ART_PANEL_WIDTH;
	const textWidth = CONTENT_WIDTH - CONTENT_PADDING_X * 2;
	let y = 8;

	// Draw name banner - diagonal ribbon behind the name
	const bannerHeight = 52;
	const bannerWidth = CONTENT_WIDTH + 20;
	drawNameBanner(ctx, contentX - 10, y, bannerWidth, bannerHeight, 14);

	// Name text on banner - centered with slight right offset
	ctx.save();
	ctx.font = '600 33px "Opsilon", serif';
	ctx.fillStyle = '#f5e6c8';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
	ctx.shadowBlur = 2;
	ctx.shadowOffsetX = 1;
	ctx.shadowOffsetY = 1;
	const nameText = displayName.length > 20 ? displayName.substring(0, 18) + '...' : displayName;
	ctx.fillText(nameText, contentX + CONTENT_WIDTH / 2 + 4, y + bannerHeight / 2 + 1);
	ctx.restore();
	y += bannerHeight + 12;

	// Subtext - italicized, right aligned with decorative dash
	ctx.save();
	ctx.font = 'italic 17px "Opsilon", serif';
	ctx.fillStyle = '#6b5020';
	ctx.textAlign = 'right';
	ctx.textBaseline = 'alphabetic';
	const subtextDisplay = `— ${displaySubtext} —`;
	ctx.fillText(subtextDisplay, contentX + CONTENT_WIDTH - CONTENT_PADDING_X, y + 14);
	ctx.restore();
	y += 28;

	// Chevron divider instead of simple line
	drawChevronDivider(ctx, contentX + CONTENT_PADDING_X, y, textWidth, 10);
	y += 20;

	// Description box with angular design
	const descX = contentX + CONTENT_PADDING_X;
	ctx.save();
	ctx.font = 'italic 18px "Opsilon", serif';
	const descLines = wrapText(ctx, displayDescription, textWidth - 28);
	const descLineHeight = 24;
	const descHeight = Math.max(60, descLines.length * descLineHeight + 20);

	// Description background with angled corner
	const cornerCut = 10;
	ctx.beginPath();
	ctx.moveTo(descX + cornerCut, y);
	ctx.lineTo(descX + textWidth, y);
	ctx.lineTo(descX + textWidth, y + descHeight - cornerCut);
	ctx.lineTo(descX + textWidth - cornerCut, y + descHeight);
	ctx.lineTo(descX, y + descHeight);
	ctx.lineTo(descX, y + cornerCut);
	ctx.closePath();

	// Fill with subtle gradient
	const descGrad = ctx.createLinearGradient(descX, y, descX + textWidth, y + descHeight);
	descGrad.addColorStop(0, 'rgba(58, 40, 16, 0.15)');
	descGrad.addColorStop(1, 'rgba(58, 40, 16, 0.08)');
	ctx.fillStyle = descGrad;
	ctx.fill();

	// Angular border
	ctx.strokeStyle = 'rgba(139, 105, 20, 0.4)';
	ctx.lineWidth = 1.5;
	ctx.stroke();

	// Corner accent lines
	ctx.beginPath();
	ctx.moveTo(descX, y + cornerCut);
	ctx.lineTo(descX + cornerCut, y);
	ctx.strokeStyle = '#8b5a2b';
	ctx.lineWidth = 2;
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(descX + textWidth - cornerCut, y + descHeight);
	ctx.lineTo(descX + textWidth, y + descHeight - cornerCut);
	ctx.stroke();

	// Description text
	ctx.font = 'italic 18px "Opsilon", serif';
	ctx.fillStyle = '#4a3820';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	let descTextY = y + 10 + descLineHeight;
	for (const line of descLines) {
		ctx.fillText(line, descX + 14, descTextY);
		descTextY += descLineHeight;
	}
	ctx.restore();
	y += descHeight + 16;

	if (gainRows.length > 0) {
		// GAIN label with diagonal accent
		ctx.save();
		ctx.font = '700 15px "Opsilon", serif';
		ctx.fillStyle = '#5a3a1e';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		const gainLabelWidth = ctx.measureText('GAIN').width + 16;

		// Label background parallelogram
		ctx.beginPath();
		ctx.moveTo(descX + 6, y);
		ctx.lineTo(descX + gainLabelWidth + 8, y);
		ctx.lineTo(descX + gainLabelWidth + 2, y + 20);
		ctx.lineTo(descX, y + 20);
		ctx.closePath();
		ctx.fillStyle = '#8b5a2b';
		ctx.fill();

		ctx.fillStyle = '#f5e6c8';
		ctx.fillText('GAIN', descX + 10, y + 15);
		ctx.restore();

		y += 28;
		for (let i = 0; i < gainRows.length; i += 1) {
			const rowHeight = ICON_SIZE + 16;
			ctx.save();

			// Hexagonal-ish icon container
			const hexCut = 6;
			ctx.beginPath();
			ctx.moveTo(descX + hexCut, y);
			ctx.lineTo(descX + textWidth - hexCut, y);
			ctx.lineTo(descX + textWidth, y + hexCut);
			ctx.lineTo(descX + textWidth, y + rowHeight - hexCut);
			ctx.lineTo(descX + textWidth - hexCut, y + rowHeight);
			ctx.lineTo(descX + hexCut, y + rowHeight);
			ctx.lineTo(descX, y + rowHeight - hexCut);
			ctx.lineTo(descX, y + hexCut);
			ctx.closePath();

			ctx.fillStyle = 'rgba(58, 40, 16, 0.12)';
			ctx.fill();
			ctx.strokeStyle = 'rgba(139, 105, 20, 0.35)';
			ctx.lineWidth = 1;
			ctx.stroke();
			ctx.restore();

			const innerWidth = textWidth - 20;
			const rowX = descX + 10;
			const rowY = y + 8;
			drawIconBlocks(ctx, imageMap, gainRows[i], rowX, rowY, innerWidth);
			y += rowHeight + (i < gainRows.length - 1 ? 8 : 0);
		}

		y += 16;
	}

	if (tradeRows.length > 0) {
		// TRADE label with diagonal accent
		ctx.save();
		ctx.font = '700 15px "Opsilon", serif';
		ctx.fillStyle = '#5a3a1e';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		const tradeLabelWidth = ctx.measureText('TRADE').width + 16;

		// Label background parallelogram
		ctx.beginPath();
		ctx.moveTo(descX + 6, y);
		ctx.lineTo(descX + tradeLabelWidth + 8, y);
		ctx.lineTo(descX + tradeLabelWidth + 2, y + 20);
		ctx.lineTo(descX, y + 20);
		ctx.closePath();
		ctx.fillStyle = '#6b4423';
		ctx.fill();

		ctx.fillStyle = '#f5e6c8';
		ctx.fillText('TRADE', descX + 10, y + 15);
		ctx.restore();

		y += 28;
		for (let i = 0; i < tradeRows.length; i += 1) {
			const rowHeight = ICON_SIZE + 18;
			ctx.save();

			// Angular trade container with arrow cutout aesthetic
			const cut = 8;
			ctx.beginPath();
			ctx.moveTo(descX + cut, y);
			ctx.lineTo(descX + textWidth - cut, y);
			ctx.lineTo(descX + textWidth, y + rowHeight / 2);
			ctx.lineTo(descX + textWidth - cut, y + rowHeight);
			ctx.lineTo(descX + cut, y + rowHeight);
			ctx.lineTo(descX, y + rowHeight / 2);
			ctx.closePath();

			ctx.fillStyle = 'rgba(58, 40, 16, 0.15)';
			ctx.fill();
			ctx.strokeStyle = 'rgba(139, 105, 20, 0.4)';
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.restore();

			const innerWidth = textWidth - 32;
			const rowX = descX + 16;
			const rowY = y + 9;

			// Draw proper arrow in the center
			const arrowLength = 32;
			const arrowHeadSize = 12;
			const centerX = descX + textWidth / 2;
			const centerY = y + rowHeight / 2;

			ctx.save();
			// Arrow shaft
			ctx.beginPath();
			ctx.moveTo(centerX - arrowLength / 2, centerY);
			ctx.lineTo(centerX + arrowLength / 2 - arrowHeadSize / 2, centerY);
			ctx.strokeStyle = '#5a3a1e';
			ctx.lineWidth = 3;
			ctx.lineCap = 'round';
			ctx.stroke();

			// Arrow head (filled triangle)
			ctx.beginPath();
			ctx.moveTo(centerX + arrowLength / 2, centerY);
			ctx.lineTo(centerX + arrowLength / 2 - arrowHeadSize, centerY - arrowHeadSize / 2);
			ctx.lineTo(centerX + arrowLength / 2 - arrowHeadSize, centerY + arrowHeadSize / 2);
			ctx.closePath();
			ctx.fillStyle = '#5a3a1e';
			ctx.fill();
			ctx.restore();

			const arrowSpace = arrowLength + 16;
			const sideWidth = (innerWidth - arrowSpace) / 2;
			const leftX = rowX;
			const rightX = centerX + arrowSpace / 2;

			drawIconBlocks(ctx, imageMap, tradeRows[i].leftGroups, leftX, rowY, sideWidth);
			drawIconBlocks(ctx, imageMap, tradeRows[i].rightGroups, rightX, rowY, sideWidth);

			y += rowHeight + (i < tradeRows.length - 1 ? 6 : 0);
		}
	}

	ctx.restore();

	// Outer border with wood grain gradient
	ctx.save();
	const borderGrad = ctx.createLinearGradient(0, 0, TRAVELER_CARD_WIDTH, TRAVELER_CARD_HEIGHT);
	borderGrad.addColorStop(0, '#6b4423');
	borderGrad.addColorStop(0.3, '#8b5a2b');
	borderGrad.addColorStop(0.5, '#7a4a28');
	borderGrad.addColorStop(0.7, '#8b5a2b');
	borderGrad.addColorStop(1, '#5a3a1e');
	ctx.strokeStyle = borderGrad;
	ctx.lineWidth = 4;
	roundRect(ctx, 2, 2, TRAVELER_CARD_WIDTH - 4, TRAVELER_CARD_HEIGHT - 4, CARD_RADIUS - 1);
	ctx.stroke();

	// Inner highlight
	ctx.strokeStyle = 'rgba(255, 220, 160, 0.15)';
	ctx.lineWidth = 1;
	roundRect(ctx, 5, 5, TRAVELER_CARD_WIDTH - 10, TRAVELER_CARD_HEIGHT - 10, CARD_RADIUS - 3);
	ctx.stroke();

	// Corner accents - diagonal lines at corners
	ctx.strokeStyle = '#a06830';
	ctx.lineWidth = 2;

	// Top-right corner accent
	ctx.beginPath();
	ctx.moveTo(TRAVELER_CARD_WIDTH - 30, 2);
	ctx.lineTo(TRAVELER_CARD_WIDTH - 2, 28);
	ctx.stroke();

	// Bottom-left corner accent
	ctx.beginPath();
	ctx.moveTo(2, TRAVELER_CARD_HEIGHT - 28);
	ctx.lineTo(28, TRAVELER_CARD_HEIGHT - 2);
	ctx.stroke();

	ctx.restore();
}

export async function generateTravelerCardPNG(traveler: TravelerCardData): Promise<Blob> {
	await loadOpsilonFont();
	const canvas = createCanvas(TRAVELER_CARD_WIDTH, TRAVELER_CARD_HEIGHT);
	const ctx = getContext(canvas);
	await drawTravelerCard(ctx, traveler);
	return canvasToBlob(canvas);
}
