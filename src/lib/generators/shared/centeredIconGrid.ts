export type GridSlot = {
	index: number;
	row: number;
	col: number;
};

function buildDefaultRowOrder(rows: number): number[] {
	if (rows <= 1) return [0];

	// Prefer the vertical middle row first, then expand outward.
	const mid = Math.floor(rows / 2);
	const order = [mid];
	for (let offset = 1; offset <= mid; offset++) {
		const up = mid - offset;
		const down = mid + offset;
		if (up >= 0) order.push(up);
		if (down < rows) order.push(down);
	}
	return order;
}

function normalizeRowOrder(rows: number, rowOrder?: number[]): number[] {
	const safeRows = Math.max(1, Math.floor(rows));
	const order = Array.isArray(rowOrder) && rowOrder.length > 0 ? rowOrder : buildDefaultRowOrder(safeRows);

	const seen = new Set<number>();
	const normalized: number[] = [];
	for (const r of order) {
		const rr = Math.floor(r);
		if (rr >= 0 && rr < safeRows && !seen.has(rr)) {
			seen.add(rr);
			normalized.push(rr);
		}
	}
	for (let r = 0; r < safeRows; r++) {
		if (!seen.has(r)) normalized.push(r);
	}
	return normalized;
}

export function computeCenteredGridSlots(
	count: number,
	opts: { cols: number; rows: number; rowOrder?: number[] }
): GridSlot[] {
	const cols = Math.max(1, Math.floor(opts.cols));
	const rows = Math.max(1, Math.floor(opts.rows));
	const max = cols * rows;
	const n = Math.min(max, Math.max(0, Math.floor(count)));
	if (n <= 0) return [];

	const rowOrder = normalizeRowOrder(rows, opts.rowOrder);

	const slots: GridSlot[] = [];
	let remaining = n;
	let index = 0;

	for (const row of rowOrder) {
		if (remaining <= 0) break;
		const take = Math.min(remaining, cols);
		const startCol = Math.floor((cols - take) / 2);

		for (let i = 0; i < take; i++) {
			slots.push({ index, row, col: startCol + i });
			index++;
		}

		remaining -= take;
	}

	return slots;
}

export type GridGeometry = {
	startX: number;
	startY: number;
	cellSize: number;
	gap: number;
	cols: number;
	rows: number;
};

type AlignX = 'left' | 'center' | 'right';
type AlignY = 'top' | 'center' | 'bottom';

export function computeCenteredGridGeometry(
	box: { x: number; y: number; w: number; h: number },
	opts: { cols: number; rows: number; gap: number; alignX?: AlignX; alignY?: AlignY }
): GridGeometry {
	const cols = Math.max(1, Math.floor(opts.cols));
	const rows = Math.max(1, Math.floor(opts.rows));
	const w = Math.max(1, box.w);
	const h = Math.max(1, box.h);

	// Clamp gap so we always have room to render at least 1px cells.
	let gap = Math.max(0, opts.gap);
	const maxGap = Math.min(w / cols, h / rows) * 0.45;
	if (gap > maxGap) gap = maxGap;

	let cellSize = Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows);
	if (!Number.isFinite(cellSize) || cellSize < 1) {
		gap = 0;
		cellSize = Math.min(w / cols, h / rows);
	}

	cellSize = Math.max(1, Math.floor(cellSize));
	gap = Math.max(0, Math.floor(gap));

	const gridW = cols * cellSize + gap * (cols - 1);
	const gridH = rows * cellSize + gap * (rows - 1);

	const alignX: AlignX = opts.alignX ?? 'center';
	const alignY: AlignY = opts.alignY ?? 'center';

	const startX =
		alignX === 'left'
			? box.x
			: alignX === 'right'
				? box.x + (w - gridW)
				: box.x + (w - gridW) / 2;
	const startY =
		alignY === 'top'
			? box.y
			: alignY === 'bottom'
				? box.y + (h - gridH)
				: box.y + (h - gridH) / 2;

	return { startX, startY, cellSize, gap, cols, rows };
}
