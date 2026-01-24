/**
 * Style Renderer - Canvas drawing functions for each unique card style
 * Implements the visual identity defined in cardStyleDefinitions.ts
 */

import type { CardStyleDefinition } from '$lib/types/cardStyleDefinitions';

// ============================================================================
// FRAME DRAWING FUNCTIONS
// ============================================================================

export function drawStyledFrame(
	ctx: CanvasRenderingContext2D,
	style: CardStyleDefinition,
	width: number,
	height: number
): void {
	const { frame } = style;

	switch (frame.type) {
		case 'double-line':
			drawDoubleLineFrame(ctx, frame, width, height);
			break;
		case 'cracked':
			drawCrackedFrame(ctx, frame, width, height);
			break;
		case 'crystalline':
			drawCrystallineFrame(ctx, frame, width, height);
			break;
		case 'organic':
			drawOrganicFrame(ctx, frame, width, height);
			break;
		case 'dissolving':
			drawDissolvingFrame(ctx, frame, width, height);
			break;
		case 'radiant':
			drawRadiantFrame(ctx, frame, width, height);
			break;
		case 'spiked':
			drawSpikedFrame(ctx, frame, width, height);
			break;
		case 'warped':
			drawWarpedFrame(ctx, frame, width, height);
			break;
		case 'simple':
			drawSimpleFrame(ctx, frame, width, height);
			break;
		case 'letterbox':
			drawLetterboxFrame(ctx, frame, width, height);
			break;
		case 'codex':
			drawCodexFrame(ctx, frame, width, height);
			break;
		case 'postage':
			drawPostageFrame(ctx, frame, width, height);
			break;
		case 'minimal':
			drawMinimalFrame(ctx, frame, width, height);
			break;
		case 'noir':
			drawNoirFrame(ctx, frame, width, height);
			break;
		case 'deco':
			drawDecoFrame(ctx, frame, width, height);
			break;
		case 'blocky':
			drawBlockyFrame(ctx, frame, width, height);
			break;
	}
}

function drawDoubleLineFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;
	const colorFade = frame.secondaryColor ?? 'transparent';

	// Outer vertical lines
	const vertGrad = ctx.createLinearGradient(0, 40, 0, h - 40);
	vertGrad.addColorStop(0, 'transparent');
	vertGrad.addColorStop(0.2, colorFade);
	vertGrad.addColorStop(0.5, color);
	vertGrad.addColorStop(0.8, colorFade);
	vertGrad.addColorStop(1, 'transparent');

	ctx.fillStyle = vertGrad;
	ctx.fillRect(24, 40, frame.thickness, h - 80);
	ctx.fillRect(w - 27, 40, frame.thickness, h - 80);

	// Horizontal lines
	const horizGrad = ctx.createLinearGradient(40, 0, w - 40, 0);
	horizGrad.addColorStop(0, 'transparent');
	horizGrad.addColorStop(0.2, colorFade);
	horizGrad.addColorStop(0.5, color);
	horizGrad.addColorStop(0.8, colorFade);
	horizGrad.addColorStop(1, 'transparent');

	ctx.fillStyle = horizGrad;
	ctx.fillRect(40, 20, w - 80, 2);
	ctx.fillRect(40, h - 22, w - 80, 2);

	// Flourish corners
	if (frame.cornerStyle === 'flourish') {
		drawFlourishCorners(ctx, color, w, h);
	}
}

function drawCrackedFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	// Jagged edge effect - draw cracked borders
	ctx.strokeStyle = color;
	ctx.lineWidth = frame.thickness;
	ctx.lineCap = 'round';

	// Left edge with cracks
	ctx.beginPath();
	ctx.moveTo(20, 30);
	for (let y = 30; y < h - 30; y += 15) {
		const jitter = (Math.random() - 0.5) * 8;
		ctx.lineTo(20 + jitter, y);
	}
	ctx.stroke();

	// Right edge
	ctx.beginPath();
	ctx.moveTo(w - 20, 30);
	for (let y = 30; y < h - 30; y += 15) {
		const jitter = (Math.random() - 0.5) * 8;
		ctx.lineTo(w - 20 + jitter, y);
	}
	ctx.stroke();

	// Draw crack patterns emanating from corners
	drawCrackPatterns(ctx, frame.secondaryColor ?? color, w, h);
}

function drawCrystallineFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	// Hexagonal crystalline border
	ctx.strokeStyle = color;
	ctx.lineWidth = frame.thickness;

	// Top edge with crystal points
	ctx.beginPath();
	ctx.moveTo(30, 25);
	for (let x = 50; x < w - 50; x += 40) {
		ctx.lineTo(x, 18);
		ctx.lineTo(x + 20, 25);
	}
	ctx.lineTo(w - 30, 25);
	ctx.stroke();

	// Bottom edge with icicle drips
	ctx.beginPath();
	ctx.moveTo(30, h - 25);
	for (let x = 50; x < w - 50; x += 30) {
		ctx.lineTo(x, h - 25);
		ctx.lineTo(x + 8, h - 15);
		ctx.lineTo(x + 16, h - 25);
	}
	ctx.lineTo(w - 30, h - 25);
	ctx.stroke();

	// Hexagonal corners
	drawHexagonalCorners(ctx, color, w, h);
}

function drawOrganicFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	// Vine/root like borders with curves
	ctx.strokeStyle = color;
	ctx.lineWidth = frame.thickness;
	ctx.lineCap = 'round';

	// Left vine
	ctx.beginPath();
	ctx.moveTo(25, 40);
	ctx.bezierCurveTo(20, h * 0.25, 30, h * 0.5, 22, h * 0.75);
	ctx.bezierCurveTo(28, h * 0.85, 20, h - 50, 25, h - 40);
	ctx.stroke();

	// Right vine
	ctx.beginPath();
	ctx.moveTo(w - 25, 40);
	ctx.bezierCurveTo(w - 20, h * 0.3, w - 30, h * 0.6, w - 22, h * 0.8);
	ctx.bezierCurveTo(w - 28, h * 0.9, w - 20, h - 50, w - 25, h - 40);
	ctx.stroke();

	// Draw small leaves at corners
	drawVineCorners(ctx, color, w, h);
}

function drawDissolvingFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	// Fading, misty edges - no hard lines
	for (let i = 0; i < 20; i++) {
		const alpha = 0.15 - i * 0.007;
		if (alpha <= 0) break;

		ctx.fillStyle = color.replace(/[\d.]+\)$/, `${alpha})`);

		// Left fade
		ctx.fillRect(15 + i * 2, 30 + i * 3, 3, h - 60 - i * 6);
		// Right fade
		ctx.fillRect(w - 18 - i * 2, 30 + i * 3, 3, h - 60 - i * 6);
	}

	// Mist corners - soft circular fades
	const mistGrad = ctx.createRadialGradient(30, 30, 0, 30, 30, 40);
	mistGrad.addColorStop(0, color);
	mistGrad.addColorStop(1, 'transparent');
	ctx.fillStyle = mistGrad;
	ctx.fillRect(0, 0, 70, 70);

	const mistGrad2 = ctx.createRadialGradient(w - 30, 30, 0, w - 30, 30, 40);
	mistGrad2.addColorStop(0, color);
	mistGrad2.addColorStop(1, 'transparent');
	ctx.fillStyle = mistGrad2;
	ctx.fillRect(w - 70, 0, 70, 70);
}

function drawRadiantFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	// Golden rays emanating from corners
	const rayCount = 5;

	// Top-left rays
	for (let i = 0; i < rayCount; i++) {
		const angle = (Math.PI / 4) * (i / rayCount);
		const rayGrad = ctx.createLinearGradient(0, 0, Math.cos(angle) * 80, Math.sin(angle) * 80);
		rayGrad.addColorStop(0, color);
		rayGrad.addColorStop(1, 'transparent');
		ctx.fillStyle = rayGrad;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(Math.cos(angle - 0.05) * 100, Math.sin(angle - 0.05) * 100);
		ctx.lineTo(Math.cos(angle + 0.05) * 100, Math.sin(angle + 0.05) * 100);
		ctx.closePath();
		ctx.fill();
	}

	// Ornate baroque corners
	ctx.strokeStyle = color;
	ctx.lineWidth = frame.thickness;
	drawBaroqueCorners(ctx, color, w, h);
}

function drawSpikedFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	ctx.fillStyle = color;

	// Top spikes
	for (let x = 30; x < w - 30; x += 25) {
		ctx.beginPath();
		ctx.moveTo(x, 20);
		ctx.lineTo(x + 8, 8);
		ctx.lineTo(x + 16, 20);
		ctx.fill();
	}

	// Bottom spikes
	for (let x = 30; x < w - 30; x += 25) {
		ctx.beginPath();
		ctx.moveTo(x, h - 20);
		ctx.lineTo(x + 8, h - 8);
		ctx.lineTo(x + 16, h - 20);
		ctx.fill();
	}

	// Side thorns
	for (let y = 40; y < h - 40; y += 30) {
		// Left
		ctx.beginPath();
		ctx.moveTo(20, y);
		ctx.lineTo(10, y + 10);
		ctx.lineTo(20, y + 20);
		ctx.fill();
		// Right
		ctx.beginPath();
		ctx.moveTo(w - 20, y);
		ctx.lineTo(w - 10, y + 10);
		ctx.lineTo(w - 20, y + 20);
		ctx.fill();
	}
}

function drawWarpedFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	ctx.strokeStyle = color;
	ctx.lineWidth = frame.thickness;

	// Non-euclidean warped border - curves that shouldn't connect but do
	ctx.beginPath();
	// Top - wavy
	ctx.moveTo(20, 25);
	ctx.bezierCurveTo(w * 0.3, 15, w * 0.7, 35, w - 20, 25);
	ctx.stroke();

	// Bottom - inverse wave
	ctx.beginPath();
	ctx.moveTo(20, h - 25);
	ctx.bezierCurveTo(w * 0.3, h - 35, w * 0.7, h - 15, w - 20, h - 25);
	ctx.stroke();

	// Impossible geometry corners
	drawImpossibleCorners(ctx, color, w, h);
}

function drawSimpleFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	ctx.strokeStyle = color;
	ctx.lineWidth = frame.thickness;
	ctx.strokeRect(20, 20, w - 40, h - 40);

	if (frame.cornerStyle === 'subtle') {
		// Small corner accents
		ctx.fillStyle = color;
		const size = 8;
		ctx.fillRect(20, 20, size, size);
		ctx.fillRect(w - 20 - size, 20, size, size);
		ctx.fillRect(20, h - 20 - size, size, size);
		ctx.fillRect(w - 20 - size, h - 20 - size, size, size);
	}
}

function drawLetterboxFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	// Cinematic letterbox bars
	ctx.fillStyle = '#000000';
	ctx.fillRect(0, 0, w, 30);
	ctx.fillRect(0, h - 30, w, 30);

	// Film sprocket holes
	ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
	for (let x = 10; x < w; x += 30) {
		ctx.fillRect(x, 8, 12, 14);
		ctx.fillRect(x, h - 22, 12, 14);
	}
}

function drawCodexFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	// Book-like margins
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;

	// Outer border
	ctx.strokeRect(15, 15, w - 30, h - 30);
	// Inner margin line
	ctx.strokeRect(25, 25, w - 50, h - 50);

	// Corner brackets
	const bracketSize = 15;
	ctx.lineWidth = frame.thickness;

	// Top-left
	ctx.beginPath();
	ctx.moveTo(15, 15 + bracketSize);
	ctx.lineTo(15, 15);
	ctx.lineTo(15 + bracketSize, 15);
	ctx.stroke();

	// Top-right
	ctx.beginPath();
	ctx.moveTo(w - 15 - bracketSize, 15);
	ctx.lineTo(w - 15, 15);
	ctx.lineTo(w - 15, 15 + bracketSize);
	ctx.stroke();

	// Bottom-left
	ctx.beginPath();
	ctx.moveTo(15, h - 15 - bracketSize);
	ctx.lineTo(15, h - 15);
	ctx.lineTo(15 + bracketSize, h - 15);
	ctx.stroke();

	// Bottom-right
	ctx.beginPath();
	ctx.moveTo(w - 15 - bracketSize, h - 15);
	ctx.lineTo(w - 15, h - 15);
	ctx.lineTo(w - 15, h - 15 - bracketSize);
	ctx.stroke();
}

function drawPostageFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	// Perforated stamp edge
	ctx.fillStyle = color;

	// Top edge perforations
	for (let x = 20; x < w - 20; x += 12) {
		ctx.beginPath();
		ctx.arc(x, 15, 4, 0, Math.PI * 2);
		ctx.fill();
	}

	// Bottom edge perforations
	for (let x = 20; x < w - 20; x += 12) {
		ctx.beginPath();
		ctx.arc(x, h - 15, 4, 0, Math.PI * 2);
		ctx.fill();
	}

	// Side perforations
	for (let y = 20; y < h - 20; y += 12) {
		ctx.beginPath();
		ctx.arc(15, y, 4, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(w - 15, y, 4, 0, Math.PI * 2);
		ctx.fill();
	}

	// Rounded inner border
	ctx.strokeStyle = frame.secondaryColor ?? color;
	ctx.lineWidth = 2;
	roundedRect(ctx, 25, 25, w - 50, h - 50, 10);
	ctx.stroke();
}

function drawMinimalFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	// Single thin line - very minimal
	ctx.strokeStyle = color;
	ctx.lineWidth = frame.thickness;
	ctx.strokeRect(30, 30, w - 60, h - 60);
}

function drawNoirFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	// Heavy black borders with white accent
	ctx.fillStyle = '#000000';
	ctx.fillRect(0, 0, w, 15);
	ctx.fillRect(0, h - 15, w, 15);
	ctx.fillRect(0, 0, 15, h);
	ctx.fillRect(w - 15, 0, 15, h);

	// White inner line
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.strokeRect(18, 18, w - 36, h - 36);

	// Spotlight circle hint
	const spotlight = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.4);
	spotlight.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
	spotlight.addColorStop(1, 'transparent');
	ctx.fillStyle = spotlight;
	ctx.fillRect(0, 0, w, h);
}

function drawDecoFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;

	ctx.strokeStyle = color;
	ctx.lineWidth = frame.thickness;

	// Art deco geometric corners
	const size = 40;

	// Top-left corner
	ctx.beginPath();
	ctx.moveTo(15, 15 + size);
	ctx.lineTo(15, 15);
	ctx.lineTo(15 + size, 15);
	ctx.moveTo(25, 15);
	ctx.lineTo(25, 25);
	ctx.lineTo(15, 25);
	ctx.stroke();

	// Top-right corner
	ctx.beginPath();
	ctx.moveTo(w - 15 - size, 15);
	ctx.lineTo(w - 15, 15);
	ctx.lineTo(w - 15, 15 + size);
	ctx.moveTo(w - 25, 15);
	ctx.lineTo(w - 25, 25);
	ctx.lineTo(w - 15, 25);
	ctx.stroke();

	// Bottom corners (mirrored)
	ctx.beginPath();
	ctx.moveTo(15, h - 15 - size);
	ctx.lineTo(15, h - 15);
	ctx.lineTo(15 + size, h - 15);
	ctx.moveTo(25, h - 15);
	ctx.lineTo(25, h - 25);
	ctx.lineTo(15, h - 25);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(w - 15 - size, h - 15);
	ctx.lineTo(w - 15, h - 15);
	ctx.lineTo(w - 15, h - 15 - size);
	ctx.moveTo(w - 25, h - 15);
	ctx.lineTo(w - 25, h - 25);
	ctx.lineTo(w - 15, h - 25);
	ctx.stroke();

	// Deco fan shapes at top center
	drawDecoFan(ctx, color, w / 2, 8, 30);
}

function drawBlockyFrame(ctx: CanvasRenderingContext2D, frame: CardStyleDefinition['frame'], w: number, h: number) {
	const color = frame.color;
	const secondary = frame.secondaryColor ?? color;

	// Heavy blocky borders
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, w, frame.thickness);
	ctx.fillRect(0, h - frame.thickness, w, frame.thickness);
	ctx.fillRect(0, 0, frame.thickness, h);
	ctx.fillRect(w - frame.thickness, 0, frame.thickness, h);

	// Corner blocks
	ctx.fillStyle = secondary;
	const blockSize = 20;
	ctx.fillRect(0, 0, blockSize, blockSize);
	ctx.fillRect(w - blockSize, 0, blockSize, blockSize);
	ctx.fillRect(0, h - blockSize, blockSize, blockSize);
	ctx.fillRect(w - blockSize, h - blockSize, blockSize, blockSize);
}

// ============================================================================
// CORNER DRAWING HELPERS
// ============================================================================

function drawFlourishCorners(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
	ctx.fillStyle = color;

	// L-shaped flourish corners
	const corners = [
		{ x: 20, y: 16 },
		{ x: w - 20, y: 16 },
		{ x: 20, y: h - 16 },
		{ x: w - 20, y: h - 16 }
	];

	for (const corner of corners) {
		const flipX = corner.x > w / 2 ? -1 : 1;
		const flipY = corner.y > h / 2 ? -1 : 1;

		ctx.fillRect(corner.x, corner.y, 12 * flipX, 2);
		ctx.fillRect(corner.x, corner.y, 2, 12 * flipY);
	}
}

function drawCrackPatterns(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;
	ctx.globalAlpha = 0.3;

	// Random crack lines
	for (let i = 0; i < 8; i++) {
		const startX = Math.random() > 0.5 ? 0 : w;
		const startY = Math.random() * h;
		ctx.beginPath();
		ctx.moveTo(startX, startY);
		let x = startX;
		let y = startY;
		for (let j = 0; j < 5; j++) {
			x += (Math.random() - 0.5) * 40;
			y += (Math.random() - 0.5) * 30;
			ctx.lineTo(x, y);
		}
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}

function drawHexagonalCorners(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
	ctx.fillStyle = color;

	// Hexagon-like corner accents
	const drawHex = (cx: number, cy: number, size: number) => {
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i - Math.PI / 6;
			const x = cx + Math.cos(angle) * size;
			const y = cy + Math.sin(angle) * size;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fill();
	};

	drawHex(30, 30, 8);
	drawHex(w - 30, 30, 8);
	drawHex(30, h - 30, 8);
	drawHex(w - 30, h - 30, 8);
}

function drawVineCorners(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
	ctx.fillStyle = color;
	ctx.globalAlpha = 0.6;

	// Small leaf shapes at corners
	const drawLeaf = (x: number, y: number, angle: number) => {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(angle);
		ctx.beginPath();
		ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	};

	drawLeaf(30, 35, 0.5);
	drawLeaf(w - 30, 35, -0.5);
	drawLeaf(30, h - 35, -0.5);
	drawLeaf(w - 30, h - 35, 0.5);

	ctx.globalAlpha = 1;
}

function drawBaroqueCorners(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;

	// Ornate swirl corners
	const drawSwirl = (x: number, y: number, flipX: number, flipY: number) => {
		ctx.beginPath();
		ctx.moveTo(x, y + 20 * flipY);
		ctx.quadraticCurveTo(x, y, x + 20 * flipX, y);
		ctx.stroke();

		// Inner curl
		ctx.beginPath();
		ctx.arc(x + 10 * flipX, y + 10 * flipY, 5, 0, Math.PI * 1.5);
		ctx.stroke();
	};

	drawSwirl(20, 20, 1, 1);
	drawSwirl(w - 20, 20, -1, 1);
	drawSwirl(20, h - 20, 1, -1);
	drawSwirl(w - 20, h - 20, -1, -1);
}

function drawImpossibleCorners(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;

	// Impossible triangle-like corners
	const size = 20;

	// These shapes create optical illusions
	ctx.beginPath();
	ctx.moveTo(15, 15);
	ctx.lineTo(15 + size, 15);
	ctx.lineTo(15, 15 + size);
	ctx.lineTo(15 + size, 15 + size);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(w - 15, 15);
	ctx.lineTo(w - 15 - size, 15);
	ctx.lineTo(w - 15, 15 + size);
	ctx.lineTo(w - 15 - size, 15 + size);
	ctx.stroke();
}

function drawDecoFan(ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, size: number) {
	ctx.fillStyle = color;

	// Art deco sunburst fan
	for (let i = 0; i < 7; i++) {
		const angle = (Math.PI / 8) * i - Math.PI / 2;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(angle - 0.08) * size, cy + Math.sin(angle - 0.08) * size);
		ctx.lineTo(cx + Math.cos(angle + 0.08) * size, cy + Math.sin(angle + 0.08) * size);
		ctx.closePath();
		ctx.fill();
	}
}

// ============================================================================
// PARTICLE DRAWING FUNCTIONS
// ============================================================================

export function drawStyledParticles(
	ctx: CanvasRenderingContext2D,
	style: CardStyleDefinition,
	width: number,
	height: number
): void {
	const { particles } = style;
	if (particles.type === 'none' || particles.count === 0) return;

	for (let i = 0; i < particles.count; i++) {
		const x = Math.random() * width;
		const y = Math.random() * height;
		const size = particles.size[0] + Math.random() * (particles.size[1] - particles.size[0]);
		const opacity = particles.opacity[0] + Math.random() * (particles.opacity[1] - particles.opacity[0]);

		ctx.globalAlpha = opacity;

		switch (particles.type) {
			case 'runes':
				drawRuneParticle(ctx, x, y, size, particles.color);
				break;
			case 'embers':
				drawEmberParticle(ctx, x, y, size, particles.color);
				break;
			case 'snowflakes':
				drawSnowflakeParticle(ctx, x, y, size, particles.color);
				break;
			case 'leaves':
				drawLeafParticle(ctx, x, y, size, particles.color);
				break;
			case 'wisps':
				drawWispParticle(ctx, x, y, size, particles.color);
				break;
			case 'light-rays':
				drawLightRayParticle(ctx, x, y, size, particles.color);
				break;
			case 'blood-drops':
				drawBloodDropParticle(ctx, x, y, size, particles.color);
				break;
			case 'stars':
				drawStarParticle(ctx, x, y, size, particles.color);
				break;
			case 'dust':
				drawDustParticle(ctx, x, y, size, particles.color);
				break;
			case 'sparkles':
				drawSparkleParticle(ctx, x, y, size, particles.color);
				break;
		}
	}

	ctx.globalAlpha = 1;
}

function drawRuneParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(x, y, size, 0, Math.PI * 2);
	ctx.fill();

	// Add glow
	ctx.shadowColor = color;
	ctx.shadowBlur = size * 3;
	ctx.beginPath();
	ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.shadowBlur = 0;
}

function drawEmberParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	// Ember with gradient from bright center to dark edge
	const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
	grad.addColorStop(0, '#ffffff');
	grad.addColorStop(0.3, color);
	grad.addColorStop(1, 'transparent');
	ctx.fillStyle = grad;
	ctx.fillRect(x - size, y - size, size * 2, size * 2);
}

function drawSnowflakeParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;

	// Simple 6-pointed snowflake
	for (let i = 0; i < 6; i++) {
		const angle = (Math.PI / 3) * i;
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
		ctx.stroke();
	}
}

function drawLeafParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.fillStyle = color;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(Math.random() * Math.PI * 2);
	ctx.beginPath();
	ctx.ellipse(0, 0, size, size * 0.4, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function drawWispParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	// Soft ethereal wisp
	const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
	grad.addColorStop(0, color);
	grad.addColorStop(0.5, color.replace(/[\d.]+\)$/, '0.3)'));
	grad.addColorStop(1, 'transparent');
	ctx.fillStyle = grad;
	ctx.fillRect(x - size, y - size, size * 2, size * 2);
}

function drawLightRayParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.fillStyle = color;
	// Small diamond/star shape
	ctx.beginPath();
	ctx.moveTo(x, y - size);
	ctx.lineTo(x + size * 0.3, y);
	ctx.lineTo(x, y + size);
	ctx.lineTo(x - size * 0.3, y);
	ctx.closePath();
	ctx.fill();
}

function drawBloodDropParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.fillStyle = color;
	// Teardrop shape
	ctx.beginPath();
	ctx.moveTo(x, y - size);
	ctx.quadraticCurveTo(x + size, y, x, y + size);
	ctx.quadraticCurveTo(x - size, y, x, y - size);
	ctx.fill();
}

function drawStarParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(x, y, size, 0, Math.PI * 2);
	ctx.fill();

	// Cross flare
	ctx.fillRect(x - size * 2, y - 0.5, size * 4, 1);
	ctx.fillRect(x - 0.5, y - size * 2, 1, size * 4);
}

function drawDustParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(x, y, size, 0, Math.PI * 2);
	ctx.fill();
}

function drawSparkleParticle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.fillStyle = color;
	// 4-pointed star sparkle
	ctx.beginPath();
	ctx.moveTo(x, y - size);
	ctx.lineTo(x + size * 0.3, y - size * 0.3);
	ctx.lineTo(x + size, y);
	ctx.lineTo(x + size * 0.3, y + size * 0.3);
	ctx.lineTo(x, y + size);
	ctx.lineTo(x - size * 0.3, y + size * 0.3);
	ctx.lineTo(x - size, y);
	ctx.lineTo(x - size * 0.3, y - size * 0.3);
	ctx.closePath();
	ctx.fill();
}

// ============================================================================
// DIVIDER DRAWING FUNCTIONS
// ============================================================================

export function drawStyledDivider(
	ctx: CanvasRenderingContext2D,
	style: CardStyleDefinition,
	x: number,
	y: number,
	width: number
): void {
	const { divider } = style;
	const halfWidth = divider.width / 2;
	const startX = x - halfWidth;

	ctx.fillStyle = divider.color;
	ctx.strokeStyle = divider.color;

	switch (divider.type) {
		case 'wings':
			drawWingsDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'flames':
			drawFlamesDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'icicles':
			drawIciclesDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'vines':
			drawVinesDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'smoke':
			drawSmokeDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'halo':
			drawHaloDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'chains':
			drawChainsDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'tentacles':
			drawTentaclesDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'simple':
			drawSimpleDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'film-strip':
			drawFilmStripDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'ornate':
			drawOrnateDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'brush':
			drawBrushDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'dot':
			drawDotDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'slash':
			drawSlashDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'deco':
			drawDecoDivider(ctx, x, y, halfWidth, divider.color);
			break;
		case 'arrow':
			drawArrowDivider(ctx, x, y, halfWidth, divider.color);
			break;
	}
}

function drawWingsDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	// Gradient wings extending from center
	const leftGrad = ctx.createLinearGradient(x - halfWidth, y, x, y);
	leftGrad.addColorStop(0, 'transparent');
	leftGrad.addColorStop(1, color);
	ctx.fillStyle = leftGrad;
	ctx.fillRect(x - halfWidth, y - 0.5, halfWidth, 1);

	const rightGrad = ctx.createLinearGradient(x, y, x + halfWidth, y);
	rightGrad.addColorStop(0, color);
	rightGrad.addColorStop(1, 'transparent');
	ctx.fillStyle = rightGrad;
	ctx.fillRect(x, y - 0.5, halfWidth, 1);

	// Center diamond
	ctx.fillStyle = color;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(Math.PI / 4);
	ctx.fillRect(-4, -4, 8, 8);
	ctx.restore();
}

function drawFlamesDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.fillStyle = color;

	// Flame shapes along the divider
	for (let i = -halfWidth; i < halfWidth; i += 20) {
		const flameHeight = 8 + Math.random() * 8;
		ctx.beginPath();
		ctx.moveTo(x + i, y);
		ctx.quadraticCurveTo(x + i + 5, y - flameHeight, x + i + 10, y);
		ctx.fill();
	}
}

function drawIciclesDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.fillStyle = color;

	// Icicle points hanging down
	for (let i = -halfWidth; i < halfWidth; i += 15) {
		const icicleLength = 5 + Math.random() * 10;
		ctx.beginPath();
		ctx.moveTo(x + i, y);
		ctx.lineTo(x + i + 4, y);
		ctx.lineTo(x + i + 2, y + icicleLength);
		ctx.closePath();
		ctx.fill();
	}

	// Top line
	ctx.fillRect(x - halfWidth, y - 1, halfWidth * 2, 2);
}

function drawVinesDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;

	// Wavy vine line
	ctx.beginPath();
	ctx.moveTo(x - halfWidth, y);
	for (let i = -halfWidth; i < halfWidth; i += 20) {
		ctx.quadraticCurveTo(x + i + 10, y - 5, x + i + 20, y);
	}
	ctx.stroke();

	// Small leaves
	ctx.fillStyle = color;
	for (let i = -halfWidth + 30; i < halfWidth - 30; i += 40) {
		ctx.beginPath();
		ctx.ellipse(x + i, y - 3, 5, 2, -0.3, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawSmokeDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	// Soft, fading smoke effect
	for (let i = 0; i < 5; i++) {
		const alpha = 0.3 - i * 0.05;
		const smokeColor = color.replace(/[\d.]+\)$/, `${alpha})`);
		ctx.fillStyle = smokeColor;
		ctx.beginPath();
		ctx.ellipse(x, y + i * 2, halfWidth * (1 - i * 0.1), 3, 0, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawHaloDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	// Glowing halo arc
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.shadowColor = color;
	ctx.shadowBlur = 10;

	ctx.beginPath();
	ctx.arc(x, y + 30, 50, Math.PI * 1.2, Math.PI * 1.8);
	ctx.stroke();

	ctx.shadowBlur = 0;

	// Side rays
	const rayGrad = ctx.createLinearGradient(x - halfWidth, y, x, y);
	rayGrad.addColorStop(0, 'transparent');
	rayGrad.addColorStop(1, color);
	ctx.fillStyle = rayGrad;
	ctx.fillRect(x - halfWidth, y - 0.5, halfWidth, 1);

	const rayGrad2 = ctx.createLinearGradient(x, y, x + halfWidth, y);
	rayGrad2.addColorStop(0, color);
	rayGrad2.addColorStop(1, 'transparent');
	ctx.fillStyle = rayGrad2;
	ctx.fillRect(x, y - 0.5, halfWidth, 1);
}

function drawChainsDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;

	// Chain links
	for (let i = -halfWidth; i < halfWidth; i += 16) {
		ctx.beginPath();
		ctx.ellipse(x + i + 8, y, 6, 4, 0, 0, Math.PI * 2);
		ctx.stroke();
	}
}

function drawTentaclesDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.lineCap = 'round';

	// Wavy tentacle lines
	for (let t = 0; t < 3; t++) {
		const offsetY = (t - 1) * 4;
		ctx.beginPath();
		ctx.moveTo(x - halfWidth, y + offsetY);
		for (let i = -halfWidth; i < halfWidth; i += 10) {
			const wave = Math.sin(i * 0.1 + t) * 3;
			ctx.lineTo(x + i, y + offsetY + wave);
		}
		ctx.stroke();
	}
}

function drawSimpleDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	const grad = ctx.createLinearGradient(x - halfWidth, y, x + halfWidth, y);
	grad.addColorStop(0, 'transparent');
	grad.addColorStop(0.3, color);
	grad.addColorStop(0.7, color);
	grad.addColorStop(1, 'transparent');
	ctx.fillStyle = grad;
	ctx.fillRect(x - halfWidth, y - 0.5, halfWidth * 2, 1);
}

function drawFilmStripDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.fillStyle = color;

	// Film strip with perforations
	ctx.fillRect(x - halfWidth, y - 3, halfWidth * 2, 6);

	// Sprocket holes
	ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
	for (let i = -halfWidth + 10; i < halfWidth; i += 20) {
		ctx.fillRect(x + i, y - 2, 8, 4);
	}
}

function drawOrnateDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;

	// Double lines with flourishes
	ctx.beginPath();
	ctx.moveTo(x - halfWidth, y - 2);
	ctx.lineTo(x + halfWidth, y - 2);
	ctx.moveTo(x - halfWidth, y + 2);
	ctx.lineTo(x + halfWidth, y + 2);
	ctx.stroke();

	// Center ornament
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(x, y, 4, 0, Math.PI * 2);
	ctx.fill();
}

function drawBrushDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	// Watercolor brush stroke effect
	for (let i = 0; i < 3; i++) {
		const alpha = 0.5 - i * 0.15;
		ctx.fillStyle = color.replace(/[\d.]+\)$/, `${alpha})`);
		ctx.beginPath();
		ctx.ellipse(x, y + i, halfWidth * (1 - i * 0.1), 2 + i, 0, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawDotDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.fillStyle = color;

	// Three centered dots
	ctx.beginPath();
	ctx.arc(x - 10, y, 2, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(x, y, 2, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(x + 10, y, 2, 0, Math.PI * 2);
	ctx.fill();
}

function drawSlashDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.strokeStyle = color;
	ctx.lineWidth = 3;

	// Diagonal slash
	ctx.beginPath();
	ctx.moveTo(x - 20, y + 8);
	ctx.lineTo(x + 20, y - 8);
	ctx.stroke();
}

function drawDecoDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.fillStyle = color;

	// Art deco geometric divider
	// Center diamond
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(Math.PI / 4);
	ctx.fillRect(-5, -5, 10, 10);
	ctx.restore();

	// Side lines with stepped ends
	ctx.fillRect(x - halfWidth, y - 1, halfWidth - 15, 2);
	ctx.fillRect(x + 15, y - 1, halfWidth - 15, 2);

	// Stepped accents
	ctx.fillRect(x - halfWidth, y - 3, 10, 2);
	ctx.fillRect(x + halfWidth - 10, y - 3, 10, 2);
	ctx.fillRect(x - halfWidth, y + 1, 10, 2);
	ctx.fillRect(x + halfWidth - 10, y + 1, 10, 2);
}

function drawArrowDivider(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, color: string) {
	ctx.fillStyle = color;

	// Bold arrow pointing right
	ctx.beginPath();
	ctx.moveTo(x - halfWidth, y - 4);
	ctx.lineTo(x + halfWidth - 15, y - 4);
	ctx.lineTo(x + halfWidth - 15, y - 10);
	ctx.lineTo(x + halfWidth, y);
	ctx.lineTo(x + halfWidth - 15, y + 10);
	ctx.lineTo(x + halfWidth - 15, y + 4);
	ctx.lineTo(x - halfWidth, y + 4);
	ctx.closePath();
	ctx.fill();
}

// ============================================================================
// BACKGROUND PATTERN FUNCTIONS
// ============================================================================

export function drawStyledBackground(
	ctx: CanvasRenderingContext2D,
	style: CardStyleDefinition,
	width: number,
	height: number
): void {
	const { background } = style;

	// Base color
	ctx.fillStyle = background.baseColor;
	ctx.fillRect(0, 0, width, height);

	// Gradient overlay
	if (background.gradientType !== 'none' && background.gradientColors.length >= 2) {
		let grad: CanvasGradient;

		switch (background.gradientType) {
			case 'radial':
				grad = ctx.createRadialGradient(
					width * 0.25, height * 0.2, 0,
					width * 0.25, height * 0.2, width * 0.7
				);
				grad.addColorStop(0, background.gradientColors[0]);
				grad.addColorStop(0.55, 'transparent');
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, width, height);

				grad = ctx.createRadialGradient(
					width * 0.75, height * 0.7, 0,
					width * 0.75, height * 0.7, width * 0.8
				);
				grad.addColorStop(0, background.gradientColors[1]);
				grad.addColorStop(0.6, 'transparent');
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, width, height);
				break;

			case 'linear':
				const angle = (background.gradientAngle ?? 180) * Math.PI / 180;
				const x1 = width / 2 - Math.sin(angle) * width / 2;
				const y1 = height / 2 - Math.cos(angle) * height / 2;
				const x2 = width / 2 + Math.sin(angle) * width / 2;
				const y2 = height / 2 + Math.cos(angle) * height / 2;
				grad = ctx.createLinearGradient(x1, y1, x2, y2);
				grad.addColorStop(0, background.gradientColors[0]);
				grad.addColorStop(1, background.gradientColors[1]);
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, width, height);
				break;

			case 'conic':
				// Approximate conic gradient with radial
				grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
				grad.addColorStop(0, background.gradientColors[0]);
				grad.addColorStop(0.5, background.gradientColors[1] ?? background.gradientColors[0]);
				grad.addColorStop(1, background.gradientColors[2] ?? background.gradientColors[0]);
				ctx.fillStyle = grad;
				ctx.fillRect(0, 0, width, height);
				break;
		}
	}

	// Pattern overlay
	if (typeof background.pattern === 'string' && background.pattern !== 'none' && background.patternOpacity > 0) {
		ctx.globalAlpha = background.patternOpacity;
		drawBackgroundPattern(ctx, background.pattern, width, height, style.colors.primary);
		ctx.globalAlpha = 1;
	}

	// Vignette
	if (background.vignetteStrength > 0) {
		const vignetteGrad = ctx.createRadialGradient(
			width / 2, height / 2, 0,
			width / 2, height / 2, width * 0.75
		);
		vignetteGrad.addColorStop(0, 'transparent');
		vignetteGrad.addColorStop(0.5, background.vignetteColor.replace(/[\d.]+\)$/, `${background.vignetteStrength * 0.5})`));
		vignetteGrad.addColorStop(1, background.vignetteColor);
		ctx.fillStyle = vignetteGrad;
		ctx.fillRect(0, 0, width, height);
	}
}

function drawBackgroundPattern(
	ctx: CanvasRenderingContext2D,
	pattern: string,
	width: number,
	height: number,
	color: string
): void {
	ctx.strokeStyle = color;
	ctx.fillStyle = color;

	switch (pattern) {
		case 'arcane-circles':
			// Concentric magic circles
			ctx.lineWidth = 0.5;
			for (let r = 50; r < width; r += 80) {
				ctx.beginPath();
				ctx.arc(width / 2, height / 2, r, 0, Math.PI * 2);
				ctx.stroke();
			}
			// Rune marks
			for (let i = 0; i < 12; i++) {
				const angle = (Math.PI * 2 / 12) * i;
				const x = width / 2 + Math.cos(angle) * 120;
				const y = height / 2 + Math.sin(angle) * 120;
				ctx.fillRect(x - 2, y - 2, 4, 4);
			}
			break;

		case 'cracks':
			ctx.lineWidth = 1;
			for (let i = 0; i < 15; i++) {
				const startX = Math.random() * width;
				const startY = Math.random() * height;
				ctx.beginPath();
				ctx.moveTo(startX, startY);
				let x = startX, y = startY;
				for (let j = 0; j < 4; j++) {
					x += (Math.random() - 0.5) * 60;
					y += (Math.random() - 0.5) * 40;
					ctx.lineTo(x, y);
				}
				ctx.stroke();
			}
			break;

		case 'crystals':
			// Hexagonal crystal pattern
			for (let x = 0; x < width; x += 60) {
				for (let y = 0; y < height; y += 70) {
					const offsetX = (Math.floor(y / 70) % 2) * 30;
					drawSmallHexagon(ctx, x + offsetX, y, 15);
				}
			}
			break;

		case 'leaves':
			for (let i = 0; i < 20; i++) {
				const x = Math.random() * width;
				const y = Math.random() * height;
				const angle = Math.random() * Math.PI * 2;
				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(angle);
				ctx.beginPath();
				ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2);
				ctx.stroke();
				ctx.restore();
			}
			break;

		case 'mist':
			// Layered mist clouds
			for (let i = 0; i < 8; i++) {
				const x = Math.random() * width;
				const y = Math.random() * height;
				const grad = ctx.createRadialGradient(x, y, 0, x, y, 80);
				grad.addColorStop(0, color);
				grad.addColorStop(1, 'transparent');
				ctx.fillStyle = grad;
				ctx.fillRect(x - 80, y - 80, 160, 160);
			}
			break;

		case 'rays':
			// Light rays from center-top
			const rayCount = 12;
			for (let i = 0; i < rayCount; i++) {
				const angle = (Math.PI / rayCount) * i;
				const rayGrad = ctx.createLinearGradient(
					width / 2, 0,
					width / 2 + Math.cos(angle) * width,
					Math.sin(angle) * height
				);
				rayGrad.addColorStop(0, color);
				rayGrad.addColorStop(1, 'transparent');
				ctx.fillStyle = rayGrad;
				ctx.beginPath();
				ctx.moveTo(width / 2, 0);
				ctx.lineTo(width / 2 + Math.cos(angle - 0.1) * width, Math.sin(angle - 0.1) * height);
				ctx.lineTo(width / 2 + Math.cos(angle + 0.1) * width, Math.sin(angle + 0.1) * height);
				ctx.closePath();
				ctx.fill();
			}
			break;

		case 'blood-splatter':
			for (let i = 0; i < 10; i++) {
				const x = Math.random() * width;
				const y = Math.random() * height;
				ctx.beginPath();
				ctx.arc(x, y, 5 + Math.random() * 15, 0, Math.PI * 2);
				ctx.fill();
				// Drips
				for (let d = 0; d < 3; d++) {
					const dripX = x + (Math.random() - 0.5) * 20;
					const dripLength = 10 + Math.random() * 30;
					ctx.beginPath();
					ctx.moveTo(dripX, y);
					ctx.lineTo(dripX + (Math.random() - 0.5) * 5, y + dripLength);
					ctx.lineWidth = 2;
					ctx.stroke();
				}
			}
			break;

		case 'stars':
			for (let i = 0; i < 50; i++) {
				const x = Math.random() * width;
				const y = Math.random() * height;
				const size = 0.5 + Math.random() * 1.5;
				ctx.beginPath();
				ctx.arc(x, y, size, 0, Math.PI * 2);
				ctx.fill();
			}
			break;

		case 'grid':
			ctx.lineWidth = 0.5;
			for (let x = 0; x < width; x += 30) {
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, height);
				ctx.stroke();
			}
			for (let y = 0; y < height; y += 30) {
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(width, y);
				ctx.stroke();
			}
			break;

		case 'film-grain':
			for (let i = 0; i < 500; i++) {
				const x = Math.random() * width;
				const y = Math.random() * height;
				ctx.fillRect(x, y, 1, 1);
			}
			break;

		case 'watercolor':
			// Soft organic shapes
			for (let i = 0; i < 5; i++) {
				const x = Math.random() * width;
				const y = Math.random() * height;
				const grad = ctx.createRadialGradient(x, y, 0, x, y, 100);
				grad.addColorStop(0, color);
				grad.addColorStop(0.5, color.replace(/[\d.]+\)$/, '0.3)'));
				grad.addColorStop(1, 'transparent');
				ctx.fillStyle = grad;
				ctx.beginPath();
				ctx.ellipse(x, y, 80, 50, Math.random() * Math.PI, 0, Math.PI * 2);
				ctx.fill();
			}
			break;

		case 'geometric':
			// Art deco geometric pattern
			for (let x = 0; x < width; x += 80) {
				for (let y = 0; y < height; y += 80) {
					ctx.strokeRect(x + 10, y + 10, 60, 60);
					ctx.beginPath();
					ctx.moveTo(x + 40, y + 10);
					ctx.lineTo(x + 70, y + 40);
					ctx.lineTo(x + 40, y + 70);
					ctx.lineTo(x + 10, y + 40);
					ctx.closePath();
					ctx.stroke();
				}
			}
			break;

		case 'stripes':
			ctx.lineWidth = 8;
			for (let x = -height; x < width + height; x += 40) {
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x + height, height);
				ctx.stroke();
			}
			break;
	}
}

function drawSmallHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

export function hexToRgba(hex: string, alpha: number): string {
	const sanitized = /^#([A-Fa-f0-9]{6})$/.test(hex) ? hex : '#8b5cf6';
	const r = parseInt(sanitized.slice(1, 3), 16);
	const g = parseInt(sanitized.slice(3, 5), 16);
	const b = parseInt(sanitized.slice(5, 7), 16);
	const a = Math.max(0, Math.min(1, alpha));
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}
