export type SpiritWorldLocationPlacement = {
	/** X position in background pixel space (top-left origin). */
	x: number;
	/** Y position in background pixel space (top-left origin). */
	y: number;
	/** Scale multiplier applied to the placed location image. */
	scale: number;
	/** Rotation in degrees (clockwise). */
	rotation: number;
};

export type SpiritWorldMapConfig = {
	/** Storage path in `game_assets` bucket (relative path). */
	background_image_path: string | null;
	/** Storage path in `game_assets` bucket (relative path). */
	generated_image_path: string | null;
	/** Per-row placement keyed by placement id (e.g. `${locationId}:${rowIndex}`). */
	placements: Record<string, SpiritWorldLocationPlacement>;
	/** Hide all tooltip labels in the editor/export. */
	hide_all_labels?: boolean;
};

export function createDefaultSpiritWorldMapConfig(): SpiritWorldMapConfig {
	return {
		background_image_path: null,
		generated_image_path: null,
		placements: {},
		hide_all_labels: false
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asFiniteNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizePlacement(value: unknown): SpiritWorldLocationPlacement | null {
	if (!isRecord(value)) return null;
	const x = asFiniteNumber(value.x, 0);
	const y = asFiniteNumber(value.y, 0);
	const scale = Math.max(0, asFiniteNumber(value.scale, 1));
	const rotation = asFiniteNumber(value.rotation, 0);
	return { x, y, scale, rotation };
}

export function normalizeSpiritWorldMapConfig(input: unknown): SpiritWorldMapConfig {
	const defaults = createDefaultSpiritWorldMapConfig();
	if (input === null || input === undefined) return defaults;

	let raw: unknown = input;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw) as unknown;
		} catch {
			return defaults;
		}
	}

	if (!isRecord(raw)) return defaults;

	const background_image_path = typeof raw.background_image_path === 'string'
		? raw.background_image_path
		: null;
	const generated_image_path = typeof raw.generated_image_path === 'string'
		? raw.generated_image_path
		: null;
	const hide_all_labels = typeof raw.hide_all_labels === 'boolean' ? raw.hide_all_labels : defaults.hide_all_labels;

	const placements: Record<string, SpiritWorldLocationPlacement> = {};

	// Preferred: placements is a record keyed by location id.
	if (isRecord(raw.placements)) {
		for (const [locationId, placementRaw] of Object.entries(raw.placements)) {
			if (typeof locationId !== 'string' || !locationId) continue;
			const placement = sanitizePlacement(placementRaw);
			if (!placement) continue;
			placements[locationId] = placement;
		}
	}

	// Back-compat: placements array with { location_id, x, y, scale }.
	if (Array.isArray(raw.placements)) {
		for (const entry of raw.placements) {
			if (!isRecord(entry)) continue;
			const locationId = typeof entry.location_id === 'string' ? entry.location_id : null;
			if (!locationId) continue;
			const placement = sanitizePlacement(entry);
			if (!placement) continue;
			placements[locationId] = placement;
		}
	}

	return {
		background_image_path,
		generated_image_path,
		placements,
		hide_all_labels
	};
}

export function loadSpiritWorldMapConfig(): SpiritWorldMapConfig {
	if (typeof window === 'undefined') return createDefaultSpiritWorldMapConfig();
	const stored = localStorage.getItem('spirit_world_map_config');
	if (!stored) return createDefaultSpiritWorldMapConfig();
	try {
		return normalizeSpiritWorldMapConfig(stored);
	} catch {
		return createDefaultSpiritWorldMapConfig();
	}
}

export function saveSpiritWorldMapConfig(config: SpiritWorldMapConfig): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('spirit_world_map_config', JSON.stringify(config));
}
