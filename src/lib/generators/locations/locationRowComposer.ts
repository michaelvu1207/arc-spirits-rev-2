import { createCanvas, getContext, loadImage, canvasToBlob } from '$lib/generators/shared/canvas';
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
