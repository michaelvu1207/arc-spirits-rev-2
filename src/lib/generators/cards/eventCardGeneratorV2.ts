import type { StageEventCardRow } from '$lib/types/gameData';
import { DEFAULT_EVENT_TYPE, eventTypeLabel } from '$lib/types/eventTypes';
import { createCanvas, getContext, loadImage, canvasToBlob, roundRect, wrapText, loadOpsilonFont } from '../shared/canvas';

/**
 * Mysterious Event Card Generator V2
 * Inspired by Monster card layout but with arcane/ethereal aesthetic
 * Deep indigos, purples, teals with mystical overlays
 */

const EVENT_CARD_WIDTH = 600;
const EVENT_CARD_HEIGHT = 437;
const EXPORT_SCALE = 2;
const LEFT_PANEL_WIDTH = Math.round(EVENT_CARD_WIDTH * 0.6);
const RIGHT_PANEL_WIDTH = EVENT_CARD_WIDTH - LEFT_PANEL_WIDTH;
const BOTTOM_BAR_HEIGHT = 56;

const MAIN_PADDING = 24;
const CONTENT_GAP = 12;

function drawImageCover(
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
	const scale = Math.max(w / safeW, h / safeH);
	const drawW = safeW * scale;
	const drawH = safeH * scale;
	const drawX = x + (w - drawW) / 2;
	const drawY = y + (h - drawH) / 2;
	ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

/**
 * Draw arcane rune circle overlay - mystical pattern replacing the vein overlay
 */
function drawArcaneOverlay(ctx: CanvasRenderingContext2D, width: number, height: number) {
	const patternCanvas = document.createElement('canvas');
	patternCanvas.width = 120;
	patternCanvas.height = 120;
	const pctx = patternCanvas.getContext('2d');
	if (!pctx) return;

	pctx.clearRect(0, 0, 120, 120);

	// Arcane circles
	pctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
	pctx.lineWidth = 0.5;
	pctx.beginPath();
	pctx.arc(60, 60, 40, 0, Math.PI * 2);
	pctx.stroke();

	pctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
	pctx.beginPath();
	pctx.arc(60, 60, 30, 0, Math.PI * 2);
	pctx.stroke();

	// Mystical lines
	pctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
	pctx.lineWidth = 0.3;
	for (let i = 0; i < 6; i++) {
		const angle = (i * Math.PI) / 3;
		pctx.beginPath();
		pctx.moveTo(60 + Math.cos(angle) * 20, 60 + Math.sin(angle) * 20);
		pctx.lineTo(60 + Math.cos(angle) * 50, 60 + Math.sin(angle) * 50);
		pctx.stroke();
	}

	// Small rune dots
	pctx.fillStyle = 'rgba(167, 139, 250, 0.15)';
	for (let i = 0; i < 6; i++) {
		const angle = (i * Math.PI) / 3 + Math.PI / 6;
		pctx.beginPath();
		pctx.arc(60 + Math.cos(angle) * 35, 60 + Math.sin(angle) * 35, 2, 0, Math.PI * 2);
		pctx.fill();
	}

	const pattern = ctx.createPattern(patternCanvas, 'repeat');
	if (!pattern) return;

	ctx.save();
	ctx.globalAlpha = 0.6;
	ctx.fillStyle = pattern;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}

/**
 * Draw mystical mist effect instead of slash marks
 */
function drawMistEffect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	ctx.save();
	ctx.globalAlpha = 0.25;
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();

	// Layered mist gradients
	const gradient1 = ctx.createRadialGradient(x + w * 0.3, y + h * 0.4, 0, x + w * 0.3, y + h * 0.4, w * 0.6);
	gradient1.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
	gradient1.addColorStop(0.5, 'rgba(99, 102, 241, 0.15)');
	gradient1.addColorStop(1, 'transparent');
	ctx.fillStyle = gradient1;
	ctx.fillRect(x, y, w, h);

	const gradient2 = ctx.createRadialGradient(x + w * 0.7, y + h * 0.6, 0, x + w * 0.7, y + h * 0.6, w * 0.5);
	gradient2.addColorStop(0, 'rgba(79, 70, 229, 0.2)');
	gradient2.addColorStop(1, 'transparent');
	ctx.fillStyle = gradient2;
	ctx.fillRect(x, y, w, h);

	ctx.restore();
}

/**
 * Draw floating particles/stars
 */
function drawParticles(ctx: CanvasRenderingContext2D, width: number, height: number) {
	ctx.save();
	const particles = [
		{ x: 50, y: 80, size: 2, alpha: 0.6 },
		{ x: 120, y: 150, size: 1.5, alpha: 0.4 },
		{ x: 80, y: 250, size: 2, alpha: 0.5 },
		{ x: 200, y: 100, size: 1, alpha: 0.3 },
		{ x: 180, y: 300, size: 2.5, alpha: 0.5 },
		{ x: 300, y: 50, size: 1.5, alpha: 0.4 },
		{ x: 450, y: 120, size: 2, alpha: 0.35 },
		{ x: 520, y: 200, size: 1.5, alpha: 0.3 },
		{ x: 480, y: 320, size: 2, alpha: 0.4 },
	];

	for (const p of particles) {
		ctx.globalAlpha = p.alpha;
		ctx.fillStyle = '#a78bfa';
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
		ctx.fill();

		// Soft glow
		const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
		glow.addColorStop(0, 'rgba(167, 139, 250, 0.3)');
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

export async function generateEventCardPNGV2(
	event: StageEventCardRow,
	artUrl?: string | null
): Promise<Blob> {
	if (!event.id) {
		throw new Error('Event missing ID');
	}

	await loadOpsilonFont();

	// Create canvas
	const canvas = createCanvas(EVENT_CARD_WIDTH * EXPORT_SCALE, EVENT_CARD_HEIGHT * EXPORT_SCALE);
	const ctx = getContext(canvas);
	ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
	ctx.imageSmoothingEnabled = true;
	try {
		ctx.imageSmoothingQuality = 'high';
	} catch {
		// ignore
	}

	// Color palette - mysterious indigo/purple theme
	const colors = {
		bgDark: '#0a0a1a',
		bgMid: '#12122a',
		bgLight: '#1a1a3d',
		accent: '#8b5cf6', // Violet
		accentLight: '#a78bfa',
		accentDark: '#6d28d9',
		textPrimary: '#e0e7ff',
		textSecondary: '#a5b4fc',
		textMuted: '#6366f1',
		border: '#4c1d95',
	};

	ctx.save();
	roundRect(ctx, 0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, 4);
	ctx.clip();

	// Base background gradient - deep indigo to dark purple
	const cardGrad = ctx.createLinearGradient(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);
	cardGrad.addColorStop(0, '#0f0a1a');
	cardGrad.addColorStop(0.3, '#1a1033');
	cardGrad.addColorStop(0.6, '#150d28');
	cardGrad.addColorStop(1, '#0a0812');
	ctx.fillStyle = cardGrad;
	ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	// Arcane overlay pattern
	drawArcaneOverlay(ctx, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	// Floating particles
	drawParticles(ctx, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	// Art panel (right side)
	const artX = LEFT_PANEL_WIDTH;
	const artY = 0;
	const artW = RIGHT_PANEL_WIDTH;
	const contentH = EVENT_CARD_HEIGHT - BOTTOM_BAR_HEIGHT;
	const artH = contentH;

	if (artUrl) {
		try {
			const artImg = await loadImage(artUrl);
			ctx.save();
			// Subtle desaturation and cool tint
			ctx.filter = 'saturate(70%) contrast(110%) brightness(85%) hue-rotate(10deg)';
			drawImageCover(ctx, artImg, artX, artY, artW, artH);
			ctx.restore();
		} catch (err) {
			console.warn('Failed to load event art:', err);
		}
	} else {
		// No art - show gradient placeholder
		const noArtGrad = ctx.createLinearGradient(artX, artY, artX + artW, artY + artH);
		noArtGrad.addColorStop(0, '#1a1033');
		noArtGrad.addColorStop(1, '#0a0812');
		ctx.fillStyle = noArtGrad;
		ctx.fillRect(artX, artY, artW, artH);
	}

	// Art gradient overlay (fade from left panel into art)
	const artGrad = ctx.createLinearGradient(artX, 0, artX + artW, 0);
	artGrad.addColorStop(0, 'rgba(15, 10, 26, 0.95)');
	artGrad.addColorStop(0.25, 'rgba(26, 16, 51, 0.6)');
	artGrad.addColorStop(0.5, 'rgba(21, 13, 40, 0.3)');
	artGrad.addColorStop(1, 'rgba(10, 8, 18, 0.1)');
	ctx.fillStyle = artGrad;
	ctx.fillRect(artX, artY, artW, artH);

	// Main info panel (left side)
	const mainGrad = ctx.createLinearGradient(0, 0, LEFT_PANEL_WIDTH, contentH);
	mainGrad.addColorStop(0, 'rgba(26, 16, 51, 0.92)');
	mainGrad.addColorStop(1, 'rgba(15, 10, 26, 0.95)');
	ctx.fillStyle = mainGrad;
	ctx.fillRect(0, 0, LEFT_PANEL_WIDTH, contentH);

	// Mist effect in top-right of main panel
	drawMistEffect(ctx, LEFT_PANEL_WIDTH - 80, 10, 70, 100);

	const innerX = MAIN_PADDING;
	const innerW = LEFT_PANEL_WIDTH - MAIN_PADDING * 2;
	let yPos = MAIN_PADDING;

	// Type badge (styled like monster classification badge)
	const orderText = eventTypeLabel(event.stage ?? DEFAULT_EVENT_TYPE).toUpperCase();
	ctx.font = '700 13px Opsilon, serif';
	const orderMetrics = ctx.measureText(orderText);
	const orderW = orderMetrics.width + 24;
	const orderH = 26;
	const orderRadius = 4;

	ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
	roundRect(ctx, innerX, yPos, orderW, orderH, orderRadius);
	ctx.fill();
	ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
	ctx.lineWidth = 1;
	roundRect(ctx, innerX, yPos, orderW, orderH, orderRadius);
	ctx.stroke();

	ctx.fillStyle = colors.accentLight;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(orderText, innerX + orderW / 2, yPos + orderH / 2 + 1);
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';

	yPos += orderH + 16;

	// Title - large and glowing
	const eventTitle = event.title.toUpperCase();
	const maxTitleWidth = innerW;
	let titleFontSize = 36;
	ctx.fillStyle = colors.textPrimary;
	while (titleFontSize > 20) {
		ctx.font = `800 ${titleFontSize}px Opsilon, serif`;
		if (ctx.measureText(eventTitle).width <= maxTitleWidth) break;
		titleFontSize -= 2;
	}

	// Multi-line title wrapping
	const titleLines = wrapText(ctx, eventTitle, maxTitleWidth);

	ctx.save();
	ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
	ctx.shadowBlur = 15;
	ctx.shadowOffsetY = 0;
	for (const line of titleLines.slice(0, 2)) {
		const titleMetrics = ctx.measureText(line);
		const titleAscent = titleMetrics.actualBoundingBoxAscent || titleFontSize * 0.8;
		ctx.fillText(line, innerX, yPos + titleAscent);
		yPos += titleFontSize + 4;
	}
	ctx.restore();

	yPos += 8;

	// Mystical divider
	ctx.save();
	ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(innerX, yPos);
	ctx.lineTo(innerX + innerW * 0.4, yPos);
	ctx.stroke();

	// Center diamond
	const diamondX = innerX + innerW * 0.45;
	ctx.fillStyle = colors.accent;
	ctx.save();
	ctx.translate(diamondX, yPos);
	ctx.rotate(Math.PI / 4);
	ctx.fillRect(-4, -4, 8, 8);
	ctx.restore();

	// Right line
	ctx.beginPath();
	ctx.moveTo(innerX + innerW * 0.5, yPos);
	ctx.lineTo(innerX + innerW, yPos);
	ctx.stroke();
	ctx.restore();

	yPos += 20;

	// Description area
	const descBottom = contentH - MAIN_PADDING;
	const descAvailable = descBottom - yPos;

	if (event.description && descAvailable > 40) {
		ctx.save();

		// Description background panel
		const descPanelH = Math.min(descAvailable, 140);
		ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
		ctx.beginPath();
		ctx.moveTo(innerX, yPos);
		ctx.lineTo(innerX + innerW, yPos);
		ctx.lineTo(innerX + innerW - 8, yPos + descPanelH);
		ctx.lineTo(innerX, yPos + descPanelH);
		ctx.closePath();
		ctx.fill();

		// Accent line on left
		ctx.fillStyle = colors.accent;
		ctx.fillRect(innerX, yPos, 3, descPanelH);

		// Description text
		const descPad = 14;
		ctx.font = '500 15px Opsilon, serif';
		ctx.fillStyle = '#c7d2fe';

		const maxDescW = innerW - descPad * 2;
		const descLines = wrapText(ctx, event.description, maxDescW);
		const lineHeight = 22;
		let descY = yPos + descPad + 12;

		for (const line of descLines.slice(0, 5)) {
			if (descY > yPos + descPanelH - descPad) break;
			ctx.fillText(line, innerX + descPad, descY);
			descY += lineHeight;
		}

		ctx.restore();
	}

	// Bottom bar
	const bottomBarY = EVENT_CARD_HEIGHT - BOTTOM_BAR_HEIGHT;
	const bottomGrad = ctx.createLinearGradient(0, bottomBarY, 0, EVENT_CARD_HEIGHT);
	bottomGrad.addColorStop(0, 'rgba(15, 10, 30, 0.95)');
	bottomGrad.addColorStop(1, 'rgba(8, 6, 18, 0.98)');
	ctx.fillStyle = bottomGrad;
	ctx.fillRect(0, bottomBarY, EVENT_CARD_WIDTH, BOTTOM_BAR_HEIGHT);

	// Top border of bottom bar
	ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, bottomBarY + 0.5);
	ctx.lineTo(EVENT_CARD_WIDTH, bottomBarY + 0.5);
	ctx.stroke();

	// Footer text
	ctx.font = '700 11px Opsilon, serif';
	ctx.fillStyle = 'rgba(99, 102, 241, 0.6)';
	ctx.textAlign = 'left';
	ctx.fillText('ARC SPIRITS', MAIN_PADDING, bottomBarY + BOTTOM_BAR_HEIGHT / 2 + 4);

	// Decorative symbols in footer
	const symbolY = bottomBarY + BOTTOM_BAR_HEIGHT / 2;
	ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';

	// Left symbol
	ctx.save();
	ctx.translate(MAIN_PADDING + 85, symbolY);
	ctx.rotate(Math.PI / 4);
	ctx.fillRect(-3, -3, 6, 6);
	ctx.restore();

	// Right symbol
	ctx.save();
	ctx.translate(EVENT_CARD_WIDTH - MAIN_PADDING - 120, symbolY);
	ctx.rotate(Math.PI / 4);
	ctx.fillRect(-3, -3, 6, 6);
	ctx.restore();

	ctx.restore();

	// Card border - mystical purple
	ctx.strokeStyle = '#4c1d95';
	ctx.lineWidth = 2;
	roundRect(ctx, 1, 1, EVENT_CARD_WIDTH - 2, EVENT_CARD_HEIGHT - 2, 4);
	ctx.stroke();

	// Subtle glow on border corners
	const cornerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
	cornerGlow.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
	cornerGlow.addColorStop(1, 'transparent');
	ctx.fillStyle = cornerGlow;
	ctx.fillRect(0, 0, 60, 60);

	const cornerGlow2 = ctx.createRadialGradient(EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, 60);
	cornerGlow2.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
	cornerGlow2.addColorStop(1, 'transparent');
	ctx.fillStyle = cornerGlow2;
	ctx.fillRect(EVENT_CARD_WIDTH - 60, EVENT_CARD_HEIGHT - 60, 60, 60);

	return canvasToBlob(canvas);
}
