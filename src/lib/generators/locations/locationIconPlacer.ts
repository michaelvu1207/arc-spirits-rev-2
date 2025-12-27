/**
 * Location Icon Placer Generator
 * Composites reward row icons onto location background images.
 *
 * Config is stored in localStorage (similar to spiritIconPlacer).
 */

import { createCanvas, getContext, loadImage, canvasToBlob } from '$lib/generators/shared/canvas';

export interface IconSlot {
	x: number;
	y: number;
}

export interface LocationRowPlacement {
	gain_slots: IconSlot[];
	trade_cost_slots: IconSlot[];
	trade_gain_slots: IconSlot[];
}

export interface LocationIconPlacementConfig {
	_icon_size: number;
	rows: LocationRowPlacement[];
}

export type LocationRewardRowIcons = {
	type: 'gain';
	gainIconUrls: string[];
} | {
	type: 'trade';
	costIconUrls: string[];
	gainIconUrls: string[];
};

export interface GenerateLocationWithIconsOptions {
	backgroundUrl: string;
	rewardRows: LocationRewardRowIcons[];
	config: LocationIconPlacementConfig;
}

export function createDefaultLocationIconConfig(): LocationIconPlacementConfig {
	const iconSize = 80;
	const rows: LocationRowPlacement[] = [];

	// Default: 3 rows, 5 slots per list
	for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
		const y = 40 + rowIndex * 140;
		const gain_slots = Array.from({ length: 5 }, (_, i) => ({ x: 40 + i * 90, y }));
		const trade_cost_slots = Array.from({ length: 5 }, (_, i) => ({ x: 40 + i * 90, y }));
		const trade_gain_slots = Array.from({ length: 5 }, (_, i) => ({ x: 520 + i * 90, y }));
		rows.push({ gain_slots, trade_cost_slots, trade_gain_slots });
	}

	return { _icon_size: iconSize, rows };
}

export function loadLocationIconPlacementConfig(): LocationIconPlacementConfig {
	if (typeof window === 'undefined') return createDefaultLocationIconConfig();
	const stored = localStorage.getItem('location_icon_placement_config');
	if (!stored) return createDefaultLocationIconConfig();
	try {
		const parsed = JSON.parse(stored) as LocationIconPlacementConfig;
		if (!parsed || typeof parsed._icon_size !== 'number' || !Array.isArray(parsed.rows)) {
			return createDefaultLocationIconConfig();
		}
		return parsed;
	} catch {
		return createDefaultLocationIconConfig();
	}
}

export function saveLocationIconPlacementConfig(config: LocationIconPlacementConfig): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('location_icon_placement_config', JSON.stringify(config));
}

export async function generateLocationWithIcons(
	options: GenerateLocationWithIconsOptions
): Promise<Blob> {
	const { backgroundUrl, rewardRows, config } = options;

	const background = await loadImage(backgroundUrl);
	const canvas = createCanvas(background.width, background.height);
	const ctx = getContext(canvas);

	ctx.drawImage(background, 0, 0);

	const iconSize = config._icon_size || 80;

	for (let rowIndex = 0; rowIndex < rewardRows.length; rowIndex++) {
		const row = rewardRows[rowIndex];
		const placement = config.rows[rowIndex];
		if (!placement) continue;

		if (row.type === 'gain') {
			for (let i = 0; i < Math.min(row.gainIconUrls.length, placement.gain_slots.length); i++) {
				const url = row.gainIconUrls[i];
				const slot = placement.gain_slots[i];
				try {
					const img = await loadImage(url);
					ctx.drawImage(img, slot.x, slot.y, iconSize, iconSize);
				} catch (err) {
					console.warn(`Failed to load gain icon (row ${rowIndex}, i ${i})`, err);
				}
			}
		} else {
			for (let i = 0; i < Math.min(row.costIconUrls.length, placement.trade_cost_slots.length); i++) {
				const url = row.costIconUrls[i];
				const slot = placement.trade_cost_slots[i];
				try {
					const img = await loadImage(url);
					ctx.drawImage(img, slot.x, slot.y, iconSize, iconSize);
				} catch (err) {
					console.warn(`Failed to load cost icon (row ${rowIndex}, i ${i})`, err);
				}
			}

			for (let i = 0; i < Math.min(row.gainIconUrls.length, placement.trade_gain_slots.length); i++) {
				const url = row.gainIconUrls[i];
				const slot = placement.trade_gain_slots[i];
				try {
					const img = await loadImage(url);
					ctx.drawImage(img, slot.x, slot.y, iconSize, iconSize);
				} catch (err) {
					console.warn(`Failed to load trade gain icon (row ${rowIndex}, i ${i})`, err);
				}
			}
		}
	}

	return canvasToBlob(canvas);
}

