/**
 * Shared canvas utility functions for image generation
 */

// Track loaded fonts to avoid race conditions
const loadedFonts = new Set<string>();
let opsilonLoaded = false;
let opsilonLoadPromise: Promise<void> | null = null;

/**
 * Loads a font and ensures it's ready for canvas rendering
 * @param fontFamily - The font family name
 * @param fontUrl - URL to the font file
 * @param options - Font face options (weight, style, etc.)
 */
export async function loadFont(
	fontFamily: string,
	fontUrl: string,
	options?: { weight?: string; style?: string }
): Promise<void> {
	const weight = options?.weight || 'normal';
	const style = options?.style || 'normal';
	const key = `${fontFamily}-${weight}-${style}`;

	// Skip if already loaded by us
	if (loadedFonts.has(key)) {
		return;
	}

	const font = new FontFace(fontFamily, `url(${fontUrl})`, {
		weight,
		style
	});

	await font.load();
	document.fonts.add(font);
	loadedFonts.add(key);
	await document.fonts.ready;
}

/**
 * Loads the Opsilon font family with all needed weights
 */
export async function loadOpsilonFont(): Promise<void> {
	// Return immediately if already loaded
	if (opsilonLoaded) {
		return;
	}

	// If currently loading, wait for that promise
	if (opsilonLoadPromise) {
		return opsilonLoadPromise;
	}

	// Start loading
	opsilonLoadPromise = (async () => {
		const regularUrl = '/fonts/Opsilon-Regular.ttf';
		const italicUrl = '/fonts/Opsilon-Italic.ttf';

		await Promise.all([
			// Normal weights
			loadFont('Opsilon', regularUrl, { weight: 'normal', style: 'normal' }),
			loadFont('Opsilon', regularUrl, { weight: '400', style: 'normal' }),
			loadFont('Opsilon', regularUrl, { weight: '600', style: 'normal' }),
			loadFont('Opsilon', regularUrl, { weight: '700', style: 'normal' }),
			// Italic
			loadFont('Opsilon', italicUrl, { weight: 'normal', style: 'italic' }),
			loadFont('Opsilon', italicUrl, { weight: '400', style: 'italic' })
		]);

		opsilonLoaded = true;
	})();

	return opsilonLoadPromise;
}

/**
 * Creates a canvas element with the specified dimensions
 */
export function createCanvas(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

/**
 * Gets 2D context from a canvas with error handling
 */
export function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Could not get canvas 2D context');
	}
	return ctx;
}

/**
 * Loads an image from a URL with CORS support
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = url;
	});
}

/**
 * Loads an image from a Blob
 */
export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = (err) => {
			URL.revokeObjectURL(url);
			reject(err);
		};
		img.src = url;
	});
}

/**
 * Converts a canvas to a Blob
 * @param canvas - The canvas element to convert
 * @param type - MIME type (default: 'image/png')
 * @param quality - Quality for lossy formats like JPEG (0-1, default: 0.92)
 */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error('Failed to convert canvas to blob'));
				}
			},
			type,
			quality
		);
	});
}

/**
 * Draws a rounded rectangle path (does not fill or stroke)
 */
export function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
): void {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

/**
 * Wraps text to fit within a maximum width
 */
export function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number
): string[] {
	const normalize = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const segmentGraphemes = (value: string): string[] => {
			try {
				const SegmenterCtor = (Intl as typeof Intl & { Segmenter?: typeof Intl.Segmenter }).Segmenter;
				if (typeof SegmenterCtor === 'function') {
					const seg = new SegmenterCtor(undefined, { granularity: 'grapheme' });
					return Array.from(seg.segment(value), (s) => s.segment);
				}
			} catch {
				// ignore
			}
		return Array.from(value);
	};

	const containsCJK = (value: string): boolean =>
		/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/.test(value);

	const breakLongToken = (token: string): string[] => {
		const parts: string[] = [];
		let current = '';
		let currentSum = 0;
		for (const piece of segmentGraphemes(token)) {
			const pieceWidth = ctx.measureText(piece).width;
			const next = current + piece;
			const nextSum = currentSum + pieceWidth;
			const measured = ctx.measureText(next).width;
			const nextWidth = Math.max(measured, nextSum);
			if (current.length === 0 || nextWidth <= maxWidth) {
				current = next;
				currentSum = nextSum;
				continue;
			}
			parts.push(current);
			current = piece;
			currentSum = pieceWidth;
		}
		if (current) parts.push(current);
		return parts;
	};

	const collapsed = normalize(text ?? '').replace(/\s+/g, ' ').trim();
	if (!collapsed) return [''];

	// For CJK languages, browsers line-break at grapheme boundaries more readily than whitespace.
	// Use a grapheme-based wrapper so JP/ZH/KO strings without spaces still wrap correctly.
	if (containsCJK(collapsed)) {
		const out: string[] = [];
		let line = '';
		let lineSum = 0;

		for (const piece of segmentGraphemes(collapsed)) {
			if (!line && piece === ' ') continue; // avoid leading spaces

			const pieceWidth = ctx.measureText(piece).width;
			const next = line + piece;
			const nextSum = lineSum + pieceWidth;
			const measured = ctx.measureText(next).width;
			const nextWidth = Math.max(measured, nextSum);

			if (line && nextWidth > maxWidth) {
				out.push(line.trimEnd());
				if (piece === ' ') {
					line = '';
					lineSum = 0;
				} else {
					line = piece;
					lineSum = pieceWidth;
				}
				continue;
			}

			line = next;
			lineSum = nextSum;
		}

		const finalLine = line.trimEnd();
		if (finalLine || out.length === 0) out.push(finalLine);
		return out;
	}

	const tokens = collapsed.split(' ');
	const out: string[] = [];
	let line = '';

	for (const token of tokens) {
		if (!token) continue;

		if (!line) {
			if (ctx.measureText(token).width <= maxWidth) {
				line = token;
				continue;
			}

			const parts = breakLongToken(token);
			out.push(...parts.slice(0, -1));
			line = parts.at(-1) ?? '';
			continue;
		}

		const candidate = `${line} ${token}`;
		if (ctx.measureText(candidate).width <= maxWidth) {
			line = candidate;
			continue;
		}

		out.push(line);
		if (ctx.measureText(token).width <= maxWidth) {
			line = token;
			continue;
		}

		const parts = breakLongToken(token);
		out.push(...parts.slice(0, -1));
		line = parts.at(-1) ?? '';
	}

	if (line) out.push(line);
	return out.length > 0 ? out : [''];
}

/**
 * Truncates text to fit within a maximum width with ellipsis
 */
export function truncateText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number
): string {
	if (ctx.measureText(text).width <= maxWidth) {
		return text;
	}
	let truncated = text;
	while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
		truncated = truncated.slice(0, -1);
	}
	return truncated + '…';
}

/**
 * Computes the trimmed bounding box of an image (removes transparent pixels)
 */
export function computeTrimRect(img: HTMLImageElement): {
	sx: number;
	sy: number;
	sw: number;
	sh: number;
} {
	const w = img.naturalWidth || img.width;
	const h = img.naturalHeight || img.height;
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return { sx: 0, sy: 0, sw: w, sh: h };

	ctx.drawImage(img, 0, 0);
	const data = ctx.getImageData(0, 0, w, h).data;

	let minX = w,
		minY = h,
		maxX = -1,
		maxY = -1;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const idx = (y * w + x) * 4 + 3; // alpha channel
			if (data[idx] > 0) {
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
 * Renders an emoji to a blob
 */
export function renderEmojiToBlob(emoji: string, size = 512): Promise<Blob> {
	return new Promise((resolve, reject) => {
		try {
			const canvas = document.createElement('canvas');
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d', { alpha: true });
			if (!ctx) {
				reject(new Error('Unable to obtain 2D context'));
				return;
			}
			ctx.clearRect(0, 0, size, size);
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = `${size * 0.8}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
			ctx.fillText(emoji, size / 2, size / 2);
			canvas.toBlob(
				(blob) => {
					if (!blob) {
						reject(new Error('Failed to render emoji blob'));
					} else {
						resolve(blob);
					}
				},
				'image/png'
			);
		} catch (err) {
			reject(err instanceof Error ? err : new Error(String(err)));
		}
	});
}

/**
 * Normalizes an image buffer to a specific size (useful for icons)
 */
export async function normalizeImageBuffer(
	buffer: ArrayBuffer,
	size = 512
): Promise<ArrayBuffer> {
	const blob = new Blob([buffer]);
	const image = await loadImageFromBlob(blob);
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Unable to obtain 2D context');

	ctx.clearRect(0, 0, size, size);
	const scale = Math.max(size / image.width, size / image.height);
	const drawWidth = image.width * scale;
	const drawHeight = image.height * scale;
	const dx = (size - drawWidth) / 2;
	const dy = (size - drawHeight) / 2;
	ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

	const resizedBlob = await canvasToBlob(canvas, 'image/png');
	return resizedBlob.arrayBuffer();
}
