/**
 * Generic card rendering engine.
 *
 * Pipeline:
 *   1. Create canvas at _ref_w x _ref_h
 *   2. Draw base image (stretch to fit)
 *   3. For each zone in order:
 *      - text      -> drawTextZone
 *      - icon_grid  -> drawIconGridZone
 *      - image     -> drawImageZone
 *      - custom    -> delegate to CardRenderer.renderCustomZone
 *   4. canvasToBlob -> return PNG Blob
 */

import { canvasToBlob, loadImage } from './canvas';
import { computeCenteredGridGeometry } from './centeredIconGrid';
import type {
	CardLayoutConfig,
	CardRenderer,
	CustomZone,
	IconGridZone,
	ImageZone,
	TextZone,
	Zone
} from './layoutTypes';

// ---------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const normalized = (text ?? '').replace(/\r\n/g, '\n');
	const paragraphs = normalized.split('\n');
	const lines: string[] = [];
	for (const p of paragraphs) {
		const words = p.split(/\s+/).filter(Boolean);
		if (words.length === 0) {
			lines.push('');
			continue;
		}
		let line = words[0];
		for (let i = 1; i < words.length; i++) {
			const test = `${line} ${words[i]}`;
			if (ctx.measureText(test).width <= maxWidth) {
				line = test;
			} else {
				lines.push(line);
				line = words[i];
			}
		}
		lines.push(line);
	}
	return lines;
}

function drawTextZone(
	ctx: CanvasRenderingContext2D,
	zone: TextZone,
	text: string,
	scale = 1
): void {
	const x = zone.box.x * scale;
	const y = zone.box.y * scale;
	const w = zone.box.w * scale;
	const h = zone.box.h * scale;

	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();

	ctx.fillStyle = zone.color;
	const baseFontSize = Number.isFinite(zone.fontSize) ? zone.fontSize : 12;
	const fontWeight = zone.fontWeight ?? '700';
	const fontFamily = zone.fontFamily ?? 'Opsilon';
	ctx.font = `${fontWeight} ${Math.max(6, baseFontSize * scale)}px ${fontFamily}`;
	ctx.textBaseline = 'top';
	ctx.textAlign = zone.align;

	const pad = 10 * scale;
	const maxWidth = Math.max(0, w - pad * 2);
	const baseLineHeight =
		typeof zone.lineHeight === 'number' && Number.isFinite(zone.lineHeight)
			? zone.lineHeight
			: baseFontSize * 1.15;
	const lineHeight = baseLineHeight * scale;

	const lines = wrapText(ctx, text, maxWidth);
	let cursorY = y + pad;
	const startX =
		zone.align === 'left'
			? x + pad
			: zone.align === 'right'
				? x + w - pad
				: x + w / 2;

	for (let i = 0; i < lines.length; i++) {
		if (cursorY > y + h) break;
		ctx.fillText(lines[i], startX, cursorY, maxWidth);
		cursorY += lineHeight;
	}

	ctx.restore();
}

// ---------------------------------------------------------------------------
// Icon grid rendering
// ---------------------------------------------------------------------------

function drawIconGridZone(
	ctx: CanvasRenderingContext2D,
	zone: IconGridZone,
	iconUrls: (string | null)[],
	images: Map<string, HTMLImageElement>,
	scale = 1
): void {
	const x = zone.box.x * scale;
	const y = zone.box.y * scale;
	const w = zone.box.w * scale;
	const h = zone.box.h * scale;

	const validUrls = iconUrls.filter((u): u is string => typeof u === 'string');
	if (validUrls.length === 0) return;

	const cols = Math.max(1, zone.maxPerRow);
	const rows = Math.max(1, Math.ceil(validUrls.length / cols));

	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();

	const geometry = computeCenteredGridGeometry(
		{ x, y, w, h },
		{ cols, rows, gap: zone.gap * scale }
	);

	const cellSize = geometry.cellSize;
	const pad = Math.max(1, Math.round(cellSize * 0.1));
	const maxSide = Math.max(1, cellSize - pad * 2);

	let idx = 0;
	for (let row = 0; row < rows && idx < validUrls.length; row++) {
		const rowCount = Math.min(cols, validUrls.length - idx);
		const startCol = Math.floor((cols - rowCount) / 2);

		for (let c = 0; c < rowCount; c++, idx++) {
			const url = validUrls[idx];
			if (!url) continue;
			const img = images.get(url);
			if (!img) continue;

			const col = startCol + c;
			const px = geometry.startX + col * (cellSize + geometry.gap);
			const py = geometry.startY + row * (cellSize + geometry.gap);

			const iw = Math.max(1, img.width);
			const ih = Math.max(1, img.height);
			const scaleFactor = maxSide / Math.max(iw, ih);
			const dw = iw * scaleFactor;
			const dh = ih * scaleFactor;
			const dx = px + (cellSize - dw) / 2;
			const dy = py + (cellSize - dh) / 2;
			ctx.drawImage(img, dx, dy, dw, dh);
		}
	}

	ctx.restore();
}

// ---------------------------------------------------------------------------
// Image zone rendering
// ---------------------------------------------------------------------------

function drawImageZone(
	ctx: CanvasRenderingContext2D,
	zone: ImageZone,
	images: Map<string, HTMLImageElement>,
	imageUrl: string | null,
	scale = 1
): void {
	if (!imageUrl) return;
	const img = images.get(imageUrl);
	if (!img) return;

	const x = zone.box.x * scale;
	const y = zone.box.y * scale;
	const w = zone.box.w * scale;
	const h = zone.box.h * scale;

	ctx.save();
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.clip();

	const iw = img.naturalWidth || img.width || 1;
	const ih = img.naturalHeight || img.height || 1;

	let dw: number, dh: number;
	if (zone.fit === 'cover') {
		const s = Math.max(w / iw, h / ih);
		dw = iw * s;
		dh = ih * s;
	} else {
		const s = Math.min(w / iw, h / ih);
		dw = iw * s;
		dh = ih * s;
	}

	const dx = x + (w - dw) / 2;
	const dy = y + (h - dh) / 2;
	ctx.drawImage(img, dx, dy, dw, dh);

	ctx.restore();
}

// ---------------------------------------------------------------------------
// Zone data extractors (used by CardRenderer implementations)
// ---------------------------------------------------------------------------

export type ZoneDataMap = {
	/** text zone key -> string content */
	texts: Record<string, string>;
	/** icon_grid zone key -> array of icon URLs */
	iconGrids: Record<string, (string | null)[]>;
	/** image zone key -> image URL */
	images: Record<string, string | null>;
};

// ---------------------------------------------------------------------------
// Main render pipeline
// ---------------------------------------------------------------------------

export async function renderCardToBlob<T>(
	config: CardLayoutConfig,
	baseImageUrl: string,
	data: T,
	renderer: CardRenderer<T>,
	zoneData: ZoneDataMap
): Promise<Blob> {
	// 1. Load base image + all referenced images
	const urlsToLoad = new Set<string>();
	urlsToLoad.add(baseImageUrl);

	// Collect URLs from zone data
	for (const urls of Object.values(zoneData.iconGrids)) {
		for (const u of urls) {
			if (u) urlsToLoad.add(u);
		}
	}
	for (const u of Object.values(zoneData.images)) {
		if (u) urlsToLoad.add(u);
	}

	// Collect URLs from renderer
	const rendererUrls = renderer.collectImageUrls(config, data);
	for (const u of rendererUrls) {
		if (u) urlsToLoad.add(u);
	}

	// Load all images in parallel
	const imageEntries = await Promise.all(
		Array.from(urlsToLoad).map(async (url) => {
			try {
				return [url, await loadImage(url)] as const;
			} catch {
				return null;
			}
		})
	);

	const imageMap = new Map<string, HTMLImageElement>();
	for (const entry of imageEntries) {
		if (entry) imageMap.set(entry[0], entry[1]);
	}

	const baseImg = imageMap.get(baseImageUrl);
	if (!baseImg) throw new Error('Failed to load base image');

	// 2. Create canvas at base image's native dimensions
	const canvas = document.createElement('canvas');
	canvas.width = baseImg.width;
	canvas.height = baseImg.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable');

	// 3. Draw base image at native size
	ctx.drawImage(baseImg, 0, 0);

	// 4. Render zones (coordinates are absolute pixels matching the image)
	renderZones(ctx, config.zones, data, renderer, imageMap, zoneData, 1);

	// 5. Convert to blob
	return canvasToBlob(canvas);
}

/**
 * Render all zones onto a canvas context.
 * Extracted so preview rendering can reuse this with a different scale.
 */
export function renderZones<T>(
	ctx: CanvasRenderingContext2D,
	zones: Zone[],
	data: T,
	renderer: CardRenderer<T>,
	images: Map<string, HTMLImageElement>,
	zoneData: ZoneDataMap,
	scale: number
): void {
	for (const zone of zones) {
		switch (zone.type) {
			case 'text': {
				const text = zoneData.texts[zone.key] ?? '';
				drawTextZone(ctx, zone, text, scale);
				break;
			}
			case 'icon_grid': {
				const urls = zoneData.iconGrids[zone.key] ?? [];
				drawIconGridZone(ctx, zone, urls, images, scale);
				break;
			}
			case 'image': {
				const url = zoneData.images[zone.key] ?? null;
				drawImageZone(ctx, zone, images, url, scale);
				break;
			}
			case 'custom': {
				if (scale !== 1 && renderer.renderCustomZonePreview) {
					renderer.renderCustomZonePreview(ctx, zone, data, images, scale);
				} else {
					renderer.renderCustomZone(ctx, zone, data, images);
				}
				break;
			}
		}
	}
}
