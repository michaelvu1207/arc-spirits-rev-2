export type Align = 'left' | 'center' | 'right';

export type TextStyle = {
	fontSize: number;
	lineHeight?: number;
	align: Align;
	color: string;
};

export type Transform = {
	/** X position in reference coords (center anchor). */
	x: number;
	/** Y position in reference coords (center anchor). */
	y: number;
	/** Rotation in degrees (clockwise). */
	rotation: number;
	/** Uniform scale multiplier. */
	scale: number;
};

export type LocationCardPlacementKey = 'name' | 'row_1' | 'row_2' | 'row_3' | 'row_4' | 'row_5';
export type LocationCardRewardRowKey = Exclude<LocationCardPlacementKey, 'name'>;

export type Box = {
	w: number;
	h: number;
};

export type LocationCardLayoutConfig = {
	_version: 9;
	_ref_w: number;
	_ref_h: number;
	name_style: TextStyle;
	placements: Record<LocationCardPlacementKey, [Transform, Transform]>;
	/** Bounding box (reference coords) used only for reward rows where type === 'text'. */
	reward_text_boxes: Record<LocationCardRewardRowKey, [Box, Box]>;
	/** Style used only for reward rows where type === 'text'. */
	reward_text_style: TextStyle;
};

export const REWARD_ROW_BASE_ICON_SIZE = 56;

/** Historical design-time anchor dimensions — used only for proportional default calculations. */
const DESIGN_W = 600;
const DESIGN_H = 437;

function isAlign(v: unknown): v is Align {
	return v === 'left' || v === 'center' || v === 'right';
}

function coerceFinite(v: unknown, fallback: number): number {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

function coerceTextStyle(raw: unknown, fallback: TextStyle): TextStyle {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return {
		fontSize: Math.max(1, Math.round(coerceFinite(o.fontSize, fallback.fontSize))),
		lineHeight:
			Object.prototype.hasOwnProperty.call(o, 'lineHeight') &&
			(o as any).lineHeight !== null &&
			(o as any).lineHeight !== '' &&
			typeof (o as any).lineHeight !== 'undefined'
				? Math.max(
						0,
						Math.round(
							coerceFinite(
								(o as any).lineHeight,
								fallback.lineHeight ?? Math.round(fallback.fontSize * 1.15)
							)
						)
					)
				: fallback.lineHeight,
		align: isAlign(o.align) ? (o.align as Align) : fallback.align,
		color: typeof o.color === 'string' && o.color.trim() ? o.color : fallback.color
	};
}

function coerceTransform(raw: unknown, fallback: Transform): Transform {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return {
		x: coerceFinite(o.x, fallback.x),
		y: coerceFinite(o.y, fallback.y),
		rotation: coerceFinite(o.rotation, fallback.rotation),
		scale: clamp(coerceFinite(o.scale, fallback.scale), 0.05, 6)
	};
}

function coerceBox(raw: unknown, fallback: Box): Box {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return {
		w: Math.max(1, Math.round(coerceFinite(o.w, fallback.w))),
		h: Math.max(1, Math.round(coerceFinite(o.h, fallback.h)))
	};
}

function defaultRowBoxForRef(refW: number, refH: number): { w: number; h: number; iconSize: number } {
	const sx = refW / DESIGN_W;
	const sy = refH / DESIGN_H;
	const s = (sx + sy) / 2;
	return {
		w: Math.max(120, Math.round(460 * sx)),
		h: Math.max(24, Math.round(60 * sy)),
		iconSize: Math.max(10, Math.round(26 * s))
	};
}

function defaultNameStyleForRef(refW: number, refH: number): TextStyle {
	const sx = refW / DESIGN_W;
	const sy = refH / DESIGN_H;
	const s = (sx + sy) / 2;
	return { fontSize: Math.max(10, Math.round(44 * s)), align: 'center', color: '#ffffff' };
}

function defaultRewardTextStyleForRef(refW: number, refH: number): TextStyle {
	const sx = refW / DESIGN_W;
	const sy = refH / DESIGN_H;
	const s = (sx + sy) / 2;
	return { fontSize: Math.max(8, Math.round(12 * s)), align: 'left', color: 'rgba(226, 232, 240, 0.85)' };
}

function defaultNameBoxForRef(refW: number, refH: number, nameStyle: TextStyle): { w: number; h: number } {
	const row = defaultRowBoxForRef(refW, refH);
	const pad = 8;
	const lineHeight =
		typeof nameStyle.lineHeight === 'number' && Number.isFinite(nameStyle.lineHeight)
			? nameStyle.lineHeight
			: Math.max(6, nameStyle.fontSize) * 1.15;
	const h = Math.max(row.h, pad * 2 + lineHeight);
	return { w: row.w, h };
}

export function createDefaultLocationCardLayoutConfig(refW: number, refH: number): LocationCardLayoutConfig {
	const sx = refW / DESIGN_W;
	const sy = refH / DESIGN_H;
	const cx = refW / 2;
	const cy = refH / 2;

	const row = defaultRowBoxForRef(refW, refH);
	const nameStyle = defaultNameStyleForRef(refW, refH);
	const rewardTextStyle = defaultRewardTextStyleForRef(refW, refH);

	const defaultRowScale = clamp(row.iconSize / REWARD_ROW_BASE_ICON_SIZE, 0.05, 6);

	const dup = (t: Transform): [Transform, Transform] => [t, { ...t }];
	const dupBox = (b: Box): [Box, Box] => [b, { ...b }];

	return {
		_version: 9,
		_ref_w: refW,
		_ref_h: refH,
		name_style: nameStyle,
		placements: {
			name: dup({ x: cx, y: cy - Math.round(130 * sy), rotation: 0, scale: 1 }),
			row_1: dup({ x: cx, y: cy + Math.round(40 * sy), rotation: 0, scale: defaultRowScale }),
			row_2: dup({ x: cx, y: cy + Math.round(110 * sy), rotation: 0, scale: defaultRowScale }),
			row_3: dup({ x: cx, y: cy + Math.round(180 * sy), rotation: 0, scale: defaultRowScale }),
			row_4: dup({ x: cx, y: cy + Math.round(250 * sy), rotation: 0, scale: defaultRowScale }),
			row_5: dup({ x: cx, y: cy + Math.round(320 * sy), rotation: 0, scale: defaultRowScale })
		},
		reward_text_boxes: {
			row_1: dupBox({ w: row.w, h: row.h }),
			row_2: dupBox({ w: row.w, h: row.h }),
			row_3: dupBox({ w: row.w, h: row.h }),
			row_4: dupBox({ w: row.w, h: row.h }),
			row_5: dupBox({ w: row.w, h: row.h })
		},
		reward_text_style: rewardTextStyle
	};
}

type LegacyRewardRowStyleV4 = {
	w: number;
	h: number;
	iconSize: number;
	gap: number;
	maxPerRow: number;
	fontSize: number;
	lineHeight?: number;
	align: Align;
	color: string;
};

type LegacyLocationCardLayoutConfigV4 = {
	_version: 4;
	_ref_w: number;
	_ref_h: number;
	name_style: TextStyle;
	reward_row_style: LegacyRewardRowStyleV4;
	placements: {
		name: [Transform, Transform] | Transform;
		row_1: [Transform, Transform] | Transform;
		row_2: [Transform, Transform] | Transform;
		row_3: [Transform, Transform] | Transform;
	};
};

function coerceLegacyRewardRowStyleV4(raw: unknown, fallback: LegacyRewardRowStyleV4): LegacyRewardRowStyleV4 {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return {
		w: Math.max(1, Math.round(coerceFinite(o.w, fallback.w))),
		h: Math.max(1, Math.round(coerceFinite(o.h, fallback.h))),
		iconSize: Math.max(1, Math.round(coerceFinite(o.iconSize, fallback.iconSize))),
		gap: Math.max(0, Math.round(coerceFinite(o.gap, fallback.gap))),
		maxPerRow: Math.max(1, Math.round(coerceFinite(o.maxPerRow, fallback.maxPerRow))),
		fontSize: Math.max(1, Math.round(coerceFinite(o.fontSize, fallback.fontSize))),
		lineHeight:
			Object.prototype.hasOwnProperty.call(o, 'lineHeight') &&
			(o as any).lineHeight !== null &&
			(o as any).lineHeight !== '' &&
			typeof (o as any).lineHeight !== 'undefined'
				? Math.max(
						0,
						Math.round(
							coerceFinite(
								(o as any).lineHeight,
								fallback.lineHeight ?? Math.round(fallback.fontSize * 1.15)
							)
						)
					)
				: fallback.lineHeight,
		align: isAlign(o.align) ? (o.align as Align) : fallback.align,
		color: typeof o.color === 'string' && o.color.trim() ? o.color : fallback.color
	};
}

function pickFirstTransform(raw: unknown, fallback: Transform): Transform {
	if (Array.isArray(raw)) return coerceTransform(raw[0], fallback);
	return coerceTransform(raw, fallback);
}

function coercePair(raw: unknown, fallback: [Transform, Transform]): [Transform, Transform] {
	if (Array.isArray(raw)) {
		return [coerceTransform(raw[0], fallback[0]), coerceTransform(raw[1], fallback[1])];
	}
	const t = coerceTransform(raw, fallback[0]);
	return [t, { ...t }];
}

function coercePairBox(raw: unknown, fallback: [Box, Box]): [Box, Box] {
	if (Array.isArray(raw)) {
		return [coerceBox(raw[0], fallback[0]), coerceBox(raw[1], fallback[1])];
	}
	const b = coerceBox(raw, fallback[0]);
	return [b, { ...b }];
}

function getLegacyNameBoxV4(nameStyle: TextStyle, rowStyle: LegacyRewardRowStyleV4): { w: number; h: number } {
	const pad = 8;
	const lineHeight =
		typeof nameStyle.lineHeight === 'number' && Number.isFinite(nameStyle.lineHeight)
			? nameStyle.lineHeight
			: Math.max(6, nameStyle.fontSize) * 1.15;
	const h = Math.max(rowStyle.h, pad * 2 + lineHeight);
	return { w: rowStyle.w, h };
}

function coerceLegacyConfigV4(raw: unknown): LegacyLocationCardLayoutConfigV4 | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	if (o._version !== 4) return null;

	const _ref_w = Math.max(1, Math.round(coerceFinite(o._ref_w, DESIGN_W)));
	const _ref_h = Math.max(1, Math.round(coerceFinite(o._ref_h, DESIGN_H)));

	const baseNameStyle = defaultNameStyleForRef(_ref_w, _ref_h);
	const baseRow = defaultRowBoxForRef(_ref_w, _ref_h);
	const fallbackRowStyle: LegacyRewardRowStyleV4 = {
		w: baseRow.w,
		h: baseRow.h,
		iconSize: baseRow.iconSize,
		gap: Math.max(2, Math.round(8 * ((_ref_w / DESIGN_W + _ref_h / DESIGN_H) / 2))),
		maxPerRow: 12,
		fontSize: Math.max(10, Math.round(20 * ((_ref_w / DESIGN_W + _ref_h / DESIGN_H) / 2))),
		lineHeight: Math.max(12, Math.round(24 * ((_ref_w / DESIGN_W + _ref_h / DESIGN_H) / 2))),
		align: 'left',
		color: '#ffffff'
	};

	const name_style = coerceTextStyle(o.name_style, baseNameStyle);
	const reward_row_style = coerceLegacyRewardRowStyleV4(o.reward_row_style, fallbackRowStyle);

	const placementsRaw = o.placements && typeof o.placements === 'object' ? (o.placements as Record<string, unknown>) : {};
	const cx = _ref_w / 2;
	const cy = _ref_h / 2;
	const nameBox = getLegacyNameBoxV4(name_style, reward_row_style);

	const fallback: LegacyLocationCardLayoutConfigV4 = {
		_version: 4,
		_ref_w,
		_ref_h,
		name_style,
		reward_row_style,
		placements: {
			name: [
				{ x: cx, y: cy - Math.round(130 * (_ref_h / DESIGN_H)), rotation: 0, scale: 1 },
				{ x: cx, y: cy - Math.round(130 * (_ref_h / DESIGN_H)), rotation: 0, scale: 1 }
			],
			row_1: [
				{ x: cx, y: cy + Math.round(40 * (_ref_h / DESIGN_H)), rotation: 0, scale: 1 },
				{ x: cx, y: cy + Math.round(40 * (_ref_h / DESIGN_H)), rotation: 0, scale: 1 }
			],
			row_2: [
				{ x: cx, y: cy + Math.round(110 * (_ref_h / DESIGN_H)), rotation: 0, scale: 1 },
				{ x: cx, y: cy + Math.round(110 * (_ref_h / DESIGN_H)), rotation: 0, scale: 1 }
			],
			row_3: [
				{ x: cx, y: cy + Math.round(180 * (_ref_h / DESIGN_H)), rotation: 0, scale: 1 },
				{ x: cx, y: cy + Math.round(180 * (_ref_h / DESIGN_H)), rotation: 0, scale: 1 }
			]
		}
	};

		return {
			...fallback,
			placements: {
				name: coercePair(placementsRaw.name, fallback.placements.name as any),
				row_1: coercePair(placementsRaw.row_1, fallback.placements.row_1 as any),
				row_2: coercePair(placementsRaw.row_2, fallback.placements.row_2 as any),
				row_3: coercePair(placementsRaw.row_3, fallback.placements.row_3 as any)
			}
		};
}

function convertV4ToV7(v4: LegacyLocationCardLayoutConfigV4): LocationCardLayoutConfig {
	const rowBox = { w: v4.reward_row_style.w, h: v4.reward_row_style.h };
	const rowScaleFactor = v4.reward_row_style.iconSize / REWARD_ROW_BASE_ICON_SIZE;

	const name = Array.isArray(v4.placements.name) ? v4.placements.name : ([v4.placements.name, v4.placements.name] as any);
	const row1 = Array.isArray(v4.placements.row_1) ? v4.placements.row_1 : ([v4.placements.row_1, v4.placements.row_1] as any);
	const row2 = Array.isArray(v4.placements.row_2) ? v4.placements.row_2 : ([v4.placements.row_2, v4.placements.row_2] as any);
	const row3 = Array.isArray(v4.placements.row_3) ? v4.placements.row_3 : ([v4.placements.row_3, v4.placements.row_3] as any);
	const name0 = {
		x: name[0].x,
		y: name[0].y,
		rotation: name[0].rotation,
		scale: clamp(name[0].scale, 0.05, 6)
	};
	const name1 = {
		x: name[1].x,
		y: name[1].y,
		rotation: name[1].rotation,
		scale: clamp(name[1].scale, 0.05, 6)
	};

	const base = createDefaultLocationCardLayoutConfig(v4._ref_w, v4._ref_h);

	return {
		_version: 9,
		_ref_w: v4._ref_w,
		_ref_h: v4._ref_h,
		name_style: v4.name_style,
		placements: {
			name: [name0, name1],
			row_1: [
				{ x: row1[0].x, y: row1[0].y, rotation: row1[0].rotation, scale: clamp(row1[0].scale * rowScaleFactor, 0.05, 6) },
				{ x: row1[1].x, y: row1[1].y, rotation: row1[1].rotation, scale: clamp(row1[1].scale * rowScaleFactor, 0.05, 6) }
			],
			row_2: [
				{ x: row2[0].x, y: row2[0].y, rotation: row2[0].rotation, scale: clamp(row2[0].scale * rowScaleFactor, 0.05, 6) },
				{ x: row2[1].x, y: row2[1].y, rotation: row2[1].rotation, scale: clamp(row2[1].scale * rowScaleFactor, 0.05, 6) }
			],
			row_3: [
				{ x: row3[0].x, y: row3[0].y, rotation: row3[0].rotation, scale: clamp(row3[0].scale * rowScaleFactor, 0.05, 6) },
				{ x: row3[1].x, y: row3[1].y, rotation: row3[1].rotation, scale: clamp(row3[1].scale * rowScaleFactor, 0.05, 6) }
			],
			row_4: base.placements.row_4,
			row_5: base.placements.row_5
		},
		reward_text_boxes: {
			row_1: [{ ...rowBox }, { ...rowBox }],
			row_2: [{ ...rowBox }, { ...rowBox }],
			row_3: [{ ...rowBox }, { ...rowBox }],
			row_4: base.reward_text_boxes.row_4,
			row_5: base.reward_text_boxes.row_5
		},
		reward_text_style: {
			fontSize: v4.reward_row_style.fontSize,
			lineHeight: v4.reward_row_style.lineHeight,
			align: v4.reward_row_style.align,
			color: v4.reward_row_style.color
		}
	};
}

export function coerceLocationCardLayoutConfig(raw: unknown, fallbackW?: number, fallbackH?: number): LocationCardLayoutConfig | null {
	if (!raw || typeof raw !== 'object') {
		if (fallbackW && fallbackH) return createDefaultLocationCardLayoutConfig(fallbackW, fallbackH);
		return null;
	}

	const o = raw as Record<string, unknown>;
	if (o._version === 9) {
		const _ref_w = typeof o._ref_w === 'number' && o._ref_w > 0 ? o._ref_w : fallbackW;
		const _ref_h = typeof o._ref_h === 'number' && o._ref_h > 0 ? o._ref_h : fallbackH;
		if (!_ref_w || !_ref_h) return null;
		const base = createDefaultLocationCardLayoutConfig(_ref_w, _ref_h);

		const placementsRaw = o.placements && typeof o.placements === 'object' ? (o.placements as Record<string, unknown>) : {};
		const boxesRaw = o.reward_text_boxes && typeof o.reward_text_boxes === 'object' ? (o.reward_text_boxes as Record<string, unknown>) : {};

		return {
			_version: 9,
			_ref_w,
			_ref_h,
			name_style: coerceTextStyle(o.name_style, base.name_style),
			placements: {
				name: coercePair(placementsRaw.name, base.placements.name),
				row_1: coercePair(placementsRaw.row_1, base.placements.row_1),
				row_2: coercePair(placementsRaw.row_2, base.placements.row_2),
				row_3: coercePair(placementsRaw.row_3, base.placements.row_3),
				row_4: coercePair(placementsRaw.row_4, base.placements.row_4),
				row_5: coercePair(placementsRaw.row_5, base.placements.row_5)
			},
			reward_text_boxes: {
				row_1: coercePairBox(boxesRaw.row_1, base.reward_text_boxes.row_1),
				row_2: coercePairBox(boxesRaw.row_2, base.reward_text_boxes.row_2),
				row_3: coercePairBox(boxesRaw.row_3, base.reward_text_boxes.row_3),
				row_4: coercePairBox(boxesRaw.row_4, base.reward_text_boxes.row_4),
				row_5: coercePairBox(boxesRaw.row_5, base.reward_text_boxes.row_5)
			},
			reward_text_style: coerceTextStyle(o.reward_text_style, base.reward_text_style)
		};
	}

	if (o._version === 8) {
		const _ref_w = Math.max(1, Math.round(coerceFinite(o._ref_w, fallbackW ?? DESIGN_W)));
		const _ref_h = Math.max(1, Math.round(coerceFinite(o._ref_h, fallbackH ?? DESIGN_H)));
		const base = createDefaultLocationCardLayoutConfig(_ref_w, _ref_h);

		const placementsRaw = o.placements && typeof o.placements === 'object' ? (o.placements as Record<string, unknown>) : {};
		const boxesRaw = o.reward_text_boxes && typeof o.reward_text_boxes === 'object' ? (o.reward_text_boxes as Record<string, unknown>) : {};

		return {
			_version: 9,
			_ref_w,
			_ref_h,
			name_style: coerceTextStyle(o.name_style, base.name_style),
			placements: {
				name: coercePair(placementsRaw.name, base.placements.name),
				row_1: coercePair(placementsRaw.row_1, base.placements.row_1),
				row_2: coercePair(placementsRaw.row_2, base.placements.row_2),
				row_3: coercePair(placementsRaw.row_3, base.placements.row_3),
				row_4: base.placements.row_4,
				row_5: base.placements.row_5
			},
			reward_text_boxes: {
				row_1: coercePairBox(boxesRaw.row_1, base.reward_text_boxes.row_1),
				row_2: coercePairBox(boxesRaw.row_2, base.reward_text_boxes.row_2),
				row_3: coercePairBox(boxesRaw.row_3, base.reward_text_boxes.row_3),
				row_4: base.reward_text_boxes.row_4,
				row_5: base.reward_text_boxes.row_5
			},
			reward_text_style: base.reward_text_style
		};
	}

	if (o._version === 7) {
		const _ref_w = Math.max(1, Math.round(coerceFinite(o._ref_w, fallbackW ?? DESIGN_W)));
		const _ref_h = Math.max(1, Math.round(coerceFinite(o._ref_h, fallbackH ?? DESIGN_H)));
		const base = createDefaultLocationCardLayoutConfig(_ref_w, _ref_h);

		const placementsRaw = o.placements && typeof o.placements === 'object' ? (o.placements as Record<string, unknown>) : {};

		return {
			_version: 9,
			_ref_w,
			_ref_h,
			name_style: coerceTextStyle(o.name_style, base.name_style),
			placements: {
				name: coercePair(placementsRaw.name, base.placements.name),
				row_1: coercePair(placementsRaw.row_1, base.placements.row_1),
				row_2: coercePair(placementsRaw.row_2, base.placements.row_2),
				row_3: coercePair(placementsRaw.row_3, base.placements.row_3),
				row_4: base.placements.row_4,
				row_5: base.placements.row_5
			},
			reward_text_boxes: base.reward_text_boxes,
			reward_text_style: base.reward_text_style
		};
	}

	// v6 (top-left anchored) → v7 (center anchored)
	if (o._version === 6) {
		const _ref_w = Math.max(1, Math.round(coerceFinite(o._ref_w, fallbackW ?? DESIGN_W)));
		const _ref_h = Math.max(1, Math.round(coerceFinite(o._ref_h, fallbackH ?? DESIGN_H)));
		const base = createDefaultLocationCardLayoutConfig(_ref_w, _ref_h);

		const placementsRaw = o.placements && typeof o.placements === 'object' ? (o.placements as Record<string, unknown>) : {};
		const name_style = coerceTextStyle(o.name_style, base.name_style);

		const rowBox = defaultRowBoxForRef(_ref_w, _ref_h);
		const nameBox = defaultNameBoxForRef(_ref_w, _ref_h, name_style);

		const toCenter = (p: Transform, box: { w: number; h: number }): Transform => ({
			x: p.x + (box.w * p.scale) / 2,
			y: p.y + (box.h * p.scale) / 2,
			rotation: p.rotation,
			scale: p.scale
		});

		const coercePairV6 = (rawPair: unknown, fb: [Transform, Transform]): [Transform, Transform] => {
			if (Array.isArray(rawPair)) return [coerceTransform(rawPair[0], fb[0]), coerceTransform(rawPair[1], fb[1])];
			const t = coerceTransform(rawPair, fb[0]);
			return [t, { ...t }];
		};

		const namePair = coercePairV6(placementsRaw.name, [
			{ ...base.placements.name[0], x: base.placements.name[0].x - nameBox.w / 2, y: base.placements.name[0].y - nameBox.h / 2 },
			{ ...base.placements.name[1], x: base.placements.name[1].x - nameBox.w / 2, y: base.placements.name[1].y - nameBox.h / 2 }
		]);
		const row1Pair = coercePairV6(placementsRaw.row_1, [
			{ ...base.placements.row_1[0], x: base.placements.row_1[0].x - rowBox.w / 2, y: base.placements.row_1[0].y - rowBox.h / 2 },
			{ ...base.placements.row_1[1], x: base.placements.row_1[1].x - rowBox.w / 2, y: base.placements.row_1[1].y - rowBox.h / 2 }
		]);
		const row2Pair = coercePairV6(placementsRaw.row_2, [
			{ ...base.placements.row_2[0], x: base.placements.row_2[0].x - rowBox.w / 2, y: base.placements.row_2[0].y - rowBox.h / 2 },
			{ ...base.placements.row_2[1], x: base.placements.row_2[1].x - rowBox.w / 2, y: base.placements.row_2[1].y - rowBox.h / 2 }
		]);
		const row3Pair = coercePairV6(placementsRaw.row_3, [
			{ ...base.placements.row_3[0], x: base.placements.row_3[0].x - rowBox.w / 2, y: base.placements.row_3[0].y - rowBox.h / 2 },
			{ ...base.placements.row_3[1], x: base.placements.row_3[1].x - rowBox.w / 2, y: base.placements.row_3[1].y - rowBox.h / 2 }
		]);

		return {
			_version: 9,
			_ref_w,
			_ref_h,
			name_style,
			placements: {
				name: [toCenter(namePair[0], nameBox), toCenter(namePair[1], nameBox)],
				row_1: [toCenter(row1Pair[0], rowBox), toCenter(row1Pair[1], rowBox)],
				row_2: [toCenter(row2Pair[0], rowBox), toCenter(row2Pair[1], rowBox)],
				row_3: [toCenter(row3Pair[0], rowBox), toCenter(row3Pair[1], rowBox)],
				row_4: base.placements.row_4,
				row_5: base.placements.row_5
			},
			reward_text_boxes: base.reward_text_boxes,
			reward_text_style: base.reward_text_style
		};
	}

	if (o._version === 5) {
		const _ref_w = Math.max(1, Math.round(coerceFinite(o._ref_w, fallbackW ?? DESIGN_W)));
		const _ref_h = Math.max(1, Math.round(coerceFinite(o._ref_h, fallbackH ?? DESIGN_H)));
		const base = createDefaultLocationCardLayoutConfig(_ref_w, _ref_h);

		const placementsRaw = o.placements && typeof o.placements === 'object' ? (o.placements as Record<string, unknown>) : {};

		const name_style = coerceTextStyle(o.name_style, base.name_style);
		const rowBox = defaultRowBoxForRef(_ref_w, _ref_h);
		const nameBox = defaultNameBoxForRef(_ref_w, _ref_h, name_style);

		const toCenter = (p: Transform, box: { w: number; h: number }): Transform => ({
			x: p.x + (box.w * p.scale) / 2,
			y: p.y + (box.h * p.scale) / 2,
			rotation: p.rotation,
			scale: p.scale
		});

		const dup = (t: Transform): [Transform, Transform] => [t, { ...t }];
		const name = dup(coerceTransform(placementsRaw.name, { ...base.placements.name[0], x: base.placements.name[0].x - nameBox.w / 2, y: base.placements.name[0].y - nameBox.h / 2 }));
		const row1 = dup(coerceTransform(placementsRaw.row_1, { ...base.placements.row_1[0], x: base.placements.row_1[0].x - rowBox.w / 2, y: base.placements.row_1[0].y - rowBox.h / 2 }));
		const row2 = dup(coerceTransform(placementsRaw.row_2, { ...base.placements.row_2[0], x: base.placements.row_2[0].x - rowBox.w / 2, y: base.placements.row_2[0].y - rowBox.h / 2 }));
		const row3 = dup(coerceTransform(placementsRaw.row_3, { ...base.placements.row_3[0], x: base.placements.row_3[0].x - rowBox.w / 2, y: base.placements.row_3[0].y - rowBox.h / 2 }));

		return {
			_version: 9,
			_ref_w,
			_ref_h,
			name_style,
			placements: {
				name: [toCenter(name[0], nameBox), toCenter(name[1], nameBox)],
				row_1: [toCenter(row1[0], rowBox), toCenter(row1[1], rowBox)],
				row_2: [toCenter(row2[0], rowBox), toCenter(row2[1], rowBox)],
				row_3: [toCenter(row3[0], rowBox), toCenter(row3[1], rowBox)],
				row_4: base.placements.row_4,
				row_5: base.placements.row_5
			},
			reward_text_boxes: base.reward_text_boxes,
			reward_text_style: base.reward_text_style
		};
	}

	const v4 = coerceLegacyConfigV4(raw);
	if (v4) return convertV4ToV7(v4);

	if (fallbackW && fallbackH) return createDefaultLocationCardLayoutConfig(fallbackW, fallbackH);
	return null;
}
