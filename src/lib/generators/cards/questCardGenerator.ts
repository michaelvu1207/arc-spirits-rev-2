import type { TravelerQuestRow } from '$lib/types/gameData';
import { getIconPoolUrl } from '$lib/utils/iconPool';
import { canvasToBlob, createCanvas, getContext, loadImage, loadOpsilonFont, roundRect } from '../shared/canvas';

// Quest card dimensions (7:5 aspect ratio matching TravelerQuestCard)
export const QUEST_CARD_WIDTH = 700;
export const QUEST_CARD_HEIGHT = 500;

// Scroll roll dimensions
const ROLL_WIDTH = 56;
const ROLL_CAP_HEIGHT = 44;
const ROLL_BODY_INSET = 24;

// Content area
const CONTENT_PADDING_X = 64;
const CONTENT_PADDING_TOP = 40;

// Reward icon dimensions
const ICON_SIZE = 64;
const ICON_GAP = 12;

// Colors
const PAPER_COLORS = {
	light: '#e8dcc4',
	mid: '#d9c9a8',
	dark: '#d5c4a0'
};

const WOOD_COLORS = {
	dark: '#5a3a1e',
	mid: '#7a4f28',
	light: '#a0693d',
	cap: '#4a3520',
	capMid: '#6b4a30',
	capLight: '#8b6340'
};

const TEXT_COLORS = {
	header: '#6b5020',
	title: '#3a2810',
	description: '#4a3820',
	ornament: '#8b6914',
	reward: '#6b5020',
	accent: '#a08050'
};

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

function drawPaperBase(ctx: CanvasRenderingContext2D): void {
	const x = ROLL_WIDTH - 12;
	const y = 0;
	const w = QUEST_CARD_WIDTH - (ROLL_WIDTH - 12) * 2;
	const h = QUEST_CARD_HEIGHT;

	// Paper gradient
	const paperGradient = ctx.createLinearGradient(x, y, x + w, y + h);
	paperGradient.addColorStop(0, PAPER_COLORS.light);
	paperGradient.addColorStop(0.25, PAPER_COLORS.mid);
	paperGradient.addColorStop(0.5, '#e2d4b8');
	paperGradient.addColorStop(0.75, PAPER_COLORS.dark);
	paperGradient.addColorStop(1, '#ddd0b5');
	ctx.fillStyle = paperGradient;
	ctx.fillRect(x, y, w, h);

	// Paper stains (radial gradients for aged effect)
	ctx.save();
	const stain1 = ctx.createRadialGradient(
		x + w * 0.2, y + h * 0.3, 0,
		x + w * 0.2, y + h * 0.3, w * 0.3
	);
	stain1.addColorStop(0, 'rgba(139, 90, 43, 0.08)');
	stain1.addColorStop(1, 'transparent');
	ctx.fillStyle = stain1;
	ctx.fillRect(x, y, w, h);

	const stain2 = ctx.createRadialGradient(
		x + w * 0.8, y + h * 0.7, 0,
		x + w * 0.8, y + h * 0.7, w * 0.25
	);
	stain2.addColorStop(0, 'rgba(120, 80, 30, 0.06)');
	stain2.addColorStop(1, 'transparent');
	ctx.fillStyle = stain2;
	ctx.fillRect(x, y, w, h);

	const stain3 = ctx.createRadialGradient(
		x + w * 0.6, y + h * 0.2, 0,
		x + w * 0.6, y + h * 0.2, w * 0.2
	);
	stain3.addColorStop(0, 'rgba(100, 70, 20, 0.05)');
	stain3.addColorStop(1, 'transparent');
	ctx.fillStyle = stain3;
	ctx.fillRect(x, y, w, h);
	ctx.restore();

	// Paper border
	ctx.strokeStyle = '#a89060';
	ctx.lineWidth = 2;
	ctx.strokeRect(x, y, w, h);
}

function drawScrollRoll(ctx: CanvasRenderingContext2D, x: number, isRight: boolean): void {
	const rollX = isRight ? x - ROLL_WIDTH : x;
	const bodyTop = ROLL_BODY_INSET;
	const bodyBottom = QUEST_CARD_HEIGHT - ROLL_BODY_INSET;
	const bodyHeight = bodyBottom - bodyTop;

	// Roll shadow
	ctx.save();
	ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
	ctx.shadowBlur = 8;
	ctx.shadowOffsetX = isRight ? -4 : 4;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
	roundRect(ctx, rollX + 8, bodyTop + 10, ROLL_WIDTH - 16, bodyHeight - 20, ROLL_WIDTH / 2);
	ctx.fill();
	ctx.restore();

	// Roll body
	const bodyGradient = ctx.createLinearGradient(rollX, 0, rollX + ROLL_WIDTH, 0);
	bodyGradient.addColorStop(0, WOOD_COLORS.dark);
	bodyGradient.addColorStop(0.15, '#8b5a2b');
	bodyGradient.addColorStop(0.3, WOOD_COLORS.light);
	bodyGradient.addColorStop(0.5, WOOD_COLORS.mid);
	bodyGradient.addColorStop(0.7, '#8b5a2b');
	bodyGradient.addColorStop(0.85, WOOD_COLORS.dark);
	bodyGradient.addColorStop(1, WOOD_COLORS.dark);

	ctx.fillStyle = bodyGradient;
	roundRect(ctx, rollX, bodyTop, ROLL_WIDTH, bodyHeight, ROLL_WIDTH / 2);
	ctx.fill();

	// Roll highlight
	ctx.save();
	ctx.globalAlpha = 0.2;
	const highlightGradient = ctx.createLinearGradient(rollX, bodyTop, rollX, bodyBottom);
	highlightGradient.addColorStop(0, 'transparent');
	highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
	highlightGradient.addColorStop(1, 'transparent');
	ctx.fillStyle = highlightGradient;
	ctx.fillRect(rollX + 8, bodyTop + bodyHeight * 0.1, 10, bodyHeight * 0.8);
	ctx.restore();

	// Top cap
	drawRollCap(ctx, rollX - 8, 0, ROLL_WIDTH + 16, ROLL_CAP_HEIGHT);
	// Bottom cap
	drawRollCap(ctx, rollX - 8, QUEST_CARD_HEIGHT - ROLL_CAP_HEIGHT, ROLL_WIDTH + 16, ROLL_CAP_HEIGHT);
}

function drawRollCap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
	const capGradient = ctx.createLinearGradient(x, 0, x + w, 0);
	capGradient.addColorStop(0, WOOD_COLORS.cap);
	capGradient.addColorStop(0.2, WOOD_COLORS.capMid);
	capGradient.addColorStop(0.5, WOOD_COLORS.capLight);
	capGradient.addColorStop(0.8, WOOD_COLORS.capMid);
	capGradient.addColorStop(1, WOOD_COLORS.cap);

	ctx.save();
	ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
	ctx.shadowBlur = 8;
	ctx.shadowOffsetY = 4;
	ctx.fillStyle = capGradient;
	roundRect(ctx, x, y, w, h, 10);
	ctx.fill();
	ctx.restore();

	// Cap highlight
	ctx.save();
	ctx.globalAlpha = 0.1;
	const highlightGradient = ctx.createLinearGradient(x, 0, x + w, 0);
	highlightGradient.addColorStop(0, 'transparent');
	highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
	highlightGradient.addColorStop(1, 'transparent');
	ctx.fillStyle = highlightGradient;
	roundRect(ctx, x + 12, y + 6, w - 24, h - 12, 4);
	ctx.fill();
	ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		const metrics = ctx.measureText(testLine);

		if (metrics.width > maxWidth && currentLine) {
			lines.push(currentLine);
			currentLine = word;
		} else {
			currentLine = testLine;
		}
	}

	if (currentLine) {
		lines.push(currentLine);
	}

	return lines;
}

type QuestLikeRow = Pick<TravelerQuestRow, 'title' | 'description' | 'reward_text' | 'reward_icon_ids' | 'quantity'>;

export async function drawQuestCard(
	ctx: CanvasRenderingContext2D,
	quest: QuestLikeRow,
	headerLabel: string = 'Mission'
): Promise<void> {
	const displayTitle = quest.title || headerLabel;
	const displayDescription = quest.description || 'Details yet unknown...';
	const rewardText = quest.reward_text?.trim() || '';
	const rewardIconIds = quest.reward_icon_ids || [];

	// Load reward icons
	const iconUrls = rewardIconIds
		.map((id) => getIconPoolUrl(id))
		.filter((url): url is string => !!url);
	const imageMap = await loadImages(iconUrls);

	ctx.clearRect(0, 0, QUEST_CARD_WIDTH, QUEST_CARD_HEIGHT);

	// Draw paper base
	drawPaperBase(ctx);

	// Draw scroll rolls
	drawScrollRoll(ctx, 0, false); // Left roll
	drawScrollRoll(ctx, QUEST_CARD_WIDTH, true); // Right roll

	// Content area
	const contentX = ROLL_WIDTH;
	const contentWidth = QUEST_CARD_WIDTH - ROLL_WIDTH * 2;
	const textWidth = contentWidth - CONTENT_PADDING_X * 2;
	let y = CONTENT_PADDING_TOP;

	// Header: "~ {headerLabel} ~"
	ctx.save();
	ctx.font = '700 28px "Opsilon", "Crimson Text", serif';
	ctx.fillStyle = TEXT_COLORS.ornament;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';

	const headerY = y + 28;
	const questText = headerLabel;
	const ornamentGap = 16;
	const questWidth = ctx.measureText(questText).width;
	const centerX = contentX + contentWidth / 2;

	// Draw ornaments
	ctx.font = '400 32px "Opsilon", serif';
	ctx.fillText('~', centerX - questWidth / 2 - ornamentGap - 8, headerY);
	ctx.fillText('~', centerX + questWidth / 2 + ornamentGap + 8, headerY);

	// Draw label text
	ctx.font = '400 22px "Opsilon", serif';
	ctx.fillStyle = TEXT_COLORS.header;
	ctx.letterSpacing = '3px';
	ctx.fillText(questText.toUpperCase(), centerX, headerY);
	ctx.letterSpacing = '0px';
	ctx.restore();
	y += 52;

	// Title
	ctx.save();
	ctx.font = '700 42px "Opsilon", serif';
	ctx.fillStyle = TEXT_COLORS.title;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	const titleLines = wrapText(ctx, displayTitle, textWidth);
	const titleLineHeight = 48;
	for (let i = 0; i < titleLines.length; i++) {
		ctx.fillText(titleLines[i], centerX, y + titleLineHeight * (i + 1));
	}
	ctx.restore();
	y += titleLineHeight * titleLines.length + 12;

	// Title underline
	const underlineGradient = ctx.createLinearGradient(contentX + CONTENT_PADDING_X, y, contentX + contentWidth - CONTENT_PADDING_X, y);
	underlineGradient.addColorStop(0, 'transparent');
	underlineGradient.addColorStop(0.5, TEXT_COLORS.accent);
	underlineGradient.addColorStop(1, 'transparent');
	ctx.strokeStyle = underlineGradient;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(contentX + CONTENT_PADDING_X, y);
	ctx.lineTo(contentX + contentWidth - CONTENT_PADDING_X, y);
	ctx.stroke();
	y += 24;

	// Description area with background
	const descX = contentX + CONTENT_PADDING_X;
	const descWidth = textWidth;
	ctx.save();
	ctx.font = 'italic 28px "Opsilon", serif';
	const descLines = wrapText(ctx, displayDescription, descWidth - 32);
	const descLineHeight = 36;
	const descPadding = 24;
	const descHeight = Math.max(80, descLines.length * descLineHeight + descPadding * 2);

	// Description background
	ctx.fillStyle = 'rgba(255, 250, 240, 0.4)';
	ctx.fillRect(descX, y, descWidth, descHeight);

	// Description borders
	ctx.strokeStyle = 'rgba(139, 105, 20, 0.15)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(descX, y);
	ctx.lineTo(descX + descWidth, y);
	ctx.moveTo(descX, y + descHeight);
	ctx.lineTo(descX + descWidth, y + descHeight);
	ctx.stroke();

	// Description text
	ctx.fillStyle = TEXT_COLORS.description;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	let descTextY = y + descPadding + descLineHeight * 0.8;
	for (const line of descLines) {
		ctx.fillText(line, descX + 16, descTextY);
		descTextY += descLineHeight;
	}
	ctx.restore();
	y += descHeight + 20;

	// Reward section
	const rewardY = y;
	const rewardLabelWidth = 80;

	// Reward label
	ctx.save();
	ctx.font = '400 20px "Opsilon", serif';
	ctx.fillStyle = TEXT_COLORS.reward;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.letterSpacing = '2px';
	ctx.fillText('REWARD', descX, rewardY + 32);
	ctx.letterSpacing = '0px';
	ctx.restore();

	// Reward divider
	ctx.fillStyle = TEXT_COLORS.accent;
	ctx.fillRect(descX + rewardLabelWidth + 16, rewardY + 12, 2, 40);

	// Reward content
	const rewardContentX = descX + rewardLabelWidth + 32;
	const rewardContentY = rewardY;

	if (rewardText) {
		// Text reward
		ctx.save();
		ctx.font = '400 28px "Opsilon", serif';
		ctx.fillStyle = TEXT_COLORS.title;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(rewardText, rewardContentX, rewardContentY + 32);
		ctx.restore();
	} else if (iconUrls.length > 0) {
		// Icon rewards
		let iconX = rewardContentX;
		const iconY = rewardContentY;
		const maxIcons = 8;
		const visibleIcons = iconUrls.slice(0, maxIcons);

		for (const url of visibleIcons) {
			// Icon box background
			const boxGradient = ctx.createLinearGradient(iconX, iconY, iconX + ICON_SIZE, iconY + ICON_SIZE);
			boxGradient.addColorStop(0, '#4a3820');
			boxGradient.addColorStop(1, '#3a2810');
			ctx.fillStyle = boxGradient;
			roundRect(ctx, iconX, iconY, ICON_SIZE, ICON_SIZE, 6);
			ctx.fill();

			// Icon box border
			ctx.strokeStyle = TEXT_COLORS.header;
			ctx.lineWidth = 2;
			roundRect(ctx, iconX, iconY, ICON_SIZE, ICON_SIZE, 6);
			ctx.stroke();

			// Draw icon
			const img = imageMap.get(url);
			if (img) {
				const iconPadding = 12;
				drawImageWithOutline(
					ctx,
					img,
					iconX + iconPadding,
					iconY + iconPadding,
					ICON_SIZE - iconPadding * 2,
					ICON_SIZE - iconPadding * 2
				);
			}

			iconX += ICON_SIZE + ICON_GAP;
		}
	} else {
		// Unknown reward
		ctx.save();
		ctx.font = 'italic 26px "Opsilon", serif';
		ctx.fillStyle = 'rgba(58, 40, 16, 0.5)';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText('Unknown', rewardContentX, rewardContentY + 32);
		ctx.restore();
	}
}

export async function generateQuestCardPNG(quest: TravelerQuestRow): Promise<Blob> {
	// Load Opsilon font before drawing
	await loadOpsilonFont();

	const canvas = createCanvas(QUEST_CARD_WIDTH, QUEST_CARD_HEIGHT);
	const ctx = getContext(canvas);
	await drawQuestCard(ctx, quest, 'Mission');
	return canvasToBlob(canvas);
}
