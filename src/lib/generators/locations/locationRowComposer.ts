import { createCanvas, getContext, loadImage, canvasToBlob, loadOpsilonFont } from '$lib/generators/shared/canvas';
import type { IconSlot } from '$lib/generators/locations/locationIconPlacer';

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

export async function generateLocationRowFromTemplate(options: {
	backgroundUrl: string;
	iconSize: number;
	slots: IconSlot[];
	iconIds: string[];
	resolveIconUrl: (iconId: string) => string | null;
}): Promise<Blob> {
	const bg = await loadImage(options.backgroundUrl);
	const canvas = createCanvas(bg.width, bg.height);
	const ctx = getContext(canvas);

	ctx.drawImage(bg, 0, 0);

	for (let i = 0; i < Math.min(options.iconIds.length, options.slots.length); i++) {
		const iconId = options.iconIds[i];
		const slot = options.slots[i];
		const url = options.resolveIconUrl(iconId);
		if (!url) continue;
		try {
			const img = await loadImage(url);
			const w = slot.w ?? options.iconSize;
			const h = slot.h ?? options.iconSize;
			drawIconWithOutline(ctx, img, slot.x, slot.y, w, h);
		} catch (err) {
			console.warn('Failed to load icon for row render', iconId, err);
		}
	}

	return canvasToBlob(canvas);
}

function wrapTextToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const rawLines = String(text ?? '').split('\n');
	const lines: string[] = [];

	for (const raw of rawLines) {
		const trimmed = raw.trim();
		if (!trimmed) {
			lines.push('');
			continue;
		}

		const words = trimmed.split(/\s+/g).filter(Boolean);
		let current = '';

		for (const word of words) {
			const test = current ? `${current} ${word}` : word;
			if (ctx.measureText(test).width <= maxWidth) {
				current = test;
				continue;
			}

			if (current) lines.push(current);

			// If a single word is too long, hard-wrap it.
			let remaining = word;
			while (remaining.length > 0 && ctx.measureText(remaining).width > maxWidth) {
				let cut = remaining.length;
				while (cut > 1 && ctx.measureText(remaining.slice(0, cut)).width > maxWidth) {
					cut -= 1;
				}
				lines.push(remaining.slice(0, cut));
				remaining = remaining.slice(cut);
			}
			current = remaining;
		}

		if (current) lines.push(current);
	}

	// Remove trailing blank lines from input.
	while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
	return lines.length > 0 ? lines : [''];
}

export async function generateLocationTextRowFromTemplate(options: {
	backgroundUrl: string;
	text: string;
}): Promise<Blob> {
	await loadOpsilonFont();

	const bg = await loadImage(options.backgroundUrl);
	const canvas = createCanvas(bg.width, bg.height);
	const ctx = getContext(canvas);

	ctx.drawImage(bg, 0, 0);

	const paddingX = Math.max(16, Math.round(bg.width * 0.06));
	const paddingY = Math.max(12, Math.round(bg.height * 0.14));
	const maxW = Math.max(10, bg.width - paddingX * 2);
	const maxH = Math.max(10, bg.height - paddingY * 2);
	const centerX = bg.width / 2;

	const maxFontSize = 68;
	const minFontSize = 16;
	let chosenFontSize = 56;
	let lines: string[] = [''];
	let lineHeight = Math.round(chosenFontSize * 1.12);
	let foundFit = false;

	for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize--) {
		ctx.font = `700 ${fontSize}px "Opsilon", serif`;
		const candidateLines = wrapTextToWidth(ctx, options.text, maxW);
		const candidateLineHeight = Math.round(fontSize * 1.12);
		const totalH = candidateLines.length * candidateLineHeight;

		const widest = candidateLines.reduce((acc, line) => Math.max(acc, ctx.measureText(line).width), 0);
		if (widest <= maxW + 0.5 && totalH <= maxH + 0.5) {
			chosenFontSize = fontSize;
			lines = candidateLines;
			lineHeight = candidateLineHeight;
			foundFit = true;
			break;
		}
	}

	if (!foundFit) {
		chosenFontSize = minFontSize;
		ctx.font = `700 ${chosenFontSize}px "Opsilon", serif`;
		lines = wrapTextToWidth(ctx, options.text, maxW);
		lineHeight = Math.round(chosenFontSize * 1.12);
	}

	ctx.save();
	ctx.font = `700 ${chosenFontSize}px "Opsilon", serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';

	const totalHeight = lines.length * lineHeight;
	const startY = paddingY + Math.max(0, (maxH - totalHeight) / 2) + lineHeight / 2;

	ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
	ctx.shadowBlur = 6;
	ctx.shadowOffsetY = 2;

	ctx.strokeStyle = 'rgba(43, 26, 18, 0.95)';
	ctx.lineWidth = Math.max(3, Math.round(chosenFontSize / 8));
	ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const y = startY + i * lineHeight;
		if (!line) continue;
		ctx.strokeText(line, centerX, y);
		ctx.fillText(line, centerX, y);
	}

	ctx.restore();

	return canvasToBlob(canvas);
}

export async function generateLocationFromRowImages(options: {
	backgroundUrl: string;
	rows: { rowImageUrl: string; x: number; y: number; scale: number }[];
}): Promise<Blob> {
	const bg = await loadImage(options.backgroundUrl);
	const canvas = createCanvas(bg.width, bg.height);
	const ctx = getContext(canvas);

	ctx.drawImage(bg, 0, 0);

	for (const row of options.rows) {
		try {
			const img = await loadImage(row.rowImageUrl);
			const scale = row.scale ?? 1;
			ctx.drawImage(img, row.x, row.y, img.width * scale, img.height * scale);
		} catch (err) {
			console.warn('Failed to load row image for location render', err);
		}
	}

	return canvasToBlob(canvas);
}
