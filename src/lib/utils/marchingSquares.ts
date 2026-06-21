export interface Point {
	x: number;
	y: number;
}

/**
 * Scan alpha channel, return binary grid (1=opaque, 0=transparent).
 * Grid dimensions are (width x height) matching the image.
 */
export function createBinaryGrid(
	imageData: ImageData,
	threshold: number
): Uint8Array {
	const { width, height, data } = imageData;
	const grid = new Uint8Array(width * height);
	for (let i = 0; i < width * height; i++) {
		grid[i] = data[i * 4 + 3] >= threshold ? 1 : 0;
	}
	return grid;
}

/**
 * Marching squares contour tracing.
 * Walks 2x2 cells over the binary grid, produces multiple closed contour loops.
 * Handles disconnected regions and holes naturally.
 */
export function traceContours(
	grid: Uint8Array,
	width: number,
	height: number
): Point[][] {
	// Padded grid: (width+1) x (height+1) with 0-border
	const pw = width + 2;
	const ph = height + 2;
	const padded = new Uint8Array(pw * ph);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			padded[(y + 1) * pw + (x + 1)] = grid[y * width + x];
		}
	}

	// Track visited edges to avoid duplicate contours
	// Each cell can have edges on its 4 sides; we track (cellX, cellY, direction)
	const visitedEdges = new Set<string>();

	const contours: Point[][] = [];

	// Scan cells (each cell is a 2x2 window of padded grid)
	// Cell (cx, cy) samples corners: (cx,cy), (cx+1,cy), (cx,cy+1), (cx+1,cy+1)
	const cellsW = pw - 1;
	const cellsH = ph - 1;

	for (let cy = 0; cy < cellsH; cy++) {
		for (let cx = 0; cx < cellsW; cx++) {
			const caseIndex = getCaseIndex(padded, pw, cx, cy);
			if (caseIndex === 0 || caseIndex === 15) continue;

			// For each edge in this cell, try to start a contour
			const edges = CASE_EDGES[caseIndex];
			for (const [enterSide] of edges) {
				const edgeKey = `${cx},${cy},${enterSide}`;
				if (visitedEdges.has(edgeKey)) continue;

				const contour = followContour(
					padded,
					pw,
					cellsW,
					cellsH,
					cx,
					cy,
					enterSide,
					visitedEdges
				);
				if (contour.length >= 3) {
					// Offset back from padded coordinates to original image coords
					const adjusted = contour.map((p) => ({
						x: p.x - 1,
						y: p.y - 1
					}));
					contours.push(adjusted);
				}
			}
		}
	}

	return contours;
}

function getCaseIndex(
	padded: Uint8Array,
	pw: number,
	cx: number,
	cy: number
): number {
	const tl = padded[cy * pw + cx];
	const tr = padded[cy * pw + cx + 1];
	const bl = padded[(cy + 1) * pw + cx];
	const br = padded[(cy + 1) * pw + cx + 1];
	return (tl << 3) | (tr << 2) | (br << 1) | bl;
}

// Edge midpoints for each side of a cell (relative to cell top-left)
// Sides: 0=top, 1=right, 2=bottom, 3=left
function edgeMidpoint(
	cx: number,
	cy: number,
	side: number
): Point {
	switch (side) {
		case 0: return { x: cx + 0.5, y: cy };       // top
		case 1: return { x: cx + 1, y: cy + 0.5 };   // right
		case 2: return { x: cx + 0.5, y: cy + 1 };   // bottom
		case 3: return { x: cx, y: cy + 0.5 };        // left
		default: return { x: cx, y: cy };
	}
}

// Opposite side when crossing to neighbor cell
const OPPOSITE_SIDE: Record<number, number> = { 0: 2, 1: 3, 2: 0, 3: 1 };

// Neighbor cell offset by exit side
function neighborCell(
	cx: number,
	cy: number,
	exitSide: number
): [number, number] {
	switch (exitSide) {
		case 0: return [cx, cy - 1]; // top -> cell above
		case 1: return [cx + 1, cy]; // right -> cell right
		case 2: return [cx, cy + 1]; // bottom -> cell below
		case 3: return [cx - 1, cy]; // left -> cell left
		default: return [cx, cy];
	}
}

// For each marching squares case (0-15), edges as [enterSide, exitSide] pairs.
// Enter side = side the contour enters from, exit side = side it leaves through.
const CASE_EDGES: [number, number][][] = [
	/* 0  */ [],
	/* 1  */ [[2, 3]],
	/* 2  */ [[1, 2]],
	/* 3  */ [[1, 3]],
	/* 4  */ [[0, 1]],
	/* 5  */ [[0, 3], [2, 1]],  // saddle
	/* 6  */ [[0, 2]],
	/* 7  */ [[0, 3]],
	/* 8  */ [[3, 0]],
	/* 9  */ [[2, 0]],
	/* 10 */ [[3, 2], [1, 0]],  // saddle
	/* 11 */ [[1, 0]],
	/* 12 */ [[3, 1]],
	/* 13 */ [[2, 1]],
	/* 14 */ [[3, 2]],
	/* 15 */ []
];

function followContour(
	padded: Uint8Array,
	pw: number,
	cellsW: number,
	cellsH: number,
	startCx: number,
	startCy: number,
	startEnterSide: number,
	visitedEdges: Set<string>
): Point[] {
	const points: Point[] = [];
	let cx = startCx;
	let cy = startCy;
	let enterSide = startEnterSide;

	const maxSteps = cellsW * cellsH * 4;
	let steps = 0;

	while (steps < maxSteps) {
		const edgeKey = `${cx},${cy},${enterSide}`;
		if (steps > 0 && cx === startCx && cy === startCy && enterSide === startEnterSide) {
			break; // closed contour
		}
		if (visitedEdges.has(edgeKey)) break;
		visitedEdges.add(edgeKey);

		const caseIndex = getCaseIndex(padded, pw, cx, cy);
		const edges = CASE_EDGES[caseIndex];

		// Find the edge matching our enter side
		const edge = edges.find(([enter]) => enter === enterSide);
		if (!edge) break;

		const [, exitSide] = edge;

		// Add the midpoint of the enter edge
		points.push(edgeMidpoint(cx, cy, enterSide));

		// Move to neighbor cell through the exit side
		const [ncx, ncy] = neighborCell(cx, cy, exitSide);
		if (ncx < 0 || ncx >= cellsW || ncy < 0 || ncy >= cellsH) break;

		cx = ncx;
		cy = ncy;
		enterSide = OPPOSITE_SIDE[exitSide];
		steps++;
	}

	return points;
}

/**
 * Ramer-Douglas-Peucker path simplification.
 */
export function simplifyPath(points: Point[], tolerance: number): Point[] {
	if (points.length <= 2 || tolerance <= 0) return points;

	let maxDist = 0;
	let maxIdx = 0;
	const first = points[0];
	const last = points[points.length - 1];

	for (let i = 1; i < points.length - 1; i++) {
		const d = perpendicularDistance(points[i], first, last);
		if (d > maxDist) {
			maxDist = d;
			maxIdx = i;
		}
	}

	if (maxDist > tolerance) {
		const left = simplifyPath(points.slice(0, maxIdx + 1), tolerance);
		const right = simplifyPath(points.slice(maxIdx), tolerance);
		return [...left.slice(0, -1), ...right];
	}

	return [first, last];
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
	const dx = lineEnd.x - lineStart.x;
	const dy = lineEnd.y - lineStart.y;
	const lenSq = dx * dx + dy * dy;

	if (lenSq === 0) {
		const ex = point.x - lineStart.x;
		const ey = point.y - lineStart.y;
		return Math.sqrt(ex * ex + ey * ey);
	}

	const num = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
	return num / Math.sqrt(lenSq);
}

/**
 * Convert Point[] to SVG path `d` attribute string.
 */
export function contourToSvgPath(points: Point[]): string {
	if (points.length === 0) return '';
	const [first, ...rest] = points;
	const segments = rest.map((p) => `L${p.x},${p.y}`).join(' ');
	return `M${first.x},${first.y} ${segments} Z`;
}

/**
 * Build a complete SVG document string from contours.
 */
export function buildSvgDocument(
	contours: Point[][],
	width: number,
	height: number,
	strokeColor: string = '#ff0000',
	strokeWidth: number = 1
): string {
	const paths = contours
		.map((c) => contourToSvgPath(c))
		.map(
			(d) =>
				`  <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-rule="evenodd"/>`
		)
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${paths}
</svg>`;
}
