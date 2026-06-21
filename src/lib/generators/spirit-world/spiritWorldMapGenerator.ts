import { canvasToBlob, createCanvas, getContext, loadImage, roundRect } from '$lib/generators/shared/canvas';
import type { GameLocationRewardRow, RewardIconToken } from '$lib/types/gameData';
import {
	clampRewardIconTokensBySlots,
	isRewardOrIconToken,
	rewardIconTokensHaveAnyIcons
} from '$lib/utils/rewardIconTokens';

export type SpiritWorldMapPlacement = {
	rewardRows: GameLocationRewardRow[];
	x: number;
	y: number;
	scale?: number;
	/** Rotation in degrees (clockwise). */
	rotation?: number;
};

type RewardRowLayout = {
	iconSize: number;
	iconGap: number;
	rowGap: number;
};

function drawIconWithOutline(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	size: number
) {
	const outline = Math.max(2, Math.round(size * 0.08));
	const naturalW = img.naturalWidth || img.width || size;
	const naturalH = img.naturalHeight || img.height || size;
	const safeW = naturalW > 0 ? naturalW : size;
	const safeH = naturalH > 0 ? naturalH : size;
	const scale = Math.min(size / safeW, size / safeH);
	const drawW = safeW * scale;
	const drawH = safeH * scale;
	const drawX = x + (size - drawW) / 2;
	const drawY = y + (size - drawH) / 2;

	const maskCanvas = createCanvas(safeW, safeH);
	const maskCtx = getContext(maskCanvas);
	maskCtx.drawImage(img, 0, 0, safeW, safeH);
	maskCtx.globalCompositeOperation = 'source-in';
	maskCtx.fillStyle = '#2b1a12';
	maskCtx.fillRect(0, 0, safeW, safeH);
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

function drawOrSlash(
	ctx: CanvasRenderingContext2D,
	centerX: number,
	y: number,
	iconSize: number,
	iconGap: number
) {
	// Keep the slash contained within the gap so it doesn't crowd the icons.
	const maxLineWidth = Math.max(2, Math.round(iconGap * 0.3));
	const lineWidth = Math.min(Math.max(2, Math.round(iconSize * 0.16)), maxLineWidth);
	const y1 = y + iconSize * 0.26;
	const y2 = y + iconSize * 0.74;
	const maxDx = Math.max(2, Math.round(iconGap * 0.42));
	const dx = Math.min(Math.max(2, Math.round(iconSize * 0.16)), maxDx);

	ctx.save();
	ctx.lineCap = 'round';
	ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
	ctx.shadowBlur = 4;
	ctx.shadowOffsetY = 1;
	ctx.strokeStyle = 'rgba(248, 250, 252, 0.95)';
	ctx.lineWidth = lineWidth;
	ctx.beginPath();
	ctx.moveTo(centerX - dx, y1);
	ctx.lineTo(centerX + dx, y2);
	ctx.stroke();
	ctx.restore();
}

function drawArrowRight(
	ctx: CanvasRenderingContext2D,
	centerX: number,
	centerY: number,
	size: number
) {
	const w = size;
	const h = Math.max(10, size * 0.32);
	const head = Math.max(10, h * 0.9);
	const halfH = h / 2;

	ctx.save();
	ctx.translate(centerX, centerY);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
	ctx.shadowBlur = 6;
	ctx.shadowOffsetY = 2;
	ctx.strokeStyle = 'rgba(248, 250, 252, 0.95)';
	ctx.lineWidth = Math.max(2, Math.round(size * 0.09));

	ctx.beginPath();
	ctx.moveTo(-w / 2, 0);
	ctx.lineTo(w / 2 - head, 0);
	ctx.moveTo(w / 2 - head, -halfH);
	ctx.lineTo(w / 2, 0);
	ctx.lineTo(w / 2 - head, halfH);
	ctx.stroke();
	ctx.restore();
}

function rowHasContent(row: GameLocationRewardRow): boolean {
	if (!row) return false;
	if (row.type === 'text') return row.text.trim().length > 0;
	if (row.type === 'trade') {
		return (
			rewardIconTokensHaveAnyIcons(row.cost_icon_ids ?? []) ||
			rewardIconTokensHaveAnyIcons(row.gain_icon_ids ?? [])
		);
	}
	return rewardIconTokensHaveAnyIcons(row.gain_icon_ids ?? []);
}

function measureTokenListWidth(tokens: RewardIconToken[], layout: RewardRowLayout): number {
	let x = 0;
	for (const token of tokens) {
		if (typeof token === 'string') {
			x += layout.iconSize + layout.iconGap;
			continue;
		}

		if (!isRewardOrIconToken(token)) continue;
		const iconIds = (token.icon_ids ?? []).filter((id) => typeof id === 'string' && id.trim().length > 0);
		if (iconIds.length === 0) continue;

		const ids = iconIds.slice(0, 2);
		if (ids.length === 1) {
			x += layout.iconSize + layout.iconGap;
			continue;
		}

		const extra = Math.max(2, Math.round(layout.iconGap * 0.9));
		const between = layout.iconGap + extra;
		x += ids.length * layout.iconSize + between + layout.iconGap;
	}

	return Math.max(0, x);
}

function measureTextRowWidth(ctx: CanvasRenderingContext2D, layout: RewardRowLayout, text: string): number {
	ctx.save();
	ctx.font = `800 ${Math.round(layout.iconSize * 0.45)}px system-ui, -apple-system, Segoe UI, sans-serif`;
	const w = ctx.measureText(text).width;
	ctx.restore();
	return Math.max(0, w);
}

async function drawTokenList(options: {
	ctx: CanvasRenderingContext2D;
	tokens: RewardIconToken[];
	x: number;
	y: number;
	layout: RewardRowLayout;
	resolveIconUrl: (iconId: string) => string | null;
	loadIcon: (url: string) => Promise<HTMLImageElement>;
}): Promise<number> {
	let x = options.x;
	for (const token of options.tokens) {
		if (typeof token === 'string') {
			const url = options.resolveIconUrl(token);
			if (!url) continue;
			try {
				const img = await options.loadIcon(url);
				drawIconWithOutline(options.ctx, img, x, options.y, options.layout.iconSize);
			} catch (err) {
				console.warn('Failed to load Spirit World reward icon', token, err);
			}
			x += options.layout.iconSize + options.layout.iconGap;
			continue;
		}

		if (!isRewardOrIconToken(token)) continue;
		const iconIds = (token.icon_ids ?? []).filter((id) => typeof id === 'string' && id.trim().length > 0);
		if (iconIds.length === 0) continue;

		const ids = iconIds.slice(0, 2);
		if (ids.length === 1) {
			const url = options.resolveIconUrl(ids[0]!);
			if (!url) continue;
			try {
				const img = await options.loadIcon(url);
				drawIconWithOutline(options.ctx, img, x, options.y, options.layout.iconSize);
			} catch (err) {
				console.warn('Failed to load Spirit World OR reward icon', ids[0], err);
			}
			x += options.layout.iconSize + options.layout.iconGap;
			continue;
		}

		const startX = x;
		const extra = Math.max(2, Math.round(options.layout.iconGap * 0.9));
		const between = options.layout.iconGap + extra;

		for (let j = 0; j < ids.length; j++) {
			const url = options.resolveIconUrl(ids[j]!);
			if (!url) continue;
			try {
				const img = await options.loadIcon(url);
				const iconX = startX + j * (options.layout.iconSize + between);
				drawIconWithOutline(options.ctx, img, iconX, options.y, options.layout.iconSize);
			} catch (err) {
				console.warn('Failed to load Spirit World OR reward icon', ids[j], err);
			}
		}

		const centerX = startX + options.layout.iconSize + between / 2;
		drawOrSlash(options.ctx, centerX, options.y, options.layout.iconSize, between);

		x += ids.length * options.layout.iconSize + between + options.layout.iconGap;
	}

	return x;
}

async function drawRewardRowsGroup(options: {
	ctx: CanvasRenderingContext2D;
	rewardRows: GameLocationRewardRow[];
	layout: RewardRowLayout;
	resolveIconUrl: (iconId: string) => string | null;
	loadIcon: (url: string) => Promise<HTMLImageElement>;
}) {
	const rows = (options.rewardRows ?? []).filter(rowHasContent);
	if (rows.length === 0) return;

	// Panel behind all reward rows for readability.
	const rowHeights = rows.length * options.layout.iconSize + Math.max(0, rows.length - 1) * options.layout.rowGap;
	let maxRowW = 0;
	for (const row of rows) {
		if (row.type === 'text') {
			const text = String(row.text ?? '').trim();
			if (!text) continue;
			maxRowW = Math.max(maxRowW, measureTextRowWidth(options.ctx, options.layout, text));
			continue;
		}
		if (row.type === 'trade') {
			const cost = clampRewardIconTokensBySlots(row.cost_icon_ids ?? [], 3);
			const gain = clampRewardIconTokensBySlots(row.gain_icon_ids ?? [], 6);
			const costW = measureTokenListWidth(cost, options.layout);
			const gainW = measureTokenListWidth(gain, options.layout);
			const arrowGap = options.layout.iconGap;
			const arrowWidth = Math.round(options.layout.iconSize * 0.72);
			maxRowW = Math.max(maxRowW, costW + arrowGap + arrowWidth + arrowGap + gainW);
			continue;
		}

		const gain = clampRewardIconTokensBySlots(row.gain_icon_ids ?? [], 6);
		maxRowW = Math.max(maxRowW, measureTokenListWidth(gain, options.layout));
	}

	const padX = Math.max(10, Math.round(options.layout.iconSize * 0.22));
	const padY = Math.max(8, Math.round(options.layout.iconSize * 0.18));
	if (maxRowW > 0 && rowHeights > 0) {
		options.ctx.save();
		options.ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
		options.ctx.shadowBlur = 10;
		options.ctx.shadowOffsetY = 3;
		options.ctx.fillStyle = 'rgba(56, 35, 20, 0.9)';
		roundRect(options.ctx, -padX, -padY, maxRowW + padX * 2, rowHeights + padY * 2, 12);
		options.ctx.fill();
		options.ctx.shadowColor = 'transparent';
		options.ctx.lineWidth = 1;
		options.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
		options.ctx.stroke();
		options.ctx.restore();
	}

	let y = 0;

	for (const row of rows) {
		const iconY = y;

		if (row.type === 'trade') {
			const cost = clampRewardIconTokensBySlots(row.cost_icon_ids ?? [], 3);
			const gain = clampRewardIconTokensBySlots(row.gain_icon_ids ?? [], 6);

			let x = 0;
			x = await drawTokenList({
				ctx: options.ctx,
				tokens: cost,
				x,
				y: iconY,
				layout: options.layout,
				resolveIconUrl: options.resolveIconUrl,
				loadIcon: options.loadIcon
			});

			const arrowGap = options.layout.iconGap;
			const arrowWidth = Math.round(options.layout.iconSize * 0.72);
			const centerY = iconY + options.layout.iconSize / 2;

			x += arrowGap;
			drawArrowRight(options.ctx, x + arrowWidth / 2, centerY, arrowWidth);
			x += arrowWidth + arrowGap;

			await drawTokenList({
				ctx: options.ctx,
				tokens: gain,
				x,
				y: iconY,
				layout: options.layout,
				resolveIconUrl: options.resolveIconUrl,
				loadIcon: options.loadIcon
			});

			y += options.layout.iconSize + options.layout.rowGap;
			continue;
		}

		if (row.type === 'text') {
			options.ctx.save();
			options.ctx.font = `800 ${Math.round(options.layout.iconSize * 0.45)}px system-ui, -apple-system, Segoe UI, sans-serif`;
			options.ctx.textAlign = 'left';
			options.ctx.textBaseline = 'middle';
			options.ctx.lineJoin = 'round';

			options.ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
			options.ctx.shadowBlur = 6;
			options.ctx.shadowOffsetY = 2;

			options.ctx.strokeStyle = 'rgba(43, 26, 18, 0.95)';
			options.ctx.lineWidth = Math.max(3, Math.round(options.layout.iconSize / 10));
			options.ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';

			const x = 0;
			const centerY = iconY + options.layout.iconSize / 2;
			options.ctx.strokeText(row.text, x, centerY);
			options.ctx.fillText(row.text, x, centerY);
			options.ctx.restore();

			y += options.layout.iconSize + options.layout.rowGap;
			continue;
		}

		const gain = clampRewardIconTokensBySlots(row.gain_icon_ids ?? [], 6);
		await drawTokenList({
			ctx: options.ctx,
			tokens: gain,
			x: 0,
			y: iconY,
			layout: options.layout,
			resolveIconUrl: options.resolveIconUrl,
			loadIcon: options.loadIcon
		});
		y += options.layout.iconSize + options.layout.rowGap;
	}
}

export async function generateSpiritWorldMapImage(options: {
	backgroundUrl: string;
	placements: SpiritWorldMapPlacement[];
	resolveIconUrl: (iconId: string) => string | null;
	iconSize?: number;
	iconGap?: number;
	rowGap?: number;
}): Promise<Blob> {
	const bg = await loadImage(options.backgroundUrl);
	const canvas = createCanvas(bg.width, bg.height);
	const ctx = getContext(canvas);

	ctx.drawImage(bg, 0, 0);

	const layout: RewardRowLayout = {
		iconSize: Math.max(8, Math.round(options.iconSize ?? 56)),
		iconGap: Math.max(0, Math.round(options.iconGap ?? 10)),
		rowGap: Math.max(0, Math.round(options.rowGap ?? 12))
	};

	const iconCache = new Map<string, Promise<HTMLImageElement>>();
	const loadIcon = (url: string) => {
		const cached = iconCache.get(url);
		if (cached) return cached;
		const promise = loadImage(url).catch((err) => {
			iconCache.delete(url);
			throw err;
		});
		iconCache.set(url, promise);
		return promise;
	};

	for (const placement of options.placements) {
		try {
			const scale = placement.scale ?? 1;
			const rotationDeg = placement.rotation ?? 0;
			const rotationRad = (rotationDeg * Math.PI) / 180;

			ctx.save();
			ctx.translate(placement.x, placement.y);
			if (rotationRad) ctx.rotate(rotationRad);
			ctx.scale(scale, scale);
			await drawRewardRowsGroup({
				ctx,
				rewardRows: placement.rewardRows ?? [],
				layout,
				resolveIconUrl: options.resolveIconUrl,
				loadIcon
			});
			ctx.restore();
		} catch (err) {
			console.warn('Failed to render Spirit World reward rows placement', placement, err);
		}
	}

	return canvasToBlob(canvas);
}
