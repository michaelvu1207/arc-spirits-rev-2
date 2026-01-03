/**
 * Generates a rune icon by compositing an origin icon over a custom background
 */

export interface RuneIconOptions {
	originIconUrl: string | null;
	originIconEmoji: string | null;
	backgroundUrl?: string | null;
	size?: number;
}

function drawIconWithOutline(
	ctx: CanvasRenderingContext2D,
	source: CanvasImageSource,
	drawX: number,
	drawY: number,
	drawW: number,
	drawH: number,
	outlinePx: number,
	outlineColor: string
) {
	const outline = Math.max(0, Math.round(outlinePx));
	if (outline === 0) {
		ctx.drawImage(source, drawX, drawY, drawW, drawH);
		return;
	}

	const maskCanvas = document.createElement('canvas');
	maskCanvas.width = Math.max(1, Math.round(drawW));
	maskCanvas.height = Math.max(1, Math.round(drawH));
	const maskCtx = maskCanvas.getContext('2d');
	if (!maskCtx) {
		ctx.drawImage(source, drawX, drawY, drawW, drawH);
		return;
	}

	maskCtx.drawImage(source, 0, 0, maskCanvas.width, maskCanvas.height);
	maskCtx.globalCompositeOperation = 'source-in';
	maskCtx.fillStyle = outlineColor;
	maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
	maskCtx.globalCompositeOperation = 'source-over';

	for (let dy = -outline; dy <= outline; dy++) {
		for (let dx = -outline; dx <= outline; dx++) {
			if (dx === 0 && dy === 0) continue;
			if (dx * dx + dy * dy > outline * outline) continue;
			ctx.drawImage(maskCanvas, drawX + dx, drawY + dy, drawW, drawH);
		}
	}

	ctx.drawImage(source, drawX, drawY, drawW, drawH);
}

/**
 * Creates an SVG data URL for a rune icon with a custom background
 */
export function generateRuneIconSVG(options: RuneIconOptions): string {
	const size = options.size ?? 800; // Default to 800x800
	const padding = size * 0.1; // 10% padding
	const iconSize = size - padding * 2;
	const center = size / 2;

	// Background size: 50% bigger than canvas
	const bgSize = size * 1.5;
	const bgOffset = (bgSize - size) / 2; // Negative offset to center larger background

	// Icon size: 30% smaller
	const scaledIconSize = iconSize * 0.7;
	const iconPadding = (iconSize - scaledIconSize) / 2;
	const canvasRadius = size / 2; // Radius for clipping the entire rune icon to a circle
	const iconOutlinePx = Math.max(2, Math.round(scaledIconSize * 0.03));
	const iconOutlineColor = '#2b1a12';

	// Determine background content
	let backgroundContent = '';
	if (options.backgroundUrl) {
		// Background image 50% bigger, centered
		backgroundContent = `<image href="${options.backgroundUrl}" x="${-bgOffset}" y="${-bgOffset}" width="${bgSize}" height="${bgSize}" preserveAspectRatio="xMidYMid slice" />`;
	} else {
		// Fallback to white hexagon
		const iconRadius = iconSize / 2;
		const hexRadius = iconRadius * 1.5;
		const hexPoints: string[] = [];
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i - Math.PI / 6;
			const x = center + hexRadius * Math.cos(angle);
			const y = center + hexRadius * Math.sin(angle);
			hexPoints.push(`${x},${y}`);
		}
		const hexPath = hexPoints.join(' ');
		backgroundContent = `<polygon points="${hexPath}" fill="white" stroke="rgba(0,0,0,0.1)" stroke-width="1" />`;
	}

	// Determine what to display in the center (30% smaller, NOT clipped to circle)
	let centerContent = '';
	if (options.originIconUrl) {
		// Use image - preserve aspect ratio with xMidYMid meet, 30% smaller
		const iconX = padding + iconPadding;
		const iconY = padding + iconPadding;
		centerContent = `<image href="${options.originIconUrl}" x="${iconX}" y="${iconY}" width="${scaledIconSize}" height="${scaledIconSize}" preserveAspectRatio="xMidYMid meet" filter="url(#iconOutline)" />`;
	} else if (options.originIconEmoji) {
		// Use emoji/text (rendered as text), 30% smaller
		centerContent = `<text x="${center}" y="${center + scaledIconSize * 0.35}" font-size="${scaledIconSize * 0.7}" text-anchor="middle" dominant-baseline="middle" filter="url(#iconOutline)">${options.originIconEmoji}</text>`;
	}

	const svg = `
		<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
			<defs>
				<clipPath id="runeCircle">
					<circle cx="${center}" cy="${center}" r="${canvasRadius}" />
				</clipPath>
				<filter id="iconOutline" x="0" y="0" width="${size}" height="${size}" filterUnits="userSpaceOnUse">
					<feMorphology in="SourceAlpha" operator="dilate" radius="${iconOutlinePx}" result="dilated" />
					<feFlood flood-color="${iconOutlineColor}" result="flood" />
					<feComposite in="flood" in2="dilated" operator="in" result="outline" />
					<feMerge>
						<feMergeNode in="outline" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>
			<g clip-path="url(#runeCircle)">
				${backgroundContent}
				${centerContent}
			</g>
		</svg>
	`.trim();

	return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generates a rune icon using Canvas API (for better image support)
 */
export async function generateRuneIconCanvas(
	options: RuneIconOptions
): Promise<string> {
	const size = options.size ?? 800; // Default to 800x800
	const padding = size * 0.1;
	const iconSize = size - padding * 2;
	const center = size / 2;

	// Create canvas
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Could not get canvas context');
	}

	// Background size: 50% bigger than canvas
	const bgSize = size * 1.5;
	const bgOffset = (bgSize - size) / 2; // Center the larger background

	// Draw background image if provided, otherwise draw white hexagon
	if (options.backgroundUrl) {
		try {
			const bgImg = new Image();
			bgImg.crossOrigin = 'anonymous';
			await new Promise((resolve, reject) => {
				bgImg.onload = resolve;
				bgImg.onerror = reject;
				bgImg.src = options.backgroundUrl!;
			});
			// Draw background image 50% bigger, centered
			ctx.drawImage(bgImg, -bgOffset, -bgOffset, bgSize, bgSize);
		} catch (err) {
			console.warn('Failed to load background image, falling back to hexagon:', err);
			// Fallback to white hexagon
			const iconRadius = iconSize / 2;
			const hexRadius = iconRadius * 1.5;
			ctx.fillStyle = 'white';
			ctx.strokeStyle = 'rgba(0,0,0,0.1)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			for (let i = 0; i < 6; i++) {
				const angle = (Math.PI / 3) * i - Math.PI / 6;
				const x = center + hexRadius * Math.cos(angle);
				const y = center + hexRadius * Math.sin(angle);
				if (i === 0) {
					ctx.moveTo(x, y);
				} else {
					ctx.lineTo(x, y);
				}
			}
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
	} else {
		// Draw white hexagon background - hexagon is 50% bigger than icon
		const iconRadius = iconSize / 2;
		const hexRadius = iconRadius * 1.5; // 50% bigger
		ctx.fillStyle = 'white';
		ctx.strokeStyle = 'rgba(0,0,0,0.1)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i - Math.PI / 6;
			const x = center + hexRadius * Math.cos(angle);
			const y = center + hexRadius * Math.sin(angle);
			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}

	// Icon size: 30% smaller than original iconSize
	const scaledIconSize = iconSize * 0.7;
	const iconPadding = (iconSize - scaledIconSize) / 2;
	const iconOutlinePx = Math.max(2, Math.round(scaledIconSize * 0.03));
	const iconOutlineColor = '#2b1a12';

	// Draw origin icon centered over background (NOT clipped to circle)
	if (options.originIconUrl) {
		try {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = reject;
				img.src = options.originIconUrl!;
			});

			// Draw image centered, preserving aspect ratio, 30% smaller
			const imgAspect = img.width / img.height;
			const targetAspect = scaledIconSize / scaledIconSize;
			let drawWidth = scaledIconSize;
			let drawHeight = scaledIconSize;
			let drawX = padding + iconPadding;
			let drawY = padding + iconPadding;

			if (imgAspect > targetAspect) {
				// Image is wider - fit to height
				drawWidth = scaledIconSize * imgAspect;
				drawX = center - drawWidth / 2;
			} else {
				// Image is taller - fit to width
				drawHeight = scaledIconSize / imgAspect;
				drawY = center - drawHeight / 2;
			}

			drawIconWithOutline(ctx, img, drawX, drawY, drawWidth, drawHeight, iconOutlinePx, iconOutlineColor);
		} catch (err) {
			console.warn('Failed to load origin icon image:', err);
			// Fallback to emoji if image fails
			if (options.originIconEmoji) {
				ctx.font = `${scaledIconSize * 0.7}px sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.lineJoin = 'round';
				ctx.strokeStyle = iconOutlineColor;
				ctx.lineWidth = iconOutlinePx * 2;
				ctx.strokeText(options.originIconEmoji, center, center);
				ctx.fillStyle = '#1e293b';
				ctx.fillText(options.originIconEmoji, center, center);
			}
		}
	} else if (options.originIconEmoji) {
		// Draw emoji with normalization - render on temp canvas first to crop and normalize
		const emojiCanvas = document.createElement('canvas');
		// Use a larger canvas for better emoji rendering quality
		const emojiCanvasSize = size * 2;
		emojiCanvas.width = emojiCanvasSize;
		emojiCanvas.height = emojiCanvasSize;
		const emojiCtx = emojiCanvas.getContext('2d');
		if (!emojiCtx) {
			throw new Error('Could not get emoji canvas context');
		}

		// Render emoji on temp canvas with large font size
		emojiCtx.fillStyle = '#1e293b';
		const emojiFontSize = emojiCanvasSize * 0.6; // Large font for better quality
		emojiCtx.font = `${emojiFontSize}px sans-serif`;
		emojiCtx.textAlign = 'center';
		emojiCtx.textBaseline = 'middle';
		emojiCtx.fillText(options.originIconEmoji, emojiCanvasSize / 2, emojiCanvasSize / 2);

		// Get image data to find bounding box
		const emojiImageData = emojiCtx.getImageData(0, 0, emojiCanvasSize, emojiCanvasSize);
		const emojiData = emojiImageData.data;

		// Find bounding box of non-transparent pixels
		let minX = emojiCanvasSize;
		let minY = emojiCanvasSize;
		let maxX = 0;
		let maxY = 0;

		for (let y = 0; y < emojiCanvasSize; y++) {
			for (let x = 0; x < emojiCanvasSize; x++) {
				const idx = (y * emojiCanvasSize + x) * 4;
				const a = emojiData[idx + 3]; // Alpha channel

				// Check if pixel is not transparent
				if (a > 10) { // Almost transparent threshold
					minX = Math.min(minX, x);
					minY = Math.min(minY, y);
					maxX = Math.max(maxX, x);
					maxY = Math.max(maxY, y);
				}
			}
		}

		// If we found content, crop and normalize
		if (minX < maxX && minY < maxY) {
			// Add small padding
			const padding = 4;
			minX = Math.max(0, minX - padding);
			minY = Math.max(0, minY - padding);
			maxX = Math.min(emojiCanvasSize, maxX + padding);
			maxY = Math.min(emojiCanvasSize, maxY + padding);

			const emojiWidth = maxX - minX;
			const emojiHeight = maxY - minY;

			// Create cropped emoji canvas
			const croppedEmojiCanvas = document.createElement('canvas');
			croppedEmojiCanvas.width = emojiWidth;
			croppedEmojiCanvas.height = emojiHeight;
			const croppedCtx = croppedEmojiCanvas.getContext('2d');
			if (!croppedCtx) {
				throw new Error('Could not get cropped canvas context');
			}

			// Draw cropped emoji
			croppedCtx.drawImage(emojiCanvas, minX, minY, emojiWidth, emojiHeight, 0, 0, emojiWidth, emojiHeight);

			// Normalize size - scale to fit within scaledIconSize while maintaining aspect ratio
			// Target size is 70% of iconSize (scaledIconSize)
			const targetSize = scaledIconSize;
			const scale = Math.min(targetSize / emojiWidth, targetSize / emojiHeight);

			const normalizedWidth = emojiWidth * scale;
			const normalizedHeight = emojiHeight * scale;

			// Draw normalized emoji centered on the main canvas
			const drawX = center - normalizedWidth / 2;
			const drawY = center - normalizedHeight / 2;

			drawIconWithOutline(
				ctx,
				croppedEmojiCanvas,
				drawX,
				drawY,
				normalizedWidth,
				normalizedHeight,
				iconOutlinePx,
				iconOutlineColor
			);
		} else {
			// Fallback: draw emoji normally if bounding box detection failed
			ctx.font = `${scaledIconSize * 0.7}px sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineJoin = 'round';
			ctx.strokeStyle = iconOutlineColor;
			ctx.lineWidth = iconOutlinePx * 2;
			ctx.strokeText(options.originIconEmoji, center, center);
			ctx.fillStyle = '#1e293b';
			ctx.fillText(options.originIconEmoji, center, center);
		}
	}

	// Clip the entire canvas to a circle (the rune icon itself should be circular)
	const canvasRadius = size / 2;
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = size;
	tempCanvas.height = size;
	const tempCtx = tempCanvas.getContext('2d');
	if (!tempCtx) {
		throw new Error('Could not get temp canvas context');
	}

	// Create circular clipping path
	tempCtx.beginPath();
	tempCtx.arc(canvasRadius, canvasRadius, canvasRadius, 0, Math.PI * 2);
	tempCtx.clip();

	// Draw the original canvas content onto the temp canvas
	tempCtx.drawImage(canvas, 0, 0);

	return tempCanvas.toDataURL('image/png');
}

/**
 * Main function to generate rune icon - uses Canvas for better quality
 */
export async function generateRuneIcon(options: RuneIconOptions): Promise<string> {
	try {
		return await generateRuneIconCanvas(options);
	} catch (err) {
		console.warn('Canvas generation failed, falling back to SVG:', err);
		return generateRuneIconSVG(options);
	}
}
