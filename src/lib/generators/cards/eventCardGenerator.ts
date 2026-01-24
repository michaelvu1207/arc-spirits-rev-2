import type { StageEventCardRow, GameLocationRewardRow, RewardIconToken } from '$lib/types/gameData';
import { publicAssetUrl, bustUrl } from '$lib/utils/storage';
import { readEventCardBackgroundSettings } from '$lib/settings/eventCardBackground';
import type { EventCardBackgroundSettings } from '$lib/settings/eventCardBackground';
import { DEFAULT_EVENT_TYPE, eventTypeLabel } from '$lib/types/eventTypes';
import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';
import { REWARD_ROW_CONFIG, type RewardRow } from '$lib/types/gameData';
import { getStageLocationStyleSettings, type StageLocationStyleSettings } from '$lib/types/stageCardStylePresets';
import type { StageLocationRenderStyle } from '$lib/types/stageCardStyles';
import { getLocationStyleDefinition, getEventStyleDefinition, type CardStyleDefinition } from '$lib/types/cardStyleDefinitions';
import {
	createCanvas,
	getContext,
	loadImage,
	canvasToBlob,
	roundRect,
	wrapText,
	loadOpsilonFont
} from '../shared/canvas';

/**
 * Event Card Generator - V6 Symmetrical Arcane Design
 * Centered text layout with symmetrical mysterious frame
 * Deep purple/violet mystical theme
 */

const EVENT_CARD_WIDTH = 600;
const EVENT_CARD_HEIGHT = 437;
const EXPORT_SCALE = 2;

function hexToRgba(hex: string, alpha: number) {
	const sanitized = /^#([A-Fa-f0-9]{6})$/.test(hex) ? hex : '#8b5cf6';
	const r = parseInt(sanitized.slice(1, 3), 16);
	const g = parseInt(sanitized.slice(3, 5), 16);
	const b = parseInt(sanitized.slice(5, 7), 16);
	const a = Math.max(0, Math.min(1, alpha));
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

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

/**
 * Draw symmetrical frame lines
 */
function drawFrame(ctx: CanvasRenderingContext2D, width: number, height: number, style: CardStyleDefinition) {
	const frameColor = style.frame.color;
	const frameColorFade = style.frame.secondaryColor ?? hexToRgba(style.colors.primary, 0.2);
	const thickness = style.frame.thickness;

	// Different frame styles based on type
	if (style.frame.type === 'cracked') {
		// Jagged, broken frame for Ember
		drawCrackedFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'crystalline') {
		// Hexagonal, geometric frame for Frost
		drawCrystallineFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'organic') {
		// Vine-like flowing frame for Verdant/Fairy
		drawOrganicFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'dissolving') {
		// Fading, misty frame for Shadow
		drawDissolvingFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'radiant') {
		// Rays of light frame for Radiant
		drawRadiantFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'spiked') {
		// Thorny, aggressive frame for Crimson
		drawSpikedFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'warped') {
		// Distorted, eldritch frame for Void
		drawWarpedFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'stitched') {
		// Leather stitching frame for Parchment
		drawStitchedFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'ruled') {
		// Measurement tick marks for Cartographer
		drawRuledFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'gilded') {
		// Gold leaf ornate border for Merchant
		drawGildedFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else if (style.frame.type === 'carved') {
		// Weathered stone carved edges for Ancient
		drawCarvedFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	} else {
		// Default double-line frame for Arcane
		drawDoubleLineFrame(ctx, width, height, frameColor, frameColorFade, thickness);
	}
}

function drawDoubleLineFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	// Left and right vertical lines
	const vertGrad = ctx.createLinearGradient(0, 40, 0, height - 40);
	vertGrad.addColorStop(0, 'transparent');
	vertGrad.addColorStop(0.2, colorFade);
	vertGrad.addColorStop(0.5, color);
	vertGrad.addColorStop(0.8, colorFade);
	vertGrad.addColorStop(1, 'transparent');

	ctx.fillStyle = vertGrad;
	ctx.fillRect(24, 40, thickness, height - 80);
	ctx.fillRect(width - 27, 40, thickness, height - 80);

	// Top and bottom horizontal lines
	const horizGrad = ctx.createLinearGradient(40, 0, width - 40, 0);
	horizGrad.addColorStop(0, 'transparent');
	horizGrad.addColorStop(0.2, colorFade);
	horizGrad.addColorStop(0.5, color);
	horizGrad.addColorStop(0.8, colorFade);
	horizGrad.addColorStop(1, 'transparent');

	ctx.fillStyle = horizGrad;
	ctx.fillRect(40, 20, width - 80, Math.max(2, thickness - 1));
	ctx.fillRect(40, height - 22, width - 80, Math.max(2, thickness - 1));
}

function drawCrackedFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;
	ctx.lineCap = 'round';

	// Left side - jagged cracks
	ctx.beginPath();
	ctx.moveTo(26, 50);
	ctx.lineTo(28, 90);
	ctx.lineTo(24, 130);
	ctx.lineTo(27, 170);
	ctx.lineTo(23, 210);
	ctx.lineTo(26, 260);
	ctx.lineTo(24, 300);
	ctx.lineTo(27, 350);
	ctx.lineTo(25, 390);
	ctx.stroke();

	// Right side - jagged cracks
	ctx.beginPath();
	ctx.moveTo(width - 26, 50);
	ctx.lineTo(width - 28, 95);
	ctx.lineTo(width - 24, 140);
	ctx.lineTo(width - 27, 185);
	ctx.lineTo(width - 23, 230);
	ctx.lineTo(width - 26, 275);
	ctx.lineTo(width - 24, 320);
	ctx.lineTo(width - 27, 365);
	ctx.lineTo(width - 25, 390);
	ctx.stroke();

	// Top - broken segments
	ctx.beginPath();
	ctx.moveTo(50, 22);
	ctx.lineTo(150, 20);
	ctx.moveTo(180, 23);
	ctx.lineTo(280, 19);
	ctx.moveTo(320, 22);
	ctx.lineTo(420, 20);
	ctx.moveTo(450, 21);
	ctx.lineTo(width - 50, 22);
	ctx.stroke();

	// Bottom - broken segments
	ctx.beginPath();
	ctx.moveTo(50, height - 22);
	ctx.lineTo(140, height - 20);
	ctx.moveTo(170, height - 23);
	ctx.lineTo(260, height - 19);
	ctx.moveTo(300, height - 22);
	ctx.lineTo(400, height - 20);
	ctx.moveTo(430, height - 21);
	ctx.lineTo(width - 50, height - 22);
	ctx.stroke();

	ctx.restore();
}

function drawCrystallineFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'bevel';

	// Left side - hexagonal segments
	ctx.beginPath();
	ctx.moveTo(26, 40);
	ctx.lineTo(30, 80);
	ctx.lineTo(22, 120);
	ctx.lineTo(30, 160);
	ctx.lineTo(22, 200);
	ctx.lineTo(30, 240);
	ctx.lineTo(22, 280);
	ctx.lineTo(30, 320);
	ctx.lineTo(22, 360);
	ctx.lineTo(26, 400);
	ctx.stroke();

	// Right side - hexagonal segments
	ctx.beginPath();
	ctx.moveTo(width - 26, 40);
	ctx.lineTo(width - 30, 80);
	ctx.lineTo(width - 22, 120);
	ctx.lineTo(width - 30, 160);
	ctx.lineTo(width - 22, 200);
	ctx.lineTo(width - 30, 240);
	ctx.lineTo(width - 22, 280);
	ctx.lineTo(width - 30, 320);
	ctx.lineTo(width - 22, 360);
	ctx.lineTo(width - 26, 400);
	ctx.stroke();

	// Top - angled crystal segments
	const topGrad = ctx.createLinearGradient(40, 0, width - 40, 0);
	topGrad.addColorStop(0, 'transparent');
	topGrad.addColorStop(0.15, colorFade);
	topGrad.addColorStop(0.5, color);
	topGrad.addColorStop(0.85, colorFade);
	topGrad.addColorStop(1, 'transparent');
	ctx.strokeStyle = topGrad;
	ctx.beginPath();
	ctx.moveTo(50, 22);
	ctx.lineTo(150, 18);
	ctx.lineTo(250, 22);
	ctx.lineTo(350, 18);
	ctx.lineTo(450, 22);
	ctx.lineTo(width - 50, 20);
	ctx.stroke();

	// Bottom - angled crystal segments
	ctx.strokeStyle = topGrad;
	ctx.beginPath();
	ctx.moveTo(50, height - 22);
	ctx.lineTo(150, height - 18);
	ctx.lineTo(250, height - 22);
	ctx.lineTo(350, height - 18);
	ctx.lineTo(450, height - 22);
	ctx.lineTo(width - 50, height - 20);
	ctx.stroke();

	ctx.restore();
}

function drawOrganicFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;
	ctx.lineCap = 'round';

	// Left side - flowing vine curve
	ctx.beginPath();
	ctx.moveTo(26, 50);
	ctx.bezierCurveTo(22, 100, 30, 150, 24, 200);
	ctx.bezierCurveTo(28, 250, 22, 300, 26, 350);
	ctx.bezierCurveTo(24, 370, 26, 385, 25, 395);
	ctx.stroke();

	// Right side - flowing vine curve
	ctx.beginPath();
	ctx.moveTo(width - 26, 50);
	ctx.bezierCurveTo(width - 22, 100, width - 30, 150, width - 24, 200);
	ctx.bezierCurveTo(width - 28, 250, width - 22, 300, width - 26, 350);
	ctx.bezierCurveTo(width - 24, 370, width - 26, 385, width - 25, 395);
	ctx.stroke();

	// Top - gentle arc
	const topGrad = ctx.createLinearGradient(40, 0, width - 40, 0);
	topGrad.addColorStop(0, 'transparent');
	topGrad.addColorStop(0.2, colorFade);
	topGrad.addColorStop(0.5, color);
	topGrad.addColorStop(0.8, colorFade);
	topGrad.addColorStop(1, 'transparent');
	ctx.strokeStyle = topGrad;
	ctx.beginPath();
	ctx.moveTo(50, 22);
	ctx.quadraticCurveTo(width / 2, 16, width - 50, 22);
	ctx.stroke();

	// Bottom - gentle arc
	ctx.beginPath();
	ctx.moveTo(50, height - 22);
	ctx.quadraticCurveTo(width / 2, height - 16, width - 50, height - 22);
	ctx.stroke();

	ctx.restore();
}

function drawDissolvingFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();

	// Fading, misty frame with varying opacity
	for (let i = 0; i < 20; i++) {
		const alpha = 0.1 + Math.random() * 0.4;
		ctx.fillStyle = hexToRgba(color.replace(/rgba?\([^)]+\)/, '').trim() || '#6b7280', alpha);

		// Left side fragments
		const ly = 40 + i * 18 + Math.random() * 10;
		const lw = 2 + Math.random() * 4;
		const lh = 8 + Math.random() * 12;
		ctx.fillRect(22 + Math.random() * 8, ly, lw, lh);

		// Right side fragments
		const ry = 40 + i * 18 + Math.random() * 10;
		const rw = 2 + Math.random() * 4;
		const rh = 8 + Math.random() * 12;
		ctx.fillRect(width - 28 + Math.random() * 6, ry, rw, rh);
	}

	// Top - fading dashes
	for (let i = 0; i < 15; i++) {
		const alpha = 0.15 + Math.random() * 0.35;
		ctx.fillStyle = hexToRgba(color.replace(/rgba?\([^)]+\)/, '').trim() || '#6b7280', alpha);
		const tx = 50 + i * 35 + Math.random() * 15;
		const tw = 15 + Math.random() * 20;
		ctx.fillRect(tx, 18 + Math.random() * 6, tw, thickness);
	}

	// Bottom - fading dashes
	for (let i = 0; i < 15; i++) {
		const alpha = 0.15 + Math.random() * 0.35;
		ctx.fillStyle = hexToRgba(color.replace(/rgba?\([^)]+\)/, '').trim() || '#6b7280', alpha);
		const bx = 50 + i * 35 + Math.random() * 15;
		const bw = 15 + Math.random() * 20;
		ctx.fillRect(bx, height - 22 + Math.random() * 4, bw, thickness);
	}

	ctx.restore();
}

function drawRadiantFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();

	// Main frame lines with glow
	ctx.shadowColor = color;
	ctx.shadowBlur = 12;
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;

	// Left line with glow
	const leftGrad = ctx.createLinearGradient(0, 40, 0, height - 40);
	leftGrad.addColorStop(0, 'transparent');
	leftGrad.addColorStop(0.2, colorFade);
	leftGrad.addColorStop(0.5, color);
	leftGrad.addColorStop(0.8, colorFade);
	leftGrad.addColorStop(1, 'transparent');
	ctx.strokeStyle = leftGrad;
	ctx.beginPath();
	ctx.moveTo(26, 40);
	ctx.lineTo(26, height - 40);
	ctx.stroke();

	// Right line with glow
	ctx.beginPath();
	ctx.moveTo(width - 26, 40);
	ctx.lineTo(width - 26, height - 40);
	ctx.stroke();

	// Top and bottom
	const horizGrad = ctx.createLinearGradient(40, 0, width - 40, 0);
	horizGrad.addColorStop(0, 'transparent');
	horizGrad.addColorStop(0.2, colorFade);
	horizGrad.addColorStop(0.5, color);
	horizGrad.addColorStop(0.8, colorFade);
	horizGrad.addColorStop(1, 'transparent');
	ctx.strokeStyle = horizGrad;

	ctx.beginPath();
	ctx.moveTo(40, 20);
	ctx.lineTo(width - 40, 20);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(40, height - 20);
	ctx.lineTo(width - 40, height - 20);
	ctx.stroke();

	// Light ray emanations from corners
	ctx.lineWidth = 1;
	ctx.shadowBlur = 6;
	for (let i = 0; i < 4; i++) {
		const angle = (i * Math.PI / 6) - Math.PI / 4;
		const len = 15 + i * 5;
		// Top-left rays
		ctx.beginPath();
		ctx.moveTo(28, 28);
		ctx.lineTo(28 + Math.cos(angle) * len, 28 + Math.sin(angle) * len);
		ctx.stroke();
		// Top-right rays
		ctx.beginPath();
		ctx.moveTo(width - 28, 28);
		ctx.lineTo(width - 28 - Math.cos(angle) * len, 28 + Math.sin(angle) * len);
		ctx.stroke();
	}

	ctx.restore();
}

function drawSpikedFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	ctx.lineWidth = thickness;

	// Left side with thorns
	ctx.beginPath();
	ctx.moveTo(26, 40);
	for (let y = 60; y < height - 60; y += 40) {
		ctx.lineTo(26, y);
		ctx.lineTo(16, y + 10); // Thorn pointing left
		ctx.lineTo(26, y + 20);
	}
	ctx.lineTo(26, height - 40);
	ctx.stroke();

	// Right side with thorns
	ctx.beginPath();
	ctx.moveTo(width - 26, 40);
	for (let y = 60; y < height - 60; y += 40) {
		ctx.lineTo(width - 26, y);
		ctx.lineTo(width - 16, y + 10); // Thorn pointing right
		ctx.lineTo(width - 26, y + 20);
	}
	ctx.lineTo(width - 26, height - 40);
	ctx.stroke();

	// Top with spikes
	ctx.beginPath();
	ctx.moveTo(50, 22);
	for (let x = 80; x < width - 80; x += 50) {
		ctx.lineTo(x, 22);
		ctx.lineTo(x + 15, 12); // Spike pointing up
		ctx.lineTo(x + 30, 22);
	}
	ctx.lineTo(width - 50, 22);
	ctx.stroke();

	// Bottom with spikes
	ctx.beginPath();
	ctx.moveTo(50, height - 22);
	for (let x = 80; x < width - 80; x += 50) {
		ctx.lineTo(x, height - 22);
		ctx.lineTo(x + 15, height - 12); // Spike pointing down
		ctx.lineTo(x + 30, height - 22);
	}
	ctx.lineTo(width - 50, height - 22);
	ctx.stroke();

	ctx.restore();
}

function drawWarpedFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;

	// Left side - warped wave
	ctx.beginPath();
	ctx.moveTo(26, 40);
	for (let y = 40; y < height - 40; y += 5) {
		const warp = Math.sin(y * 0.05) * 6 + Math.sin(y * 0.02) * 3;
		ctx.lineTo(26 + warp, y);
	}
	ctx.stroke();

	// Right side - warped wave (inverse)
	ctx.beginPath();
	ctx.moveTo(width - 26, 40);
	for (let y = 40; y < height - 40; y += 5) {
		const warp = Math.sin(y * 0.05 + Math.PI) * 6 + Math.sin(y * 0.02 + Math.PI) * 3;
		ctx.lineTo(width - 26 + warp, y);
	}
	ctx.stroke();

	// Top - impossible geometry illusion
	const topGrad = ctx.createLinearGradient(40, 0, width - 40, 0);
	topGrad.addColorStop(0, 'transparent');
	topGrad.addColorStop(0.2, colorFade);
	topGrad.addColorStop(0.5, color);
	topGrad.addColorStop(0.8, colorFade);
	topGrad.addColorStop(1, 'transparent');
	ctx.strokeStyle = topGrad;
	ctx.beginPath();
	ctx.moveTo(50, 22);
	for (let x = 50; x < width - 50; x += 5) {
		const warp = Math.sin(x * 0.03) * 4;
		ctx.lineTo(x, 20 + warp);
	}
	ctx.stroke();

	// Bottom - impossible geometry illusion
	ctx.beginPath();
	ctx.moveTo(50, height - 22);
	for (let x = 50; x < width - 50; x += 5) {
		const warp = Math.sin(x * 0.03 + Math.PI) * 4;
		ctx.lineTo(x, height - 20 + warp);
	}
	ctx.stroke();

	ctx.restore();
}

function drawStitchedFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;
	ctx.setLineDash([8, 6]);
	ctx.lineCap = 'round';

	// Left side - stitching
	ctx.beginPath();
	ctx.moveTo(26, 35);
	ctx.lineTo(26, height - 35);
	ctx.stroke();

	// Right side - stitching
	ctx.beginPath();
	ctx.moveTo(width - 26, 35);
	ctx.lineTo(width - 26, height - 35);
	ctx.stroke();

	// Top - stitching
	ctx.beginPath();
	ctx.moveTo(40, 20);
	ctx.lineTo(width - 40, 20);
	ctx.stroke();

	// Bottom - stitching
	ctx.beginPath();
	ctx.moveTo(40, height - 20);
	ctx.lineTo(width - 40, height - 20);
	ctx.stroke();

	// Cross-stitches at intervals
	ctx.setLineDash([]);
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = colorFade;
	for (let y = 60; y < height - 60; y += 50) {
		// Left cross-stitch
		ctx.beginPath();
		ctx.moveTo(22, y - 4);
		ctx.lineTo(30, y + 4);
		ctx.moveTo(22, y + 4);
		ctx.lineTo(30, y - 4);
		ctx.stroke();
		// Right cross-stitch
		ctx.beginPath();
		ctx.moveTo(width - 22, y - 4);
		ctx.lineTo(width - 30, y + 4);
		ctx.moveTo(width - 22, y + 4);
		ctx.lineTo(width - 30, y - 4);
		ctx.stroke();
	}

	ctx.restore();
}

function drawRuledFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;

	// Main frame lines
	const vertGrad = ctx.createLinearGradient(0, 40, 0, height - 40);
	vertGrad.addColorStop(0, 'transparent');
	vertGrad.addColorStop(0.15, colorFade);
	vertGrad.addColorStop(0.5, color);
	vertGrad.addColorStop(0.85, colorFade);
	vertGrad.addColorStop(1, 'transparent');

	ctx.strokeStyle = vertGrad;
	ctx.beginPath();
	ctx.moveTo(26, 40);
	ctx.lineTo(26, height - 40);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(width - 26, 40);
	ctx.lineTo(width - 26, height - 40);
	ctx.stroke();

	// Tick marks - measurement lines
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;
	for (let y = 50; y < height - 50; y += 20) {
		const tickLen = y % 60 === 50 ? 8 : 4;
		// Left ticks
		ctx.beginPath();
		ctx.moveTo(26, y);
		ctx.lineTo(26 + tickLen, y);
		ctx.stroke();
		// Right ticks
		ctx.beginPath();
		ctx.moveTo(width - 26, y);
		ctx.lineTo(width - 26 - tickLen, y);
		ctx.stroke();
	}

	// Top and bottom lines with ticks
	const horizGrad = ctx.createLinearGradient(40, 0, width - 40, 0);
	horizGrad.addColorStop(0, 'transparent');
	horizGrad.addColorStop(0.15, colorFade);
	horizGrad.addColorStop(0.5, color);
	horizGrad.addColorStop(0.85, colorFade);
	horizGrad.addColorStop(1, 'transparent');

	ctx.strokeStyle = horizGrad;
	ctx.lineWidth = thickness;
	ctx.beginPath();
	ctx.moveTo(40, 20);
	ctx.lineTo(width - 40, 20);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(40, height - 20);
	ctx.lineTo(width - 40, height - 20);
	ctx.stroke();

	// Top/bottom ticks
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;
	for (let x = 60; x < width - 60; x += 30) {
		const tickLen = x % 90 === 60 ? 6 : 3;
		ctx.beginPath();
		ctx.moveTo(x, 20);
		ctx.lineTo(x, 20 + tickLen);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x, height - 20);
		ctx.lineTo(x, height - 20 - tickLen);
		ctx.stroke();
	}

	ctx.restore();
}

function drawGildedFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();

	// Outer gold line
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness + 1;
	ctx.beginPath();
	roundRect(ctx, 18, 14, width - 36, height - 28, 3);
	ctx.stroke();

	// Inner lighter line
	ctx.strokeStyle = colorFade;
	ctx.lineWidth = 1;
	ctx.beginPath();
	roundRect(ctx, 22, 18, width - 44, height - 36, 2);
	ctx.stroke();

	// Gold leaf shimmer effect - small rectangles along edges
	ctx.fillStyle = color;
	ctx.globalAlpha = 0.4;
	for (let i = 0; i < 8; i++) {
		const y = 40 + i * 45 + Math.random() * 10;
		// Left side accents
		ctx.fillRect(19, y, 4, 12);
		// Right side accents
		ctx.fillRect(width - 23, y + 20, 4, 12);
	}

	// Top/bottom gold accents
	for (let i = 0; i < 6; i++) {
		const x = 60 + i * 80 + Math.random() * 20;
		ctx.fillRect(x, 15, 15, 3);
		ctx.fillRect(x + 30, height - 18, 15, 3);
	}

	ctx.globalAlpha = 1;
	ctx.restore();
}

function drawCarvedFrame(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, colorFade: string, thickness: number) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = thickness;

	// Irregular stone-carved edges
	ctx.beginPath();
	// Left side - rough hewn
	ctx.moveTo(26, 35);
	for (let y = 35; y < height - 35; y += 15) {
		const offset = (Math.random() - 0.5) * 4;
		ctx.lineTo(26 + offset, y);
	}
	ctx.lineTo(26, height - 35);
	ctx.stroke();

	// Right side - rough hewn
	ctx.beginPath();
	ctx.moveTo(width - 26, 35);
	for (let y = 35; y < height - 35; y += 15) {
		const offset = (Math.random() - 0.5) * 4;
		ctx.lineTo(width - 26 + offset, y);
	}
	ctx.lineTo(width - 26, height - 35);
	ctx.stroke();

	// Top - weathered stone
	ctx.beginPath();
	ctx.moveTo(40, 20);
	for (let x = 40; x < width - 40; x += 20) {
		const offset = (Math.random() - 0.5) * 3;
		ctx.lineTo(x, 20 + offset);
	}
	ctx.lineTo(width - 40, 20);
	ctx.stroke();

	// Bottom - weathered stone
	ctx.beginPath();
	ctx.moveTo(40, height - 20);
	for (let x = 40; x < width - 40; x += 20) {
		const offset = (Math.random() - 0.5) * 3;
		ctx.lineTo(x, height - 20 + offset);
	}
	ctx.lineTo(width - 40, height - 20);
	ctx.stroke();

	// Chip marks / weathering spots
	ctx.fillStyle = colorFade;
	ctx.globalAlpha = 0.3;
	for (let i = 0; i < 6; i++) {
		const x = 22 + Math.random() * 6;
		const y = 50 + i * 60 + Math.random() * 30;
		ctx.fillRect(x, y, 3 + Math.random() * 4, 2 + Math.random() * 3);
	}
	for (let i = 0; i < 6; i++) {
		const x = width - 28 + Math.random() * 6;
		const y = 60 + i * 55 + Math.random() * 25;
		ctx.fillRect(x, y, 3 + Math.random() * 4, 2 + Math.random() * 3);
	}

	ctx.globalAlpha = 1;
	ctx.restore();
}

/**
 * Draw corner ornaments based on style
 */
function drawCorners(ctx: CanvasRenderingContext2D, width: number, height: number, style: CardStyleDefinition) {
	const cornerColor = style.frame.color;
	const cornerStyle = style.frame.cornerStyle;

	ctx.save();
	ctx.fillStyle = cornerColor;
	ctx.strokeStyle = cornerColor;

	if (cornerStyle === 'jagged') {
		// Jagged/broken corner pieces for Ember
		drawJaggedCorners(ctx, width, height, cornerColor);
	} else if (cornerStyle === 'hexagonal') {
		// Hexagonal corners for Frost
		drawHexagonalCorners(ctx, width, height, cornerColor);
	} else if (cornerStyle === 'vine') {
		// Curling vine corners for Verdant/Fairy
		drawVineCorners(ctx, width, height, cornerColor);
	} else if (cornerStyle === 'mist') {
		// Fading mist corners for Shadow
		drawMistCorners(ctx, width, height, cornerColor);
	} else if (cornerStyle === 'rays') {
		// Light ray corners for Radiant
		drawRayCorners(ctx, width, height, cornerColor);
	} else if (cornerStyle === 'thorns') {
		// Thorny corners for Crimson
		drawThornCorners(ctx, width, height, cornerColor);
	} else if (cornerStyle === 'impossible') {
		// Impossible geometry corners for Void
		drawImpossibleCorners(ctx, width, height, cornerColor);
	} else if (cornerStyle === 'brass-clasp') {
		// Brass clasps for Parchment
		drawBrassClaspCorners(ctx, width, height, cornerColor, style.frame.secondaryColor);
	} else if (cornerStyle === 'compass') {
		// Compass rose corners for Cartographer
		drawCompassCorners(ctx, width, height, cornerColor, style.frame.secondaryColor);
	} else if (cornerStyle === 'medallion') {
		// Coin/medallion corners for Merchant
		drawMedallionCorners(ctx, width, height, cornerColor, style.frame.secondaryColor);
	} else if (cornerStyle === 'rune-mark') {
		// Ancient rune marks for Ancient
		drawRuneMarkCorners(ctx, width, height, cornerColor, style.frame.secondaryColor);
	} else {
		// Default flourish corners for Arcane
		drawFlourishCorners(ctx, width, height, cornerColor);
	}

	ctx.restore();
}

function drawFlourishCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
	ctx.fillStyle = color;

	// Top-left
	ctx.fillRect(20, 16, 12, 2);
	ctx.fillRect(20, 16, 2, 12);

	// Top-right
	ctx.fillRect(width - 32, 16, 12, 2);
	ctx.fillRect(width - 22, 16, 2, 12);

	// Bottom-left
	ctx.fillRect(20, height - 18, 12, 2);
	ctx.fillRect(20, height - 28, 2, 12);

	// Bottom-right
	ctx.fillRect(width - 32, height - 18, 12, 2);
	ctx.fillRect(width - 22, height - 28, 2, 12);
}

function drawJaggedCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;

	// Top-left - broken/jagged
	ctx.beginPath();
	ctx.moveTo(18, 16);
	ctx.lineTo(24, 18);
	ctx.lineTo(30, 15);
	ctx.moveTo(18, 16);
	ctx.lineTo(20, 22);
	ctx.lineTo(17, 28);
	ctx.stroke();

	// Top-right
	ctx.beginPath();
	ctx.moveTo(width - 18, 16);
	ctx.lineTo(width - 24, 18);
	ctx.lineTo(width - 30, 15);
	ctx.moveTo(width - 18, 16);
	ctx.lineTo(width - 20, 22);
	ctx.lineTo(width - 17, 28);
	ctx.stroke();

	// Bottom-left
	ctx.beginPath();
	ctx.moveTo(18, height - 16);
	ctx.lineTo(24, height - 18);
	ctx.lineTo(30, height - 15);
	ctx.moveTo(18, height - 16);
	ctx.lineTo(20, height - 22);
	ctx.lineTo(17, height - 28);
	ctx.stroke();

	// Bottom-right
	ctx.beginPath();
	ctx.moveTo(width - 18, height - 16);
	ctx.lineTo(width - 24, height - 18);
	ctx.lineTo(width - 30, height - 15);
	ctx.moveTo(width - 18, height - 16);
	ctx.lineTo(width - 20, height - 22);
	ctx.lineTo(width - 17, height - 28);
	ctx.stroke();
}

function drawHexagonalCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;

	// Hexagonal shapes at corners
	function drawHex(cx: number, cy: number, size: number) {
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i - Math.PI / 6;
			const x = cx + Math.cos(angle) * size;
			const y = cy + Math.sin(angle) * size;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.stroke();
	}

	drawHex(26, 22, 8);
	drawHex(width - 26, 22, 8);
	drawHex(26, height - 22, 8);
	drawHex(width - 26, height - 22, 8);
}

function drawVineCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.lineCap = 'round';

	// Top-left vine curl
	ctx.beginPath();
	ctx.moveTo(35, 16);
	ctx.quadraticCurveTo(20, 16, 20, 30);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(25, 22, 4, 0, Math.PI * 1.5);
	ctx.stroke();

	// Top-right vine curl
	ctx.beginPath();
	ctx.moveTo(width - 35, 16);
	ctx.quadraticCurveTo(width - 20, 16, width - 20, 30);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(width - 25, 22, 4, Math.PI * 0.5, Math.PI * 2);
	ctx.stroke();

	// Bottom-left vine curl
	ctx.beginPath();
	ctx.moveTo(35, height - 16);
	ctx.quadraticCurveTo(20, height - 16, 20, height - 30);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(25, height - 22, 4, Math.PI * 0.5, Math.PI * 2);
	ctx.stroke();

	// Bottom-right vine curl
	ctx.beginPath();
	ctx.moveTo(width - 35, height - 16);
	ctx.quadraticCurveTo(width - 20, height - 16, width - 20, height - 30);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(width - 25, height - 22, 4, 0, Math.PI * 1.5);
	ctx.stroke();
}

function drawMistCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
	// Fading dots/particles at corners
	const positions = [
		{ cx: 26, cy: 22 },
		{ cx: width - 26, cy: 22 },
		{ cx: 26, cy: height - 22 },
		{ cx: width - 26, cy: height - 22 }
	];

	for (const pos of positions) {
		for (let i = 0; i < 5; i++) {
			const alpha = 0.2 + Math.random() * 0.4;
			ctx.fillStyle = hexToRgba(color.replace(/rgba?\([^)]+\)/, '').trim() || '#6b7280', alpha);
			const ox = (Math.random() - 0.5) * 20;
			const oy = (Math.random() - 0.5) * 20;
			const size = 2 + Math.random() * 3;
			ctx.beginPath();
			ctx.arc(pos.cx + ox, pos.cy + oy, size, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}

function drawRayCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.5;
	ctx.shadowColor = color;
	ctx.shadowBlur = 8;

	// Top-left rays
	for (let i = 0; i < 3; i++) {
		const angle = -Math.PI / 4 + (i * Math.PI / 8);
		ctx.beginPath();
		ctx.moveTo(22, 18);
		ctx.lineTo(22 + Math.cos(angle) * (12 + i * 4), 18 + Math.sin(angle) * (12 + i * 4));
		ctx.stroke();
	}

	// Top-right rays
	for (let i = 0; i < 3; i++) {
		const angle = -Math.PI * 3/4 - (i * Math.PI / 8);
		ctx.beginPath();
		ctx.moveTo(width - 22, 18);
		ctx.lineTo(width - 22 + Math.cos(angle) * (12 + i * 4), 18 + Math.sin(angle) * (12 + i * 4));
		ctx.stroke();
	}

	// Bottom corners similar
	ctx.shadowBlur = 0;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(22, height - 18, 3, 0, Math.PI * 2);
	ctx.arc(width - 22, height - 18, 3, 0, Math.PI * 2);
	ctx.fill();
}

function drawThornCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
	ctx.fillStyle = color;

	// Top-left thorns
	ctx.beginPath();
	ctx.moveTo(18, 24);
	ctx.lineTo(12, 16);
	ctx.lineTo(22, 20);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(24, 18);
	ctx.lineTo(16, 12);
	ctx.lineTo(20, 22);
	ctx.closePath();
	ctx.fill();

	// Top-right thorns
	ctx.beginPath();
	ctx.moveTo(width - 18, 24);
	ctx.lineTo(width - 12, 16);
	ctx.lineTo(width - 22, 20);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(width - 24, 18);
	ctx.lineTo(width - 16, 12);
	ctx.lineTo(width - 20, 22);
	ctx.closePath();
	ctx.fill();

	// Bottom corners
	ctx.beginPath();
	ctx.moveTo(18, height - 24);
	ctx.lineTo(12, height - 16);
	ctx.lineTo(22, height - 20);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(width - 18, height - 24);
	ctx.lineTo(width - 12, height - 16);
	ctx.lineTo(width - 22, height - 20);
	ctx.closePath();
	ctx.fill();
}

function drawImpossibleCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;

	// Penrose-like impossible triangles
	function drawImpossibleTriangle(cx: number, cy: number, size: number, rotation: number) {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(rotation);
		ctx.beginPath();
		// Outer triangle
		ctx.moveTo(0, -size);
		ctx.lineTo(size * 0.866, size * 0.5);
		ctx.lineTo(-size * 0.866, size * 0.5);
		ctx.closePath();
		ctx.stroke();
		// Inner overlapping lines for impossible effect
		ctx.beginPath();
		ctx.moveTo(0, -size * 0.4);
		ctx.lineTo(size * 0.35, size * 0.2);
		ctx.lineTo(-size * 0.35, size * 0.2);
		ctx.closePath();
		ctx.stroke();
		ctx.restore();
	}

	drawImpossibleTriangle(24, 22, 10, 0);
	drawImpossibleTriangle(width - 24, 22, 10, Math.PI);
	drawImpossibleTriangle(24, height - 22, 10, Math.PI);
	drawImpossibleTriangle(width - 24, height - 22, 10, 0);
}

function drawBrassClaspCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, secondaryColor?: string) {
	const brass = secondaryColor || '#c9a86c';
	const dark = color;

	function drawClasp(cx: number, cy: number, rotation: number) {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(rotation);

		// Outer brass ring
		ctx.strokeStyle = brass;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(0, 0, 10, 0, Math.PI * 2);
		ctx.stroke();

		// Inner dark ring
		ctx.strokeStyle = dark;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(0, 0, 6, 0, Math.PI * 2);
		ctx.stroke();

		// Center rivet
		ctx.fillStyle = brass;
		ctx.beginPath();
		ctx.arc(0, 0, 3, 0, Math.PI * 2);
		ctx.fill();

		// Clasp arms extending outward
		ctx.strokeStyle = dark;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(-10, -10);
		ctx.lineTo(-4, -4);
		ctx.moveTo(10, -10);
		ctx.lineTo(4, -4);
		ctx.stroke();

		ctx.restore();
	}

	drawClasp(24, 22, 0);
	drawClasp(width - 24, 22, Math.PI / 2);
	drawClasp(24, height - 22, -Math.PI / 2);
	drawClasp(width - 24, height - 22, Math.PI);
}

function drawCompassCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, secondaryColor?: string) {
	const teal = color;
	const accent = secondaryColor || '#e8dcc4';

	function drawCompass(cx: number, cy: number) {
		ctx.save();
		ctx.translate(cx, cy);

		// Outer circle
		ctx.strokeStyle = teal;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(0, 0, 12, 0, Math.PI * 2);
		ctx.stroke();

		// Cardinal points
		ctx.fillStyle = teal;
		const points = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
		for (const angle of points) {
			ctx.beginPath();
			ctx.moveTo(Math.cos(angle) * 6, Math.sin(angle) * 6);
			ctx.lineTo(Math.cos(angle - 0.3) * 12, Math.sin(angle - 0.3) * 12);
			ctx.lineTo(Math.cos(angle) * 14, Math.sin(angle) * 14);
			ctx.lineTo(Math.cos(angle + 0.3) * 12, Math.sin(angle + 0.3) * 12);
			ctx.closePath();
			ctx.fill();
		}

		// Center dot
		ctx.fillStyle = accent;
		ctx.beginPath();
		ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
	}

	drawCompass(24, 22);
	drawCompass(width - 24, 22);
	drawCompass(24, height - 22);
	drawCompass(width - 24, height - 22);
}

function drawMedallionCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, secondaryColor?: string) {
	const gold = secondaryColor || '#d4a84b';
	const dark = color;

	function drawMedallion(cx: number, cy: number) {
		ctx.save();
		ctx.translate(cx, cy);

		// Outer ornate ring with notches
		ctx.strokeStyle = gold;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(0, 0, 11, 0, Math.PI * 2);
		ctx.stroke();

		// Scalloped edge (coin-like)
		ctx.fillStyle = gold;
		for (let i = 0; i < 12; i++) {
			const angle = (i / 12) * Math.PI * 2;
			ctx.beginPath();
			ctx.arc(Math.cos(angle) * 11, Math.sin(angle) * 11, 2, 0, Math.PI * 2);
			ctx.fill();
		}

		// Inner circle
		ctx.strokeStyle = dark;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(0, 0, 7, 0, Math.PI * 2);
		ctx.stroke();

		// Center emblem (stylized G for gold/guild)
		ctx.fillStyle = gold;
		ctx.font = 'bold 10px serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('⚜', 0, 0);

		ctx.restore();
	}

	drawMedallion(24, 22);
	drawMedallion(width - 24, 22);
	drawMedallion(24, height - 22);
	drawMedallion(width - 24, height - 22);
}

function drawRuneMarkCorners(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, secondaryColor?: string) {
	const bronze = color;
	const glow = secondaryColor || '#d4a574';

	function drawRune(cx: number, cy: number, runeIndex: number) {
		ctx.save();
		ctx.translate(cx, cy);

		// Glow effect
		ctx.shadowColor = glow;
		ctx.shadowBlur = 6;

		ctx.strokeStyle = bronze;
		ctx.lineWidth = 2;
		ctx.lineCap = 'round';

		// Different rune shapes for each corner
		ctx.beginPath();
		switch (runeIndex) {
			case 0: // Vertical with branches (like Algiz)
				ctx.moveTo(0, -10);
				ctx.lineTo(0, 10);
				ctx.moveTo(0, -4);
				ctx.lineTo(-6, -10);
				ctx.moveTo(0, -4);
				ctx.lineTo(6, -10);
				break;
			case 1: // Diamond (like Ingwaz)
				ctx.moveTo(0, -10);
				ctx.lineTo(8, 0);
				ctx.lineTo(0, 10);
				ctx.lineTo(-8, 0);
				ctx.closePath();
				break;
			case 2: // Arrow up (like Tiwaz)
				ctx.moveTo(0, -10);
				ctx.lineTo(-8, 0);
				ctx.moveTo(0, -10);
				ctx.lineTo(8, 0);
				ctx.moveTo(0, -10);
				ctx.lineTo(0, 10);
				break;
			case 3: // X with center (like Gebo)
				ctx.moveTo(-8, -8);
				ctx.lineTo(8, 8);
				ctx.moveTo(8, -8);
				ctx.lineTo(-8, 8);
				break;
		}
		ctx.stroke();

		ctx.shadowBlur = 0;
		ctx.restore();
	}

	drawRune(24, 22, 0);
	drawRune(width - 24, 22, 1);
	drawRune(24, height - 22, 2);
	drawRune(width - 24, height - 22, 3);
}

/**
 * Draw floating particles based on style
 */
function drawParticles(ctx: CanvasRenderingContext2D, width: number, height: number, style: CardStyleDefinition) {
	const particleType = style.particles.type;
	const particleColor = style.particles.color;
	const particleCount = style.particles.count;
	const [minSize, maxSize] = style.particles.size;
	const [minOpacity, maxOpacity] = style.particles.opacity;

	if (particleType === 'none') return;

	// Generate particle positions along edges
	const positions = generateParticlePositions(width, height, particleCount);

	ctx.save();

	if (particleType === 'embers') {
		drawEmberParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'snowflakes') {
		drawSnowflakeParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'leaves') {
		drawLeafParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'wisps') {
		drawWispParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'light-rays') {
		drawLightRayParticles(ctx, width, height, particleColor, particleCount, minOpacity, maxOpacity);
	} else if (particleType === 'blood-drops') {
		drawBloodDropParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'stars') {
		drawStarParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'sparkles') {
		drawSparkleParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'dust') {
		drawDustParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'seafoam') {
		drawSeafoamParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'goldleaf') {
		drawGoldleafParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else if (particleType === 'cinders') {
		drawCinderParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	} else {
		// Default: runes (glowing circles)
		drawRuneParticles(ctx, positions, particleColor, minSize, maxSize, minOpacity, maxOpacity);
	}

	ctx.restore();
}

function generateParticlePositions(width: number, height: number, count: number): { x: number; y: number }[] {
	const positions: { x: number; y: number }[] = [];
	// Distribute along edges
	for (let i = 0; i < count; i++) {
		const side = i % 4;
		const t = 0.15 + Math.random() * 0.7;
		switch (side) {
			case 0: // Left edge
				positions.push({ x: width * (0.06 + Math.random() * 0.08), y: height * t });
				break;
			case 1: // Right edge
				positions.push({ x: width * (0.86 + Math.random() * 0.08), y: height * t });
				break;
			case 2: // Top area
				positions.push({ x: width * t, y: height * (0.08 + Math.random() * 0.1) });
				break;
			case 3: // Bottom area
				positions.push({ x: width * t, y: height * (0.82 + Math.random() * 0.1) });
				break;
		}
	}
	return positions;
}

function drawRuneParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		// Glow
		const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4);
		glow.addColorStop(0, hexToRgba(color, opacity));
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 4, 0, Math.PI * 2);
		ctx.fill();

		// Core
		ctx.fillStyle = color;
		ctx.globalAlpha = opacity;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
}

function drawEmberParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		// Ember glow (orange-red gradient)
		const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 5);
		glow.addColorStop(0, hexToRgba('#ffffff', opacity * 0.8));
		glow.addColorStop(0.2, hexToRgba(color, opacity));
		glow.addColorStop(0.6, hexToRgba('#dc2626', opacity * 0.5));
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 5, 0, Math.PI * 2);
		ctx.fill();

		// Hot core
		ctx.fillStyle = '#fef3c7';
		ctx.globalAlpha = opacity;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
}

function drawSnowflakeParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate(Math.random() * Math.PI);
		ctx.strokeStyle = color;
		ctx.lineWidth = 1;
		ctx.globalAlpha = opacity;

		// Draw 6-pointed snowflake
		for (let i = 0; i < 6; i++) {
			ctx.rotate(Math.PI / 3);
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(0, size * 2);
			// Small branches
			ctx.moveTo(0, size);
			ctx.lineTo(size * 0.5, size * 1.3);
			ctx.moveTo(0, size);
			ctx.lineTo(-size * 0.5, size * 1.3);
			ctx.stroke();
		}

		// Center glow
		const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3);
		glow.addColorStop(0, hexToRgba(color, opacity * 0.5));
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(0, 0, size * 3, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
	}
}

function drawLeafParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate(Math.random() * Math.PI * 2);
		ctx.globalAlpha = opacity;
		ctx.fillStyle = color;

		// Draw leaf shape
		ctx.beginPath();
		ctx.moveTo(0, -size * 2);
		ctx.quadraticCurveTo(size * 1.5, 0, 0, size * 2);
		ctx.quadraticCurveTo(-size * 1.5, 0, 0, -size * 2);
		ctx.fill();

		// Leaf vein
		ctx.strokeStyle = hexToRgba('#000000', 0.2);
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.moveTo(0, -size * 1.8);
		ctx.lineTo(0, size * 1.8);
		ctx.stroke();

		// Glow
		const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3);
		glow.addColorStop(0, hexToRgba(color, opacity * 0.3));
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(0, 0, size * 3, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
	}
}

function drawWispParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		// Wispy, ghostly effect - multiple overlapping circles
		for (let i = 0; i < 3; i++) {
			const ox = (Math.random() - 0.5) * size * 2;
			const oy = (Math.random() - 0.5) * size * 2;
			const glow = ctx.createRadialGradient(p.x + ox, p.y + oy, 0, p.x + ox, p.y + oy, size * (3 - i));
			glow.addColorStop(0, hexToRgba(color, opacity * (0.4 - i * 0.1)));
			glow.addColorStop(1, 'transparent');
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(p.x + ox, p.y + oy, size * (3 - i), 0, Math.PI * 2);
			ctx.fill();
		}
	}
}

function drawLightRayParticles(ctx: CanvasRenderingContext2D, width: number, height: number, color: string, count: number, minOpacity: number, maxOpacity: number) {
	ctx.save();

	// Draw light rays from top corners
	for (let i = 0; i < count; i++) {
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);
		const isLeft = i % 2 === 0;
		const startX = isLeft ? 30 : width - 30;
		const angle = isLeft ? (Math.PI / 6 + Math.random() * Math.PI / 4) : (Math.PI * 3/4 + Math.random() * Math.PI / 4);
		const length = 80 + Math.random() * 120;

		const grad = ctx.createLinearGradient(
			startX, 30,
			startX + Math.cos(angle) * length, 30 + Math.sin(angle) * length
		);
		grad.addColorStop(0, hexToRgba(color, opacity));
		grad.addColorStop(1, 'transparent');

		ctx.strokeStyle = grad;
		ctx.lineWidth = 2 + Math.random() * 3;
		ctx.beginPath();
		ctx.moveTo(startX, 30);
		ctx.lineTo(startX + Math.cos(angle) * length, 30 + Math.sin(angle) * length);
		ctx.stroke();
	}

	ctx.restore();
}

function drawBloodDropParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.globalAlpha = opacity;
		ctx.fillStyle = color;

		// Teardrop/blood drop shape
		ctx.beginPath();
		ctx.moveTo(0, -size * 2);
		ctx.quadraticCurveTo(size * 1.2, size * 0.5, 0, size * 1.5);
		ctx.quadraticCurveTo(-size * 1.2, size * 0.5, 0, -size * 2);
		ctx.fill();

		// Drip trail
		ctx.fillStyle = hexToRgba(color, opacity * 0.5);
		ctx.beginPath();
		ctx.arc(0, size * 2.5, size * 0.4, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(0, size * 3.2, size * 0.25, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
	}
}

function drawStarParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		// Outer glow
		const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 6);
		glow.addColorStop(0, hexToRgba(color, opacity * 0.6));
		glow.addColorStop(0.3, hexToRgba(color, opacity * 0.3));
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 6, 0, Math.PI * 2);
		ctx.fill();

		// 4-point star shape
		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.fillStyle = color;
		ctx.globalAlpha = opacity;
		ctx.beginPath();
		for (let i = 0; i < 4; i++) {
			const angle = (Math.PI / 2) * i;
			const outerX = Math.cos(angle) * size * 2;
			const outerY = Math.sin(angle) * size * 2;
			const innerAngle = angle + Math.PI / 4;
			const innerX = Math.cos(innerAngle) * size * 0.5;
			const innerY = Math.sin(innerAngle) * size * 0.5;
			if (i === 0) ctx.moveTo(outerX, outerY);
			else ctx.lineTo(outerX, outerY);
			ctx.lineTo(innerX, innerY);
		}
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
}

function drawSparkleParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		// Multi-layered sparkle glow
		const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 5);
		glow.addColorStop(0, hexToRgba('#ffffff', opacity));
		glow.addColorStop(0.2, hexToRgba(color, opacity * 0.8));
		glow.addColorStop(0.5, hexToRgba(color, opacity * 0.4));
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 5, 0, Math.PI * 2);
		ctx.fill();

		// Cross sparkle lines
		ctx.strokeStyle = hexToRgba('#ffffff', opacity * 0.9);
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(p.x - size * 2, p.y);
		ctx.lineTo(p.x + size * 2, p.y);
		ctx.moveTo(p.x, p.y - size * 2);
		ctx.lineTo(p.x, p.y + size * 2);
		ctx.stroke();

		// Diagonal sparkle lines
		ctx.strokeStyle = hexToRgba(color, opacity * 0.7);
		ctx.beginPath();
		ctx.moveTo(p.x - size, p.y - size);
		ctx.lineTo(p.x + size, p.y + size);
		ctx.moveTo(p.x + size, p.y - size);
		ctx.lineTo(p.x - size, p.y + size);
		ctx.stroke();

		// Core dot
		ctx.fillStyle = '#ffffff';
		ctx.globalAlpha = opacity;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 0.4, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
}

function drawDustParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	// Floating dust motes - subtle, small, warm-toned
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		// Very subtle glow
		const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 2.5);
		glow.addColorStop(0, hexToRgba(color, opacity * 0.6));
		glow.addColorStop(0.5, hexToRgba(color, opacity * 0.2));
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 2.5, 0, Math.PI * 2);
		ctx.fill();

		// Core dust mote
		ctx.fillStyle = color;
		ctx.globalAlpha = opacity;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
}

function drawSeafoamParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	// Bubble-like seafoam particles
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		// Outer bubble ring
		ctx.strokeStyle = hexToRgba(color, opacity * 0.8);
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
		ctx.stroke();

		// Inner glow
		const glow = ctx.createRadialGradient(p.x - size * 0.3, p.y - size * 0.3, 0, p.x, p.y, size * 1.5);
		glow.addColorStop(0, hexToRgba('#ffffff', opacity * 0.4));
		glow.addColorStop(0.3, hexToRgba(color, opacity * 0.2));
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
		ctx.fill();

		// Highlight dot
		ctx.fillStyle = hexToRgba('#ffffff', opacity * 0.6);
		ctx.beginPath();
		ctx.arc(p.x - size * 0.4, p.y - size * 0.4, size * 0.3, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawGoldleafParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	// Shimmering gold leaf flakes
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);
		const rotation = Math.random() * Math.PI * 2;

		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate(rotation);

		// Golden shimmer glow
		ctx.shadowColor = color;
		ctx.shadowBlur = 8;

		// Irregular polygon shape for leaf flake
		ctx.fillStyle = hexToRgba(color, opacity);
		ctx.beginPath();
		ctx.moveTo(-size * 0.8, -size * 0.2);
		ctx.lineTo(-size * 0.2, -size * 0.9);
		ctx.lineTo(size * 0.7, -size * 0.4);
		ctx.lineTo(size * 0.9, size * 0.3);
		ctx.lineTo(size * 0.2, size * 0.8);
		ctx.lineTo(-size * 0.6, size * 0.5);
		ctx.closePath();
		ctx.fill();

		// Highlight edge
		ctx.strokeStyle = hexToRgba('#fffacd', opacity * 0.8);
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.moveTo(-size * 0.2, -size * 0.9);
		ctx.lineTo(size * 0.7, -size * 0.4);
		ctx.stroke();

		ctx.shadowBlur = 0;
		ctx.restore();
	}
}

function drawCinderParticles(ctx: CanvasRenderingContext2D, positions: { x: number; y: number }[], color: string, minSize: number, maxSize: number, minOpacity: number, maxOpacity: number) {
	// Glowing embers/cinders - like embers but more subdued amber tones
	for (const p of positions) {
		const size = minSize + Math.random() * (maxSize - minSize);
		const opacity = minOpacity + Math.random() * (maxOpacity - minOpacity);

		// Outer warm glow
		const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4);
		glow.addColorStop(0, hexToRgba(color, opacity * 0.7));
		glow.addColorStop(0.3, hexToRgba(color, opacity * 0.3));
		glow.addColorStop(0.6, hexToRgba('#8b4513', opacity * 0.15));
		glow.addColorStop(1, 'transparent');
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 4, 0, Math.PI * 2);
		ctx.fill();

		// Bright core
		ctx.fillStyle = hexToRgba('#ffa500', opacity * 0.9);
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 0.6, 0, Math.PI * 2);
		ctx.fill();

		// Hot center
		ctx.fillStyle = hexToRgba('#ffcc00', opacity);
		ctx.beginPath();
		ctx.arc(p.x, p.y, size * 0.3, 0, Math.PI * 2);
		ctx.fill();
	}
}

/**
 * Draw centered diamond
 */
function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(Math.PI / 4);
	ctx.fillStyle = color;
	ctx.fillRect(-size / 2, -size / 2, size, size);

	// Glow
	ctx.shadowColor = color;
	ctx.shadowBlur = 15;
	ctx.fillRect(-size / 2, -size / 2, size, size);
	ctx.restore();
}

function ellipsizeToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
	if (ctx.measureText(text).width <= maxWidth) return text;
	let working = text.trim();
	while (working.length > 0 && ctx.measureText(`${working}…`).width > maxWidth) {
		working = working.slice(0, -1).trimEnd();
	}
	return working.length ? `${working}…` : '…';
}

export async function generateEventCardPNG(
	event: StageEventCardRow,
	backgroundSettingsOverride?: EventCardBackgroundSettings
): Promise<Blob> {
	if (!event.id) {
		throw new Error('Event missing ID');
	}

	await loadOpsilonFont();

	const rewardRows = Array.isArray(event.reward_rows) ? (event.reward_rows as RewardRow[]) : [];
	const allPlayersRow =
		rewardRows.find((row) => row?.type === 'all_players') ??
		rewardRows.find((row) => Array.isArray(row?.icon_ids) && row.icon_ids.length > 0) ??
		null;
	const hasRewards = !!allPlayersRow && Array.isArray(allPlayersRow.icon_ids) && allPlayersRow.icon_ids.length > 0;
	const stageCompletionText = (event.stage_completion ?? '').trim();
	const hasStageCompletion = stageCompletionText.length > 0;

	if (hasRewards) {
		await loadIconPool();
	}

	const canvas = createCanvas(EVENT_CARD_WIDTH * EXPORT_SCALE, EVENT_CARD_HEIGHT * EXPORT_SCALE);
	const ctx = getContext(canvas);
	ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
	ctx.imageSmoothingEnabled = true;
	try {
		ctx.imageSmoothingQuality = 'high';
	} catch {
		// ignore
	}

	// Clip to rounded rect
	ctx.save();
	roundRect(ctx, 0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, 4);
	ctx.clip();

	// Base background - deep purple/indigo
	ctx.fillStyle = '#080610';
	ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	// Single background source (shared across all event cards)
	const backgroundSettings = backgroundSettingsOverride ?? readEventCardBackgroundSettings();

	// Get the event style definition (default arcane style for events)
	const eventStyleDef = getEventStyleDefinition('event_v6');

	// Global background image (optional)
	let bgImageUrl: string | null = null;
	if (backgroundSettings.mode === 'image') {
		if (backgroundSettings.image.source === 'storage') {
			bgImageUrl = publicAssetUrl(backgroundSettings.image.path, {
				bucket: backgroundSettings.image.bucket,
				updatedAt: backgroundSettings.image.version
			});
		} else {
			bgImageUrl = bustUrl(backgroundSettings.image.url, backgroundSettings.image.version);
		}
	}

	if (bgImageUrl) {
		try {
			const artImg = await loadImage(bgImageUrl);
			ctx.save();
			ctx.filter = 'saturate(45%) brightness(35%) contrast(120%)';
			ctx.globalAlpha = 0.85;
			drawImageCover(ctx, artImg, 0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);
			ctx.restore();
		} catch (err) {
			console.warn('Failed to load event background image:', err);
		}
	}

	// Shared background accents (same for all event cards)
	const accentA = hexToRgba(backgroundSettings.gradient.accentAHex, backgroundSettings.gradient.accentAAlpha);
	const bgAccentA = ctx.createRadialGradient(
		EVENT_CARD_WIDTH * 0.25,
		EVENT_CARD_HEIGHT * 0.2,
		0,
		EVENT_CARD_WIDTH * 0.25,
		EVENT_CARD_HEIGHT * 0.2,
		EVENT_CARD_WIDTH * 0.7
	);
	bgAccentA.addColorStop(0, accentA);
	bgAccentA.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = bgAccentA;
	ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	const accentB = hexToRgba(backgroundSettings.gradient.accentBHex, backgroundSettings.gradient.accentBAlpha);
	const bgAccentB = ctx.createRadialGradient(
		EVENT_CARD_WIDTH * 0.75,
		EVENT_CARD_HEIGHT * 0.7,
		0,
		EVENT_CARD_WIDTH * 0.75,
		EVENT_CARD_HEIGHT * 0.7,
		EVENT_CARD_WIDTH * 0.8
	);
	bgAccentB.addColorStop(0, accentB);
	bgAccentB.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = bgAccentB;
	ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	// Art overlay - radial vignette
	const vignetteGrad = ctx.createRadialGradient(
		EVENT_CARD_WIDTH / 2, EVENT_CARD_HEIGHT / 2, 0,
		EVENT_CARD_WIDTH / 2, EVENT_CARD_HEIGHT / 2, EVENT_CARD_WIDTH * 0.7
	);
	vignetteGrad.addColorStop(0, 'transparent');
	vignetteGrad.addColorStop(0.5, 'rgba(8, 6, 16, 0.6)');
	vignetteGrad.addColorStop(1, 'rgba(8, 6, 16, 0.95)');
	ctx.fillStyle = vignetteGrad;
	ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	// Top/bottom gradient accents
	const topGrad = ctx.createLinearGradient(0, 0, 0, EVENT_CARD_HEIGHT);
	topGrad.addColorStop(0, 'rgba(60, 40, 100, 0.1)');
	topGrad.addColorStop(0.3, 'transparent');
	topGrad.addColorStop(0.7, 'transparent');
	topGrad.addColorStop(1, 'rgba(60, 40, 100, 0.15)');
	ctx.fillStyle = topGrad;
	ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	// Draw frame elements (using event style)
	drawFrame(ctx, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, eventStyleDef);
	drawCorners(ctx, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, eventStyleDef);
	drawParticles(ctx, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, eventStyleDef);

	// Content area - centered
	const centerX = EVENT_CARD_WIDTH / 2;
	let yPos = 90;

	// Order number with decorative lines
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	// Order lines
	const orderLineWidth = 40;
	const orderLineY = yPos;
	const orderLineGradLeft = ctx.createLinearGradient(centerX - 60 - orderLineWidth, orderLineY, centerX - 60, orderLineY);
	orderLineGradLeft.addColorStop(0, 'transparent');
	orderLineGradLeft.addColorStop(1, 'rgba(167, 139, 250, 0.5)');
	ctx.fillStyle = orderLineGradLeft;
	ctx.fillRect(centerX - 60 - orderLineWidth, orderLineY - 0.5, orderLineWidth, 1);

	const orderLineGradRight = ctx.createLinearGradient(centerX + 60, orderLineY, centerX + 60 + orderLineWidth, orderLineY);
	orderLineGradRight.addColorStop(0, 'rgba(167, 139, 250, 0.5)');
	orderLineGradRight.addColorStop(1, 'transparent');
	ctx.fillStyle = orderLineGradRight;
	ctx.fillRect(centerX + 60, orderLineY - 0.5, orderLineWidth, 1);

	// Type badge text
	const typeBadgeText = eventTypeLabel(event.stage ?? DEFAULT_EVENT_TYPE).toUpperCase();
	let badgeFontSize = 18;
	const maxBadgeWidth = 140;
	while (badgeFontSize > 12) {
		ctx.font = `700 ${badgeFontSize}px Opsilon, serif`;
		if (ctx.measureText(typeBadgeText).width <= maxBadgeWidth) break;
		badgeFontSize -= 1;
	}
	ctx.fillStyle = '#a78bfa';
	ctx.save();
	ctx.shadowColor = 'rgba(167, 139, 250, 0.6)';
	ctx.shadowBlur = 20;
	ctx.fillText(typeBadgeText, centerX, yPos);
	ctx.restore();

	yPos += 40;

	// Title
	const eventTitle = event.title.toUpperCase();
	let titleFontSize = 36;
	const maxTitleWidth = EVENT_CARD_WIDTH - 120;

	ctx.fillStyle = '#ede9fe';
	while (titleFontSize > 20) {
		ctx.font = `800 ${titleFontSize}px Opsilon, serif`;
		if (ctx.measureText(eventTitle).width <= maxTitleWidth) break;
		titleFontSize -= 2;
	}

	// Word wrap title if needed
	const titleLines = wrapText(ctx, eventTitle, maxTitleWidth);

	ctx.save();
	ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
	ctx.shadowBlur = 30;
	for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
		ctx.fillText(titleLines[i], centerX, yPos + i * (titleFontSize + 4));
	}
	ctx.restore();

	yPos += titleLines.length * (titleFontSize + 4) + 10;

	// Decorative divider
	const dividerY = yPos;
	const wingWidth = 60;

	// Left wing
	const leftWingGrad = ctx.createLinearGradient(centerX - 60 - wingWidth, dividerY, centerX - 60, dividerY);
	leftWingGrad.addColorStop(0, 'transparent');
	leftWingGrad.addColorStop(1, 'rgba(139, 92, 246, 0.6)');
	ctx.fillStyle = leftWingGrad;
	ctx.fillRect(centerX - 60 - wingWidth, dividerY - 0.5, wingWidth, 1);

	// Right wing
	const rightWingGrad = ctx.createLinearGradient(centerX + 60, dividerY, centerX + 60 + wingWidth, dividerY);
	rightWingGrad.addColorStop(0, 'rgba(139, 92, 246, 0.6)');
	rightWingGrad.addColorStop(1, 'transparent');
	ctx.fillStyle = rightWingGrad;
	ctx.fillRect(centerX + 60, dividerY - 0.5, wingWidth, 1);

	// Center diamond
	drawDiamond(ctx, centerX, dividerY, 8, '#8b5cf6');

	yPos += 30;

	// Description
	const footerY = EVENT_CARD_HEIGHT - 35;

	const iconSize = 44;
	const iconGap = 6;
	const rewardDividerW = 280;
	const rewardDividerToRow = 10;
	const labelToIconsGap = 16;

	const completionBoxW = 520;
	const completionPaddingX = 12;
	const completionPaddingY = 8;
	const completionLabel = 'STAGE COMPLETION';
	const completionLabelFontSize = 11;
	const completionLabelLineHeight = 14;
	const completionTextFontSize = 13;
	const completionTextLineHeight = 16;
	const completionMaxTextWidth = completionBoxW - completionPaddingX * 2;

	let completionBoxTopY: number | null = null;
	let completionBoxHeight = 0;
	let completionLines: string[] = [];

	if (hasStageCompletion) {
		ctx.font = `600 ${completionTextFontSize}px Opsilon, serif`;
		const wrapped = wrapText(ctx, stageCompletionText, completionMaxTextWidth);
		completionLines = wrapped.slice(0, 2);
		completionBoxHeight =
			completionPaddingY +
			completionLabelLineHeight +
			4 +
			completionLines.length * completionTextLineHeight +
			completionPaddingY;
		const completionBottomY = footerY - 6;
		completionBoxTopY = completionBottomY - completionBoxHeight;
	}

	const rewardBottomY = completionBoxTopY !== null ? completionBoxTopY - 10 : footerY - 22;

	const iconUrls = hasRewards
		? allPlayersRow!.icon_ids
				.map((id) => getIconPoolUrl(id))
				.filter((u): u is string => typeof u === 'string' && u.length > 0)
		: [];

	// Rewards are anchored near the bottom so the body text gets maximum room.
	// Horizontal layout: label on left, icons on right (single row)
	let rewardDividerY: number | null = null;
	let rewardLabelText: string | null = null;
	let rewardLabelFontSize: number | null = null;
	let rewardRowY: number | null = null;
	let rewardIconSlots: Array<{ kind: 'img'; url: string } | { kind: 'more'; count: number }> = [];

	if (hasRewards) {
		rewardLabelText =
			allPlayersRow!.label?.trim() ||
			REWARD_ROW_CONFIG[allPlayersRow!.type as keyof typeof REWARD_ROW_CONFIG]?.label ||
			'ALL PLAYERS GAIN';

		// Horizontal layout: show as many icons as fit in one row
		const maxIconsInRow = 6; // Limit icons to keep row compact
		const needsOverflow = iconUrls.length > maxIconsInRow;
		const visibleIconCount = needsOverflow ? Math.max(0, maxIconsInRow - 1) : iconUrls.length;
		const remainingCount = needsOverflow ? iconUrls.length - visibleIconCount : 0;

		rewardIconSlots = iconUrls.slice(0, visibleIconCount).map((url) => ({ kind: 'img' as const, url }));
		if (remainingCount > 0) rewardIconSlots.push({ kind: 'more' as const, count: remainingCount });

		// Single row height
		rewardRowY = rewardBottomY - iconSize;

		// Choose label font size
		const labelFontSize = 12;
		ctx.font = `800 ${labelFontSize}px Opsilon, serif`;
		rewardLabelFontSize = labelFontSize;

		// Divider is above the reward row
		rewardDividerY = rewardRowY - rewardDividerToRow - 1;
	}

	if (event.description) {
		ctx.fillStyle = '#c4b5fd';

		const maxDescWidth = 420;

		const maxDescBottom =
			rewardDividerY !== null ? rewardDividerY - 12 : completionBoxTopY !== null ? completionBoxTopY - 12 : footerY - 22;
		const availableHeight = Math.max(0, maxDescBottom - yPos);

		// Best-effort: shrink font to fit the entire description into the available height.
		let chosenFontSize = 16;
		let chosenLineHeight = 26;
		let chosenLines: string[] = [];

		for (let fontSize = 16; fontSize >= 9; fontSize--) {
			ctx.font = `400 ${fontSize}px Opsilon, serif`;
			const lines = wrapText(ctx, event.description, maxDescWidth);
			const leading = fontSize >= 14 ? 1.65 : 1.55;
			const lineHeight = Math.round(fontSize * leading);
			const totalHeight = lines.length * lineHeight;

			if (totalHeight <= availableHeight) {
				chosenFontSize = fontSize;
				chosenLineHeight = lineHeight;
				chosenLines = lines;
				break;
			}

			// Fallback to smallest font if nothing fits fully.
			if (fontSize === 9) {
				chosenFontSize = fontSize;
				chosenLineHeight = lineHeight;
				chosenLines = lines;
			}
		}

		ctx.save();
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 8;
		ctx.shadowOffsetY = 2;

		ctx.font = `400 ${chosenFontSize}px Opsilon, serif`;
		const maxLines = chosenLineHeight > 0 ? Math.floor(availableHeight / chosenLineHeight) : 0;
		const willTruncate = chosenLines.length > maxLines && maxLines > 0;
		const linesToDraw = willTruncate ? chosenLines.slice(0, maxLines) : chosenLines;

		for (let i = 0; i < linesToDraw.length; i++) {
			const drawY = yPos + i * chosenLineHeight;
			const line =
				willTruncate && i === linesToDraw.length - 1
					? ellipsizeToWidth(ctx, linesToDraw[i], maxDescWidth)
					: linesToDraw[i];
			ctx.fillText(line, centerX, drawY);
		}
		ctx.restore();
	}

	// Rewards (anchored low, just above footer) - horizontal layout
	if (hasRewards && allPlayersRow && rewardDividerY !== null && rewardLabelText && rewardLabelFontSize && rewardRowY !== null) {
		// Divider
		const dividerGrad = ctx.createLinearGradient(
			centerX - rewardDividerW / 2,
			rewardDividerY,
			centerX + rewardDividerW / 2,
			rewardDividerY
		);
		dividerGrad.addColorStop(0, 'transparent');
		dividerGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.55)');
		dividerGrad.addColorStop(1, 'transparent');
		ctx.fillStyle = dividerGrad;
		ctx.fillRect(centerX - rewardDividerW / 2, rewardDividerY, rewardDividerW, 1);

		// Calculate horizontal layout: label on left, icons on right
		ctx.font = `800 ${rewardLabelFontSize}px Opsilon, serif`;
		const labelWidth = ctx.measureText(rewardLabelText.toUpperCase()).width;

		const iconsWidth = rewardIconSlots.length * iconSize + Math.max(0, rewardIconSlots.length - 1) * iconGap;
		const totalRowWidth = labelWidth + labelToIconsGap + iconsWidth;
		const rowStartX = centerX - totalRowWidth / 2;

		// Draw label on left, vertically centered with icons
		const labelX = rowStartX + labelWidth / 2;
		const labelY = rewardRowY + iconSize / 2;
		ctx.save();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = 'rgba(226, 232, 240, 0.88)';
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 10;
		ctx.fillText(rewardLabelText.toUpperCase(), labelX, labelY);
		ctx.restore();

		// Icons on right
		const urlsToDraw = rewardIconSlots
			.filter((slot): slot is { kind: 'img'; url: string } => slot.kind === 'img')
			.map((slot) => slot.url);

		const images = await Promise.all(
			urlsToDraw.map(async (url) => {
				try {
					return await loadImage(url);
				} catch {
					return null;
				}
			})
		);

		let x = rowStartX + labelWidth + labelToIconsGap;
		let drawIndex = 0;

		for (const slot of rewardIconSlots) {
			if (slot.kind === 'more') {
				ctx.save();
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.font = '800 16px Opsilon, serif';
				ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
				ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
				ctx.shadowBlur = 10;
				ctx.fillText(`+${slot.count}`, x + iconSize / 2, rewardRowY + iconSize / 2);
				ctx.restore();
			} else {
				const img = images[drawIndex++];
				if (img) {
					ctx.save();
					ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
					ctx.shadowBlur = 6;
					drawImageContain(ctx, img, x, rewardRowY, iconSize, iconSize);
					ctx.restore();
				} else {
					ctx.save();
					ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
					roundRect(ctx, x, rewardRowY, iconSize, iconSize, 8);
					ctx.fill();
					ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
					ctx.lineWidth = 1;
					roundRect(ctx, x + 0.5, rewardRowY + 0.5, iconSize - 1, iconSize - 1, 8);
					ctx.stroke();
					ctx.restore();
				}
			}
			x += iconSize + iconGap;
		}
	}

	// Stage completion (anchored at the bottom, below rewards)
	if (hasStageCompletion && completionBoxTopY !== null && completionBoxHeight > 0) {
		const completionBoxX = centerX - completionBoxW / 2;

		ctx.save();
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		roundRect(ctx, completionBoxX, completionBoxTopY, completionBoxW, completionBoxHeight, 10);
		ctx.fill();
		ctx.strokeStyle = 'rgba(139, 92, 246, 0.22)';
		ctx.lineWidth = 1;
		roundRect(ctx, completionBoxX, completionBoxTopY, completionBoxW, completionBoxHeight, 10);
		ctx.stroke();

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		let textY = completionBoxTopY + completionPaddingY + completionLabelLineHeight / 2;
		ctx.font = `800 ${completionLabelFontSize}px Opsilon, serif`;
		ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
		ctx.fillText(completionLabel, centerX, textY);

		textY += completionLabelLineHeight / 2 + 4 + completionTextLineHeight / 2;
		ctx.font = `600 ${completionTextFontSize}px Opsilon, serif`;
		ctx.fillStyle = '#ede9fe';
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 10;
		for (let i = 0; i < completionLines.length; i++) {
			ctx.fillText(completionLines[i], centerX, textY + i * completionTextLineHeight);
		}

		ctx.restore();
	}

	// Footer diamonds
	drawDiamond(ctx, centerX - 70, footerY, 5, 'rgba(139, 92, 246, 0.5)');
	drawDiamond(ctx, centerX + 70, footerY, 5, 'rgba(139, 92, 246, 0.5)');

	// Vignette overlay
	ctx.fillStyle = 'rgba(8, 6, 16, 0.3)';
	ctx.shadowColor = 'rgba(8, 6, 16, 1)';
	ctx.shadowBlur = 100;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 0;

	ctx.restore();

	// Card border
	ctx.strokeStyle = '#3b2d5c';
	ctx.lineWidth = 2;
	roundRect(ctx, 1, 1, EVENT_CARD_WIDTH - 2, EVENT_CARD_HEIGHT - 2, 4);
	ctx.stroke();

	// Corner glows
	const cornerGlow1 = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
	cornerGlow1.addColorStop(0, 'rgba(99, 70, 180, 0.15)');
	cornerGlow1.addColorStop(1, 'transparent');
	ctx.fillStyle = cornerGlow1;
	ctx.fillRect(0, 0, 80, 80);

	const cornerGlow2 = ctx.createRadialGradient(EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, 80);
	cornerGlow2.addColorStop(0, 'rgba(99, 70, 180, 0.15)');
	cornerGlow2.addColorStop(1, 'transparent');
	ctx.fillStyle = cornerGlow2;
	ctx.fillRect(EVENT_CARD_WIDTH - 80, EVENT_CARD_HEIGHT - 80, 80, 80);

	return canvasToBlob(canvas);
}

export async function generateEventLocationCardPNG(options: {
	locationImageUrl: string;
	title?: string | null;
	rewardRows?: GameLocationRewardRow[] | null;
	/** Optional style id stored on the stage_location card (defaults to readable). */
	renderStyle?: string | null;
}): Promise<Blob> {
	const locationImageUrl = (options.locationImageUrl ?? '').trim();
	if (!locationImageUrl) {
		throw new Error('Missing location image URL');
	}

	await loadOpsilonFont();

	const locationImg = await loadImage(locationImageUrl);
	const renderStyleKey = (options.renderStyle ?? 'stage_location_v6_arcane').trim() as StageLocationRenderStyle;
	const styleSettings = getStageLocationStyleSettings(renderStyleKey);
	const styleDef = getLocationStyleDefinition(renderStyleKey);

	const canvas = createCanvas(EVENT_CARD_WIDTH * EXPORT_SCALE, EVENT_CARD_HEIGHT * EXPORT_SCALE);
	const ctx = getContext(canvas);
	ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
	ctx.imageSmoothingEnabled = true;
	try {
		ctx.imageSmoothingQuality = 'high';
	} catch {
		// ignore
	}

	const footerY = EVENT_CARD_HEIGHT - 35;

	function rowHasAnyContent(row: GameLocationRewardRow): boolean {
		if (row.type === 'text') return String(row.text ?? '').trim().length > 0;
		if (row.type === 'trade') return row.cost_icon_ids.length > 0 || row.gain_icon_ids.length > 0;
		return row.gain_icon_ids.length > 0;
	}

	const rewardRows = Array.isArray(options.rewardRows) ? options.rewardRows.filter(rowHasAnyContent).slice(0, 3) : [];
	const rowCount = rewardRows.length;

	const textFontSize = rowCount <= 1 ? 16 : 14;
	const textLineH = rowCount <= 1 ? 20 : 18;
	const textMaxWidth = EVENT_CARD_WIDTH - 80;
	const renderStyle = (options.renderStyle ?? 'stage_location_v6_arcane').trim();
	const isDense = renderStyle === 'stage_location_v6_dense';
	const isPostcard = renderStyle === 'stage_location_v6_postcard';
	const isMinimal = renderStyle === 'stage_location_v6_minimal';
	const isDramatic = renderStyle === 'stage_location_v6_dramatic';
	const isElegant = renderStyle === 'stage_location_v6_elegant';
	const isBold = renderStyle === 'stage_location_v6_bold';
	const isCinematic = renderStyle === 'stage_location_v6_cinematic' || isPostcard || isMinimal || isDramatic;

	// Text line caps per style:
	// Dense: 6/3 (information-packed)
	// Postcard: 1/1 (scenic, minimal overlay)
	// Minimal: 2/1 (zen-like restraint)
	// Cinematic/Dramatic: 2/1 or 3/2 (high image emphasis)
	// Elegant: 3/2 (refined, balanced)
	// Bold: 4/2 (strong presence)
	// Readable (default): 4/2 (balanced)
	const textMaxLinesCap = isDense
		? rowCount <= 1
			? 6
			: 3
		: isPostcard
			? 1
			: isMinimal
				? rowCount <= 1
					? 2
					: 1
				: isDramatic
					? rowCount <= 1
						? 3
						: 2
					: isElegant
						? rowCount <= 1
							? 3
							: 2
						: isBold
							? rowCount <= 1
								? 4
								: 2
							: isCinematic
								? rowCount <= 1
									? 2
									: 1
								: rowCount <= 1
									? 4
									: 2;

	const artW = EVENT_CARD_WIDTH - 80;
	const artY = 72;

	type RewardLayoutRow =
		| {
				kind: 'trade' | 'gain';
				row: GameLocationRewardRow;
				height: number;
		  }
		| {
				kind: 'text';
				row: GameLocationRewardRow;
				height: number;
				text: {
					fontSize: number;
					lineH: number;
					maxLines: number;
					maxWidth: number;
					lines: string[];
					lineCount: number;
				};
		  };

	function buildRewardLayout(initialMaxLines = textMaxLinesCap): RewardLayoutRow[] {
		return rewardRows.map((rewardRow) => {
			if (rewardRow.type !== 'text') {
				return { kind: rewardRow.type, row: rewardRow, height: iconSize } as RewardLayoutRow;
			}

			const text = String(rewardRow.text ?? '').trim();
			ctx.font = `700 ${textFontSize}px Opsilon`;
			const lines = wrapText(ctx, text, textMaxWidth);
			const maxLines = Math.max(1, initialMaxLines);
			const lineCount = Math.max(1, Math.min(lines.length, maxLines));
			const height = Math.max(iconSize, lineCount * textLineH);

			return {
				kind: 'text',
				row: rewardRow,
				height,
				text: {
					fontSize: textFontSize,
					lineH: textLineH,
					maxLines,
					maxWidth: textMaxWidth,
					lines,
					lineCount
				}
			} as RewardLayoutRow;
		});
	}

	function layoutTotalHeight(layout: RewardLayoutRow[]): number {
		const rowsH = layout.reduce((sum, row) => sum + row.height, 0);
		return rowsH + Math.max(0, rowCount - 1) * rowGap;
	}

	const iconScale = isPostcard ? 0.82 : isDense ? 0.9 : 1;
	const baseIconSize = rowCount <= 1 ? 50 : rowCount === 2 ? 36 : 30;
	const iconSize = Math.max(18, Math.round(baseIconSize * iconScale));
	const iconGap = rowCount <= 1 ? 6 : 4;
	const rowGap = rowCount <= 1 ? 0 : isPostcard ? 6 : isDense ? 6 : 8;
	const maxIcons = rowCount <= 1 ? 6 : 7;

	const baseArtH = isPostcard ? 260 : 240;
	const minArtH = isDense ? 130 : isCinematic ? 190 : 160;
	const rewardAreaBottom = footerY - 16;
	const rewardAreaTopBase = artY + 8;
	const rewardAreaWithoutArtH = rewardAreaBottom - rewardAreaTopBase;

	let rewardLayout = buildRewardLayout();
	let totalRewardH = layoutTotalHeight(rewardLayout);

	function computeArtHeight(totalRewardsHeight: number): number {
		if (rowCount === 0) return baseArtH;
		const target = Math.min(baseArtH, rewardAreaWithoutArtH - totalRewardsHeight);
		return Math.max(minArtH, target);
	}

	let artH = computeArtHeight(totalRewardH);
	let availableRewardH = rewardAreaWithoutArtH - artH;

	if (rowCount > 0 && totalRewardH > availableRewardH) {
		// Not enough room even with max desired text lines; shrink text rows to fit.
		const textRows = rewardLayout.filter((r): r is Extract<RewardLayoutRow, { kind: 'text' }> => r.kind === 'text');
		if (textRows.length > 0) {
			const gapH = Math.max(0, rowCount - 1) * rowGap;
			const fixedIconH = rewardLayout.reduce((sum, r) => (r.kind === 'text' ? sum : sum + r.height), 0);
			const availableForText = Math.max(0, availableRewardH - gapH - fixedIconH);
			const perText = availableForText / textRows.length;

			for (const row of textRows) {
				const byHeight = Math.floor(perText / row.text.lineH);
				const nextLines = Math.max(1, Math.min(row.text.lines.length, row.text.maxLines, byHeight));
				row.text.lineCount = nextLines;
				row.height = Math.max(iconSize, nextLines * row.text.lineH);
			}

			totalRewardH = layoutTotalHeight(rewardLayout);
			while (totalRewardH > availableRewardH && textRows.some((r) => r.text.lineCount > 1)) {
				const rowToShrink =
					textRows.reduce((best, r) => (r.text.lineCount > (best?.text.lineCount ?? 0) ? r : best), textRows[0]) ??
					textRows[0];
				if (!rowToShrink || rowToShrink.text.lineCount <= 1) break;
				rowToShrink.text.lineCount -= 1;
				rowToShrink.height = Math.max(iconSize, rowToShrink.text.lineCount * rowToShrink.text.lineH);
				totalRewardH = layoutTotalHeight(rewardLayout);
			}
		}

		// Recompute art height now that text has been shrunk; keep art as large as possible.
		artH = computeArtHeight(totalRewardH);
		availableRewardH = rewardAreaWithoutArtH - artH;
	}

	// Clip to rounded rect
	ctx.save();
	roundRect(ctx, 0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, 4);
	ctx.clip();

	// Base background (use style-specific color)
	ctx.fillStyle = styleDef.background.baseColor;
	ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	// Background image (blurred and darkened)
	ctx.save();
	ctx.filter = 'blur(8px) saturate(35%) contrast(110%) brightness(30%)';
	ctx.globalAlpha = 0.75;
	// Draw slightly larger to avoid blur edge artifacts
	drawImageCover(ctx, locationImg, -20, -20, EVENT_CARD_WIDTH + 40, EVENT_CARD_HEIGHT + 40);
	ctx.restore();

	// Accent gradients (style-specific colors)
	const accentA = hexToRgba(styleSettings.gradient.accentAHex, styleSettings.gradient.accentAAlpha);
	const bgAccentA = ctx.createRadialGradient(
		EVENT_CARD_WIDTH * 0.25,
		EVENT_CARD_HEIGHT * 0.2,
		0,
		EVENT_CARD_WIDTH * 0.25,
		EVENT_CARD_HEIGHT * 0.2,
		EVENT_CARD_WIDTH * 0.7
	);
	bgAccentA.addColorStop(0, accentA);
	bgAccentA.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = bgAccentA;
	ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	const accentB = hexToRgba(styleSettings.gradient.accentBHex, styleSettings.gradient.accentBAlpha);
	const bgAccentB = ctx.createRadialGradient(
		EVENT_CARD_WIDTH * 0.75,
		EVENT_CARD_HEIGHT * 0.7,
		0,
		EVENT_CARD_WIDTH * 0.75,
		EVENT_CARD_HEIGHT * 0.7,
		EVENT_CARD_WIDTH * 0.8
	);
	bgAccentB.addColorStop(0, accentB);
	bgAccentB.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = bgAccentB;
	ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);

	// Style-specific overlay tint
	if (styleSettings.overlayTint) {
		ctx.fillStyle = styleSettings.overlayTint;
		ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);
	}

	// Vignette (use style-specific color and strength)
	const vignetteStrength = styleDef.background.vignetteStrength;
	if (vignetteStrength > 0) {
		const vignetteGrad = ctx.createRadialGradient(
			EVENT_CARD_WIDTH / 2,
			EVENT_CARD_HEIGHT / 2,
			0,
			EVENT_CARD_WIDTH / 2,
			EVENT_CARD_HEIGHT / 2,
			EVENT_CARD_WIDTH * 0.75
		);
		const vignetteColor = styleDef.background.vignetteColor;
		// Parse rgba color and apply strength multiplier
		const rgbaMatch = vignetteColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
		if (rgbaMatch) {
			const [, r, g, b] = rgbaMatch;
			vignetteGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.1 * vignetteStrength})`);
			vignetteGrad.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${0.45 * vignetteStrength})`);
			vignetteGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.9 * vignetteStrength})`);
		} else {
			// Fallback for hex or other formats
			vignetteGrad.addColorStop(0, hexToRgba(vignetteColor, 0.1 * vignetteStrength));
			vignetteGrad.addColorStop(0.4, hexToRgba(vignetteColor, 0.45 * vignetteStrength));
			vignetteGrad.addColorStop(1, hexToRgba(vignetteColor, 0.9 * vignetteStrength));
		}
		ctx.fillStyle = vignetteGrad;
		ctx.fillRect(0, 0, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT);
	}

	// Frame + particles (style-specific)
	drawFrame(ctx, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, styleDef);
	drawCorners(ctx, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, styleDef);
	drawParticles(ctx, EVENT_CARD_WIDTH, EVENT_CARD_HEIGHT, styleDef);

	// Title (top, centered) - style-specific typography
	const title = (options.title ?? '').trim();
	const titleY = 42;
	if (title) {
		ctx.save();
		const typo = styleDef.typography;
		ctx.font = `${typo.titleWeight} 34px Opsilon`;
		const titleText = typo.titleTransform === 'uppercase' ? title.toUpperCase() :
			typo.titleTransform === 'capitalize' ? title.charAt(0).toUpperCase() + title.slice(1) : title;
		const safeTitle = ellipsizeToWidth(ctx, titleText, EVENT_CARD_WIDTH - 100);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const titleX = EVENT_CARD_WIDTH / 2;
		// Text shadow for readability
		ctx.shadowColor = typo.titleShadow;
		ctx.shadowBlur = 16;
		ctx.shadowOffsetY = 2;
		ctx.fillStyle = typo.titleColor;
		ctx.fillText(safeTitle, titleX, titleY);
		// Glow pass (style-specific)
		ctx.shadowColor = typo.titleGlow;
		ctx.shadowBlur = typo.titleGlowStrength;
		ctx.shadowOffsetY = 0;
		ctx.fillText(safeTitle, titleX, titleY);
		ctx.restore();
	}

	// Art area (middle, full width with fade edges - no border panel)
	const artX = (EVENT_CARD_WIDTH - artW) / 2;
	ctx.save();
	// Soft fade mask using gradient
	const artMask = ctx.createLinearGradient(artX, 0, artX + artW, 0);
	artMask.addColorStop(0, 'rgba(0,0,0,0)');
	artMask.addColorStop(0.08, 'rgba(0,0,0,1)');
	artMask.addColorStop(0.92, 'rgba(0,0,0,1)');
	artMask.addColorStop(1, 'rgba(0,0,0,0)');
	roundRect(ctx, artX, artY, artW, artH, 8);
	ctx.clip();
	ctx.filter = 'saturate(100%) contrast(110%) brightness(96%)';
	ctx.globalAlpha = 1;
	drawImageCover(ctx, locationImg, artX, artY, artW, artH);
	ctx.restore();

	// Soft fade overlay on art edges (use style-specific base color)
	const fadeBaseColor = styleDef.background.baseColor;
	const leftFade = ctx.createLinearGradient(artX, 0, artX + 40, 0);
	leftFade.addColorStop(0, hexToRgba(fadeBaseColor, 0.85));
	leftFade.addColorStop(1, hexToRgba(fadeBaseColor, 0));
	ctx.fillStyle = leftFade;
	ctx.fillRect(artX, artY, 40, artH);

	const rightFade = ctx.createLinearGradient(artX + artW - 40, 0, artX + artW, 0);
	rightFade.addColorStop(0, hexToRgba(fadeBaseColor, 0));
	rightFade.addColorStop(1, hexToRgba(fadeBaseColor, 0.85));
	ctx.fillStyle = rightFade;
	ctx.fillRect(artX + artW - 40, artY, 40, artH);

	const topFade = ctx.createLinearGradient(0, artY, 0, artY + 30);
	topFade.addColorStop(0, hexToRgba(fadeBaseColor, 0.7));
	topFade.addColorStop(1, hexToRgba(fadeBaseColor, 0));
	ctx.fillStyle = topFade;
	ctx.fillRect(artX, artY, artW, 30);

	const bottomFade = ctx.createLinearGradient(0, artY + artH - 40, 0, artY + artH);
	bottomFade.addColorStop(0, hexToRgba(fadeBaseColor, 0));
	bottomFade.addColorStop(1, hexToRgba(fadeBaseColor, 0.75));
	ctx.fillStyle = bottomFade;
	ctx.fillRect(artX, artY + artH - 40, artW, 40);

	// Bottom reward/trade rows - stacked under art (supports multiple rows)
	if (rewardRows.length > 0) {
		const areaTop = artY + artH + 8;
		const areaBottom = footerY - 16;
		const availableH = Math.max(0, areaBottom - areaTop);
		const totalH = totalRewardH;
		const startY = areaTop + Math.max(0, (availableH - totalH) / 2);

			function tokensToUrls(tokens: RewardIconToken[]): (string | { kind: 'or'; urls: (string | null)[] } | null)[] {
				return tokens
					.slice(0, maxIcons)
				.map((t) => {
					if (typeof t === 'string') return getIconPoolUrl(t);
					if (t && typeof t === 'object' && (t as any).kind === 'or') {
						const ids = Array.isArray((t as any).icon_ids) ? ((t as any).icon_ids as string[]) : [];
						return { kind: 'or' as const, urls: ids.slice(0, 2).map((id) => getIconPoolUrl(id)) };
					}
					return null;
				})
				.filter((x) => x !== null);
		}

		const needsIconPool = rewardRows.some((row) => row.type !== 'text' && rowHasAnyContent(row));
		if (needsIconPool) {
			await loadIconPool();
		}

		const iconImageCache = new Map<string, Promise<HTMLImageElement | null>>();
		function getCachedImage(url: string): Promise<HTMLImageElement | null> {
			const existing = iconImageCache.get(url);
			if (existing) return existing;
			const pending = loadImage(url).catch(() => null);
			iconImageCache.set(url, pending);
			return pending;
		}

		async function drawIcon(x: number, y: number, token: string | { kind: 'or'; urls: (string | null)[] }) {
			ctx.save();
			// Draw icon with shadow for visibility (no box)
			ctx.shadowColor = 'rgba(8, 6, 16, 0.85)';
			ctx.shadowBlur = 6;
			ctx.shadowOffsetY = 2;

			if (typeof token === 'string') {
				const img = await getCachedImage(token);
				if (img) drawImageContain(ctx, img, x, y, iconSize, iconSize);
				ctx.restore();
				return;
			}

			// OR token - draw both icons smaller with slash
			const [u1, u2] = token.urls;
			const gap = Math.max(4, Math.round(iconSize * 0.22));
			const sideSize = Math.max(10, Math.round(iconSize * 0.4));
			const availableW = iconSize - gap;
			const leftCenterX = x + availableW / 4;
			const rightCenterX = x + iconSize - availableW / 4;
			const iconY = y + (iconSize - sideSize) / 2;

			if (u1) {
				const img1 = await getCachedImage(u1);
				if (img1) drawImageContain(ctx, img1, leftCenterX - sideSize / 2, iconY, sideSize, sideSize);
			}
			if (u2) {
				const img2 = await getCachedImage(u2);
				if (img2) drawImageContain(ctx, img2, rightCenterX - sideSize / 2, iconY, sideSize, sideSize);
			}

			if (u1 && u2) {
				ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
				ctx.font = `800 ${Math.round(iconSize * 0.55)}px Opsilon`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.shadowColor = 'rgba(8, 6, 16, 0.9)';
				ctx.shadowBlur = 6;
				ctx.shadowOffsetY = 1;
				ctx.fillText('/', x + iconSize / 2, y + iconSize / 2);
			}
			ctx.restore();
			}

		let y = startY;
		for (let rowIndex = 0; rowIndex < rewardLayout.length; rowIndex++) {
			const layoutRow = rewardLayout[rowIndex];
			const rowY = y;
			const rowH = layoutRow.height;

			if (layoutRow.kind === 'trade') {
				const rewardRow = layoutRow.row as Extract<GameLocationRewardRow, { type: 'trade' }>;
				const leftTokens = tokensToUrls(rewardRow.cost_icon_ids);
				const rightTokens = tokensToUrls(rewardRow.gain_icon_ids);
				const iconY = rowY + Math.max(0, (rowH - iconSize) / 2);

				const midX = EVENT_CARD_WIDTH / 2;
				const arrowGap = rowCount <= 1 ? 16 : 12;

				const leftW = leftTokens.length * iconSize + Math.max(0, leftTokens.length - 1) * iconGap;
				const rightW = rightTokens.length * iconSize + Math.max(0, rightTokens.length - 1) * iconGap;

				const leftStartX = midX - arrowGap - leftW;
				for (let i = 0; i < leftTokens.length; i++) {
					const t = leftTokens[i];
					if (!t) continue;
					const x = leftStartX + i * (iconSize + iconGap);
					await drawIcon(x, iconY, t as any);
				}

				// Arrow with glow
				ctx.save();
				ctx.font = `800 ${Math.round(iconSize * 0.62)}px Opsilon`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.shadowColor = 'rgba(139, 92, 246, 0.7)';
				ctx.shadowBlur = 10;
				ctx.fillStyle = '#c4b5fd';
				ctx.fillText('→', midX, iconY + iconSize / 2);
				ctx.restore();

				const rightStartX = midX + arrowGap;
				for (let i = 0; i < rightTokens.length; i++) {
					const t = rightTokens[i];
					if (!t) continue;
					const x = rightStartX + i * (iconSize + iconGap);
					await drawIcon(x, iconY, t as any);
				}
			} else if (layoutRow.kind === 'gain') {
				const rewardRow = layoutRow.row as Extract<GameLocationRewardRow, { type: 'gain' }>;
				const tokens = tokensToUrls(rewardRow.gain_icon_ids);
				const totalW = tokens.length * iconSize + Math.max(0, tokens.length - 1) * iconGap;
				const startX = EVENT_CARD_WIDTH / 2 - totalW / 2;
				const iconY = rowY + Math.max(0, (rowH - iconSize) / 2);
				for (let i = 0; i < tokens.length; i++) {
					const t = tokens[i];
					if (!t) continue;
					await drawIcon(startX + i * (iconSize + iconGap), iconY, t as any);
				}
			} else if (layoutRow.kind === 'text') {
				const text = String((layoutRow.row as Extract<GameLocationRewardRow, { type: 'text' }>).text ?? '').trim();
				if (!text) {
					// no-op
				} else {
					const t = layoutRow.text;
					const renderLines = t.lines.slice(0, t.lineCount);

					ctx.save();
					ctx.font = `700 ${t.fontSize}px Opsilon`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.shadowColor = 'rgba(8, 6, 16, 0.9)';
					ctx.shadowBlur = 10;
					ctx.shadowOffsetY = 2;
					ctx.fillStyle = '#ede9fe';
					const centerY = rowY + rowH / 2;
					const textStartY = centerY - ((renderLines.length - 1) * t.lineH) / 2;
					for (let i = 0; i < renderLines.length; i++) {
						ctx.fillText(renderLines[i], EVENT_CARD_WIDTH / 2, textStartY + i * t.lineH);
					}
					ctx.restore();
				}
			}

			y += rowH + rowGap;
		}
	}

	// Footer diamonds (decorative only, use style-specific accent color)
	const centerX = EVENT_CARD_WIDTH / 2;
	const diamondColor = hexToRgba(styleDef.colors.primary, 0.5);
	drawDiamond(ctx, centerX - 70, footerY, 5, diamondColor);
	drawDiamond(ctx, centerX + 70, footerY, 5, diamondColor);

	ctx.restore();

	// Card border (use style-specific frame color)
	ctx.strokeStyle = styleDef.frame.color;
	ctx.lineWidth = 2;
	roundRect(ctx, 1, 1, EVENT_CARD_WIDTH - 2, EVENT_CARD_HEIGHT - 2, 4);
	ctx.stroke();

	// Corner glows (use style-specific glow color)
	const glowColor = styleDef.colors.glow;
	const cornerGlow1 = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
	cornerGlow1.addColorStop(0, glowColor);
	cornerGlow1.addColorStop(1, 'transparent');
	ctx.fillStyle = cornerGlow1;
	ctx.fillRect(0, 0, 80, 80);

	const cornerGlow2 = ctx.createRadialGradient(
		EVENT_CARD_WIDTH,
		EVENT_CARD_HEIGHT,
		0,
		EVENT_CARD_WIDTH,
		EVENT_CARD_HEIGHT,
		80
	);
	cornerGlow2.addColorStop(0, glowColor);
	cornerGlow2.addColorStop(1, 'transparent');
	ctx.fillStyle = cornerGlow2;
	ctx.fillRect(EVENT_CARD_WIDTH - 80, EVENT_CARD_HEIGHT - 80, 80, 80);

	return canvasToBlob(canvas);
}
