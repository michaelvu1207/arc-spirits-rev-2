import type { VengeanceCardRow } from '$lib/types/gameData';
import { getIconPoolUrl } from '$lib/utils/iconPool';
import { canvasToBlob, createCanvas, getContext, loadImage, loadOpsilonFont, roundRect } from '../shared/canvas';

// Vengeance card dimensions (7:5 aspect ratio)
export const VENGEANCE_CARD_WIDTH = 700;
export const VENGEANCE_CARD_HEIGHT = 500;

// Content padding
const CONTENT_PADDING_X = 45;
const CONTENT_PADDING_TOP = 32;

// Reward icon dimensions
const ICON_SIZE = 56;
const ICON_GAP = 12;

// Shadow Veil color palette
const COLORS = {
	// Backgrounds
	bgDark: '#050508',
	bgMid: '#0d0d15',
	bgLight: '#151520',

	// Purple accents
	purple: '#581c87',
	purpleLight: '#7c3aed',
	purpleBright: '#a78bfa',
	purplePale: '#c4b5fd',

	// Grays
	grayDark: '#374151',
	grayMid: '#6b7280',
	grayLight: '#9ca3af',
	textLight: '#e5e7eb',
	textPale: '#d1d5db',

	// Veil border
	veilBorder: 'rgba(88, 28, 135, 0.4)'
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
	const outline = options?.outline ?? Math.max(1, Math.round(Math.min(w, h) * 0.06));
	const outlineColor = options?.color ?? 'rgba(0, 0, 0, 0.6)';

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

function drawBackground(ctx: CanvasRenderingContext2D): void {
	const w = VENGEANCE_CARD_WIDTH;
	const h = VENGEANCE_CARD_HEIGHT;

	// Main gradient background
	const bgGradient = ctx.createLinearGradient(0, 0, w, h);
	bgGradient.addColorStop(0, COLORS.bgDark);
	bgGradient.addColorStop(0.3, COLORS.bgLight);
	bgGradient.addColorStop(0.7, COLORS.bgMid);
	bgGradient.addColorStop(1, COLORS.bgDark);
	ctx.fillStyle = bgGradient;
	ctx.fillRect(0, 0, w, h);

	// Shadow mist effect (multiple radial gradients)
	ctx.save();

	// Mist 1 - top left
	const mist1 = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, w * 0.5);
	mist1.addColorStop(0, 'rgba(88, 28, 135, 0.2)');
	mist1.addColorStop(1, 'transparent');
	ctx.fillStyle = mist1;
	ctx.fillRect(0, 0, w, h);

	// Mist 2 - bottom right
	const mist2 = ctx.createRadialGradient(w * 0.7, h * 0.8, 0, w * 0.7, h * 0.8, w * 0.4);
	mist2.addColorStop(0, 'rgba(126, 34, 206, 0.15)');
	mist2.addColorStop(1, 'transparent');
	ctx.fillStyle = mist2;
	ctx.fillRect(0, 0, w, h);

	// Mist 3 - center
	const mist3 = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.6);
	mist3.addColorStop(0, 'rgba(30, 27, 75, 0.3)');
	mist3.addColorStop(1, 'transparent');
	ctx.fillStyle = mist3;
	ctx.fillRect(0, 0, w, h);

	ctx.restore();

	// Outer border
	ctx.strokeStyle = COLORS.grayDark;
	ctx.lineWidth = 3;
	roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 10);
	ctx.stroke();

	// Veil border (inner)
	ctx.strokeStyle = COLORS.veilBorder;
	ctx.lineWidth = 1;
	roundRect(ctx, 6, 6, w - 12, h - 12, 6);
	ctx.stroke();
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

export async function drawVengeanceCard(
	ctx: CanvasRenderingContext2D,
	card: VengeanceCardRow
): Promise<void> {
	const displayTitle = card.title || 'Vengeance';
	const displayDescription = card.description || 'Details yet unknown...';
	const rewardText = card.reward_text?.trim() || '';
	const rewardIconIds = card.reward_icon_ids || [];
	const quantity = card.quantity ?? 1;

	// Load reward icons
	const iconUrls = rewardIconIds
		.map((id) => getIconPoolUrl(id))
		.filter((url): url is string => !!url);
	const imageMap = await loadImages(iconUrls);

	ctx.clearRect(0, 0, VENGEANCE_CARD_WIDTH, VENGEANCE_CARD_HEIGHT);

	// Draw background with mist effects
	drawBackground(ctx);

	const contentX = CONTENT_PADDING_X;
	const contentWidth = VENGEANCE_CARD_WIDTH - CONTENT_PADDING_X * 2;
	const centerX = VENGEANCE_CARD_WIDTH / 2;
	let y = CONTENT_PADDING_TOP;

	// Header section: Shadow Eye + "VENGEANCE" label + quantity badge
	ctx.save();

	// Shadow Eye symbol
	ctx.font = '72px "Opsilon", serif';
	ctx.fillStyle = COLORS.purpleBright;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.shadowColor = 'rgba(167, 139, 250, 0.8)';
	ctx.shadowBlur = 20;
	ctx.fillText('◉', contentX, y + 28);
	ctx.restore();

	// "VENGEANCE" label
	ctx.save();
	ctx.font = '600 33px "Opsilon", serif';
	ctx.fillStyle = COLORS.grayLight;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.letterSpacing = '4px';
	ctx.fillText('VENGEANCE', contentX + 76, y + 28);
	ctx.letterSpacing = '0px';
	ctx.restore();

	// Quantity badge (if > 1)
	if (quantity > 1) {
		ctx.save();
		const badgeText = `×${quantity}`;
		ctx.font = '700 27px "Opsilon", serif';
		const badgeWidth = ctx.measureText(badgeText).width + 24;
		const badgeX = VENGEANCE_CARD_WIDTH - CONTENT_PADDING_X - badgeWidth;
		const badgeY = y + 12;

		// Badge background
		ctx.fillStyle = 'rgba(55, 65, 81, 0.5)';
		ctx.strokeStyle = 'rgba(107, 114, 128, 0.4)';
		ctx.lineWidth = 1;
		roundRect(ctx, badgeX, badgeY, badgeWidth, 32, 16);
		ctx.fill();
		ctx.stroke();

		// Badge text
		ctx.fillStyle = COLORS.grayLight;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + 16);
		ctx.restore();
	}

	y += 70;

	// Title
	ctx.save();
	ctx.font = '700 66px "Opsilon", serif';
	ctx.fillStyle = COLORS.textLight;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.shadowColor = 'rgba(88, 28, 135, 0.5)';
	ctx.shadowBlur = 30;
	const titleLines = wrapText(ctx, displayTitle, contentWidth - 40);
	const titleLineHeight = 78;
	for (let i = 0; i < titleLines.length; i++) {
		ctx.fillText(titleLines[i], centerX, y + titleLineHeight * (i + 1));
	}
	ctx.restore();
	y += titleLineHeight * titleLines.length + 12;

	// Shadow line under title
	const lineGradient = ctx.createLinearGradient(contentX, y, contentX + contentWidth, y);
	lineGradient.addColorStop(0, 'transparent');
	lineGradient.addColorStop(0.3, COLORS.purple);
	lineGradient.addColorStop(0.5, COLORS.purpleLight);
	lineGradient.addColorStop(0.7, COLORS.purple);
	lineGradient.addColorStop(1, 'transparent');
	ctx.save();
	ctx.strokeStyle = lineGradient;
	ctx.lineWidth = 1;
	ctx.shadowColor = 'rgba(88, 28, 135, 0.5)';
	ctx.shadowBlur = 20;
	ctx.beginPath();
	ctx.moveTo(contentX, y);
	ctx.lineTo(contentX + contentWidth, y);
	ctx.stroke();
	ctx.restore();
	y += 28;

	// Description area
	ctx.save();
	ctx.font = '400 39px "Opsilon", serif';
	ctx.fillStyle = COLORS.textPale;
	ctx.globalAlpha = 0.8;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';

	const descLines = wrapText(ctx, displayDescription, contentWidth - 60);
	const descLineHeight = 51;
	const maxDescLines = 4;
	const visibleDescLines = descLines.slice(0, maxDescLines);

	for (let i = 0; i < visibleDescLines.length; i++) {
		ctx.fillText(visibleDescLines[i], centerX, y + descLineHeight * (i + 1));
	}
	ctx.restore();
	y += descLineHeight * Math.max(visibleDescLines.length, 2) + 24;

	// Reward section
	const rewardY = y;

	// Reward label
	ctx.save();
	ctx.font = '700 24px "Opsilon", serif';
	ctx.fillStyle = COLORS.purpleBright;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'middle';
	ctx.letterSpacing = '2px';
	ctx.fillText('REWARD', contentX, rewardY + 28);
	ctx.letterSpacing = '0px';
	ctx.restore();

	// Reward divider line
	const rewardLabelWidth = 135;
	const rewardLineGradient = ctx.createLinearGradient(
		contentX + rewardLabelWidth + 16, rewardY + 28,
		contentX + contentWidth, rewardY + 28
	);
	rewardLineGradient.addColorStop(0, 'transparent');
	rewardLineGradient.addColorStop(0.5, 'rgba(88, 28, 135, 0.4)');
	rewardLineGradient.addColorStop(1, 'transparent');
	ctx.strokeStyle = rewardLineGradient;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(contentX + rewardLabelWidth + 16, rewardY + 28);
	ctx.lineTo(contentX + contentWidth, rewardY + 28);
	ctx.stroke();

	// Reward content
	const rewardContentY = rewardY + 48;

	if (rewardText) {
		// Text reward
		ctx.save();
		ctx.font = 'italic 36px "Opsilon", serif';
		ctx.fillStyle = 'rgba(209, 213, 219, 0.7)';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(rewardText, centerX, rewardContentY + ICON_SIZE / 2);
		ctx.restore();
	} else if (iconUrls.length > 0) {
		// Icon rewards - centered
		const maxIcons = 8;
		const visibleIcons = iconUrls.slice(0, maxIcons);
		const totalIconsWidth = visibleIcons.length * ICON_SIZE + (visibleIcons.length - 1) * ICON_GAP;
		let iconX = centerX - totalIconsWidth / 2;

		for (const url of visibleIcons) {
			// Icon slot background
			const slotGradient = ctx.createLinearGradient(iconX, rewardContentY, iconX, rewardContentY + ICON_SIZE);
			slotGradient.addColorStop(0, 'rgba(30, 27, 75, 0.6)');
			slotGradient.addColorStop(1, 'rgba(10, 10, 15, 0.8)');
			ctx.fillStyle = slotGradient;
			roundRect(ctx, iconX, rewardContentY, ICON_SIZE, ICON_SIZE, 8);
			ctx.fill();

			// Icon slot border
			ctx.strokeStyle = 'rgba(88, 28, 135, 0.5)';
			ctx.lineWidth = 1;
			roundRect(ctx, iconX, rewardContentY, ICON_SIZE, ICON_SIZE, 8);
			ctx.stroke();

			// Glow effect
			ctx.save();
			ctx.shadowColor = 'rgba(88, 28, 135, 0.2)';
			ctx.shadowBlur = 10;
			roundRect(ctx, iconX, rewardContentY, ICON_SIZE, ICON_SIZE, 8);
			ctx.stroke();
			ctx.restore();

			// Draw icon
			const img = imageMap.get(url);
			if (img) {
				const iconPadding = 10;
				drawImageWithOutline(
					ctx,
					img,
					iconX + iconPadding,
					rewardContentY + iconPadding,
					ICON_SIZE - iconPadding * 2,
					ICON_SIZE - iconPadding * 2,
					{ color: 'rgba(0, 0, 0, 0.5)' }
				);
			}

			iconX += ICON_SIZE + ICON_GAP;
		}
	} else {
		// Unknown reward
		ctx.save();
		ctx.font = 'italic 33px "Opsilon", serif';
		ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('Unknown', centerX, rewardContentY + ICON_SIZE / 2);
		ctx.restore();
	}
}

export async function generateVengeanceCardPNG(card: VengeanceCardRow): Promise<Blob> {
	await loadOpsilonFont();

	const canvas = createCanvas(VENGEANCE_CARD_WIDTH, VENGEANCE_CARD_HEIGHT);
	const ctx = getContext(canvas);
	await drawVengeanceCard(ctx, card);
	return canvasToBlob(canvas);
}
