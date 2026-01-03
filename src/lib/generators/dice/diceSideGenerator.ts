/**
 * Generates dice side images by compositing a background image with text (numbers or symbols)
 */

import { createCanvas, getContext, loadImage } from '../shared/canvas';

export interface DiceSideOptions {
	backgroundUrl: string | null;
	text: string | number; // Can be a number or text like "X" or effect text
	size?: number;
	fontSize?: number;
	fontColor?: string;
	fontWeight?: string;
	fontFamily?: string;
}

// Dice fonts are optional; we avoid forcing a network fetch (offline-safe).
async function ensureDiceFontLoaded(): Promise<void> {
	try {
		if (typeof document === 'undefined' || !document.fonts) return;
		if (document.fonts.check('16px "Bebas Neue"')) return;
		await document.fonts.load('16px "Bebas Neue"');
	} catch {
		// Ignore font load failures; canvas will fall back to a safe font stack.
	}
}

/**
 * Generates a dice side image as a data URL using Canvas API
 */
export async function generateDiceSideCanvas(options: DiceSideOptions): Promise<string> {
	const size = options.size ?? 800;
	const fontSize = options.fontSize ?? size * 0.5;
	const fontColor = options.fontColor ?? '#ffffff';
	const fontFamily = options.fontFamily ?? '"Bebas Neue", "Impact", "Arial Black", sans-serif';

	// Best-effort; no-op if unavailable/offline.
	await ensureDiceFontLoaded();

	return new Promise(async (resolve, reject) => {
		const canvas = createCanvas(size, size);
		const ctx = getContext(canvas);

		const renderDiceFace = (bgImg?: HTMLImageElement) => {
			// Draw background image, filling the entire canvas
			if (bgImg) {
				ctx.drawImage(bgImg, 0, 0, size, size);
			}

			// Draw number centered with fancy font
			ctx.font = `${fontSize}px ${fontFamily}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			
			const text = String(options.text);
			const textX = size / 2;
			const textY = size / 2;
			
			// Draw black border/outline first
			ctx.strokeStyle = '#000000';
			ctx.lineWidth = Math.max(2, fontSize * 0.08); // Proportional border width
			ctx.lineJoin = 'round';
			ctx.miterLimit = 2;
			ctx.strokeText(text, textX, textY);
			
			// Then draw the filled text on top
			ctx.fillStyle = fontColor;
			ctx.fillText(text, textX, textY);

			// Convert to data URL
			return canvas.toDataURL('image/png');
		};

		// Load background image if provided
		if (options.backgroundUrl) {
			try {
				const bgImg = await loadImage(options.backgroundUrl);
				resolve(renderDiceFace(bgImg));
			} catch (err) {
				reject(new Error(`Failed to load background image: ${err}`));
			}
		} else {
			// Fallback: draw a simple colored background
			ctx.fillStyle = '#4a9eff';
			ctx.fillRect(0, 0, size, size);
			resolve(renderDiceFace());
		}
	});
}

/**
 * Generates a dice side image as an SVG data URL (fallback)
 */
export function generateDiceSideSVG(options: DiceSideOptions): string {
	const size = options.size ?? 800;
	const fontSize = options.fontSize ?? size * 0.5;
	const fontColor = options.fontColor ?? '#ffffff';
	const fontFamily = options.fontFamily ?? '"Bebas Neue", "Impact", "Arial Black", sans-serif';

	const svg = `
		<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
			${options.backgroundUrl
				? `<image href="${options.backgroundUrl}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" />`
				: `<rect width="${size}" height="${size}" fill="#4a9eff" />`
			}
			<text 
				x="${size / 2}" 
				y="${size / 2}" 
				font-family="${fontFamily}" 
				font-size="${fontSize}" 
				fill="${fontColor}" 
				stroke="#000000"
				stroke-width="${Math.max(2, fontSize * 0.08)}"
				stroke-linejoin="round"
				text-anchor="middle" 
				dominant-baseline="middle"
				paint-order="stroke fill"
			>${String(options.text)}</text>
		</svg>
	`.trim();

	return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generates a dice side image, preferring Canvas API but falling back to SVG
 */
export async function generateDiceSide(options: DiceSideOptions): Promise<string> {
	try {
		return await generateDiceSideCanvas(options);
	} catch (err) {
		console.warn('Canvas generation failed, falling back to SVG:', err);
		return generateDiceSideSVG(options);
	}
}
