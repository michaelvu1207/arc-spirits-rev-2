/**
 * Stage Completion Card generator.
 *
 * Renders text (title, complete_condition) onto a base image using the
 * Transform-based layout config (x, y, rotation, scale) + text box + text style.
 */

import { loadOpsilonFont, canvasToBlob, wrapText, createCanvas, getContext } from '../shared/canvas';
import type {
	StageCompletionCardLayoutConfig,
	StageCompletionPlacementKey,
	TextStyle,
	Transform,
	Box
} from '../shared/stageCompletionCardLayoutConfig';

export type StageCompletionCardForExport = {
	id: string;
	title: string;
	complete_condition: string;
	stage_text: string;
	image_path: string | null;
	card_image_path: string | null;
	updated_at: string | null;
};

function getText(card: StageCompletionCardForExport, key: StageCompletionPlacementKey): string {
	switch (key) {
		case 'title':
			return card.title || '';
		case 'complete_condition':
			return card.complete_condition || '';
		case 'stage_text':
			return card.stage_text || '';
		case 'advance_to_next_stage_label':
			return 'To advance to the next stage: ';
	}
}

/**
 * Draws a single text placement onto the canvas using Transform positioning.
 * The (x, y) is the center of the text box.
 */
function drawTextPlacement(
	ctx: CanvasRenderingContext2D,
	text: string,
	placement: Transform,
	box: Box,
	style: TextStyle
): void {
	if (!text) return;

	const s = Math.max(0.05, placement.scale);
	const rad = (placement.rotation * Math.PI) / 180;

	ctx.save();
	ctx.translate(placement.x, placement.y);
	ctx.rotate(rad);
	ctx.scale(s, s);

	// Text box centered on origin after transform
	const hw = box.w / 2;
	const hh = box.h / 2;

	// Clip to text box
	ctx.beginPath();
	ctx.rect(-hw, -hh, box.w, box.h);
	ctx.clip();

	// Text style
	const fontSize = style.fontSize;
	const lineHeight = style.lineHeight ?? Math.round(fontSize * 1.2);
	const fontFamily = style.fontFamily ?? 'Opsilon';
	ctx.font = `700 ${fontSize}px ${fontFamily}, ui-serif, system-ui, sans-serif`;
	ctx.fillStyle = style.color;
	ctx.textBaseline = 'top';
	ctx.textAlign = style.align;

	// Wrap text
	const lines = wrapText(ctx, text, box.w);

	// Compute start X based on alignment
	let startX: number;
	if (style.align === 'left') {
		startX = -hw;
	} else if (style.align === 'right') {
		startX = hw;
	} else {
		startX = 0;
	}

	// Vertically center block within box
	const totalTextHeight = lines.length * lineHeight;
	let cursorY = -totalTextHeight / 2;

	for (const line of lines) {
		if (cursorY > hh) break;
		ctx.fillText(line, startX, cursorY, box.w);
		cursorY += lineHeight;
	}

	ctx.restore();
}

/**
 * Renders a stage completion card to a PNG Blob.
 * Canvas dimensions match the base image. Layout coordinates (in
 * config._ref_w x _ref_h space) are scaled up to the image size.
 */
export async function renderStageCompletionCardBlob(
	card: StageCompletionCardForExport,
	baseImg: HTMLImageElement,
	config: StageCompletionCardLayoutConfig
): Promise<Blob> {
	const imgW = baseImg.naturalWidth || baseImg.width;
	const imgH = baseImg.naturalHeight || baseImg.height;

	const canvas = createCanvas(imgW, imgH);
	const ctx = getContext(canvas);

	// Scale so layout coordinates (in _ref_w x _ref_h space) map to the full image
	const sx = imgW / config._ref_w;
	const sy = imgH / config._ref_h;
	ctx.scale(sx, sy);

	ctx.imageSmoothingEnabled = true;
	try {
		ctx.imageSmoothingQuality = 'high';
	} catch {
		// ignore
	}

	// Draw base image at reference dimensions (ctx.scale maps to full canvas)
	ctx.drawImage(baseImg, 0, 0, config._ref_w, config._ref_h);

	// Draw each text placement in reference-space coordinates
	const keys: StageCompletionPlacementKey[] = ['title', 'complete_condition', 'stage_text', 'advance_to_next_stage_label'];
	for (const key of keys) {
		const text = getText(card, key);
		if (!text) continue;
		drawTextPlacement(
			ctx,
			text,
			config.placements[key],
			config.text_boxes[key],
			config.text_styles[key]
		);
	}

	return canvasToBlob(canvas);
}

/**
 * Ensures the Opsilon font is loaded and any custom fontFamily referenced in config.
 */
export async function loadStageCompletionFonts(config: StageCompletionCardLayoutConfig): Promise<void> {
	await loadOpsilonFont();
	// If a custom fontFamily other than Opsilon is used, it would need to be loaded here
	// For now, the system supports Opsilon and system fonts
}
