import { createCanvas, getContext, loadImage, canvasToBlob } from '../shared/canvas';

export interface CropRect {
	sx: number;
	sy: number;
	sw: number;
	sh: number;
}

/**
 * Computes the trimmed bounding box of an image by detecting and removing
 * the background. Handles both transparent backgrounds (alpha-based) and
 * solid-color backgrounds (sampled from corners).
 */
export function computeSmartTrimRect(
	img: HTMLImageElement,
	tolerance = 30
): { sx: number; sy: number; sw: number; sh: number } {
	const w = img.naturalWidth || img.width;
	const h = img.naturalHeight || img.height;
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d');
	if (!ctx) return { sx: 0, sy: 0, sw: w, sh: h };

	ctx.drawImage(img, 0, 0);
	const data = ctx.getImageData(0, 0, w, h).data;

	// Sample corner pixels to detect background color
	const corners = [
		0,                          // top-left
		(w - 1) * 4,               // top-right
		(h - 1) * w * 4,           // bottom-left
		((h - 1) * w + (w - 1)) * 4 // bottom-right
	];
	let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
	for (const idx of corners) {
		bgR += data[idx];
		bgG += data[idx + 1];
		bgB += data[idx + 2];
		bgA += data[idx + 3];
	}
	bgR = Math.round(bgR / 4);
	bgG = Math.round(bgG / 4);
	bgB = Math.round(bgB / 4);
	bgA = Math.round(bgA / 4);

	const isBackground = (i: number): boolean => {
		const a = data[i + 3];
		// Transparent pixel
		if (a <= 10) return true;
		// Matches detected background color
		if (
			Math.abs(data[i] - bgR) <= tolerance &&
			Math.abs(data[i + 1] - bgG) <= tolerance &&
			Math.abs(data[i + 2] - bgB) <= tolerance &&
			Math.abs(a - bgA) <= tolerance
		) {
			return true;
		}
		return false;
	};

	let minX = w,
		minY = h,
		maxX = -1,
		maxY = -1;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			if (!isBackground(i)) {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
	}

	if (maxX === -1 || maxY === -1) {
		return { sx: 0, sy: 0, sw: w, sh: h };
	}

	return { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 };
}

/**
 * Generates a combined TTS texture with front image on the left
 * and back image on the right, placed side by side.
 * Both cropped images are scaled to the same height and the canvas
 * is sized to exactly fit both with no padding.
 * The canvas is flipped vertically for TTS UV mapping.
 */
export async function generateCombinedTTSTexture(
	frontUrl: string,
	backUrl: string,
	manualFrontCrop?: CropRect,
	manualBackCrop?: CropRect
): Promise<Blob> {
	// Load both images
	const [frontImg, backImg] = await Promise.all([loadImage(frontUrl), loadImage(backUrl)]);

	// Use manual crop rects if provided, otherwise auto-detect
	const frontTrim = manualFrontCrop ?? computeSmartTrimRect(frontImg);
	const backTrim = manualBackCrop ?? computeSmartTrimRect(backImg);

	// Compute output dimensions so both sides share the same height with no padding
	const targetH = Math.max(frontTrim.sh, backTrim.sh);
	const frontScale = targetH / frontTrim.sh;
	const backScale = targetH / backTrim.sh;
	const frontW = Math.round(frontTrim.sw * frontScale);
	const backW = Math.round(backTrim.sw * backScale);

	const canvas = createCanvas(frontW + backW, targetH);

	const ctx = getContext(canvas);

	// Flip the entire canvas vertically (for TTS UV mapping)
	ctx.translate(0, canvas.height);
	ctx.scale(1, -1);

	// Draw front on the left
	ctx.drawImage(
		frontImg,
		frontTrim.sx,
		frontTrim.sy,
		frontTrim.sw,
		frontTrim.sh,
		0,
		0,
		frontW,
		targetH
	);

	// Draw back on the right
	ctx.drawImage(
		backImg,
		backTrim.sx,
		backTrim.sy,
		backTrim.sw,
		backTrim.sh,
		frontW,
		0,
		backW,
		targetH
	);

	return canvasToBlob(canvas);
}
