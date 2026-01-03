import { supabase } from '$lib/api/supabaseClient';
import type { LocationIconPlacementConfigRow } from '$lib/types/gameData';
import {
	loadLocationIconPlacementConfig,
	normalizeLocationIconPlacementConfig,
	saveLocationIconPlacementConfig,
	type LocationIconPlacementConfig
} from '$lib/generators/locations/locationIconPlacer';

export const DEFAULT_LOCATION_ICON_PLACEMENT_CONFIG_NAME = 'default';

export async function fetchLocationIconPlacementConfig(
	name = DEFAULT_LOCATION_ICON_PLACEMENT_CONFIG_NAME
): Promise<LocationIconPlacementConfig> {
	try {
		const { data, error } = await supabase
			.from('location_icon_placement_configs')
			.select('config')
			.eq('name', name)
			.maybeSingle<Pick<LocationIconPlacementConfigRow, 'config'>>();

		if (error) throw error;
		if (!data?.config) return loadLocationIconPlacementConfig();
		return normalizeLocationIconPlacementConfig(data.config);
	} catch (err) {
		console.warn('Failed to fetch location icon placement config from DB; using local fallback.', err);
		return loadLocationIconPlacementConfig();
	}
}

export async function upsertLocationIconPlacementConfig(
	config: LocationIconPlacementConfig,
	name = DEFAULT_LOCATION_ICON_PLACEMENT_CONFIG_NAME
): Promise<LocationIconPlacementConfig> {
	const normalized = normalizeLocationIconPlacementConfig(config);
	try {
		const { data, error } = await supabase
			.from('location_icon_placement_configs')
			.upsert({ name, config: normalized }, { onConflict: 'name', ignoreDuplicates: false })
			.select('config')
			.maybeSingle<Pick<LocationIconPlacementConfigRow, 'config'>>();

		if (error) throw error;

		const saved = data?.config ? normalizeLocationIconPlacementConfig(data.config) : normalized;
		saveLocationIconPlacementConfig(saved);
		return saved;
	} catch (err) {
		console.warn('Failed to save location icon placement config to DB; saving locally only.', err);
		saveLocationIconPlacementConfig(normalized);
		return normalized;
	}
}

