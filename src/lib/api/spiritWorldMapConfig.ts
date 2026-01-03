import { supabase } from '$lib/api/supabaseClient';
import type { SpiritWorldMapConfigRow } from '$lib/types/gameData';
import {
	loadSpiritWorldMapConfig,
	normalizeSpiritWorldMapConfig,
	saveSpiritWorldMapConfig,
	type SpiritWorldMapConfig
} from '$lib/generators/spirit-world/spiritWorldMapConfig';

export const DEFAULT_SPIRIT_WORLD_MAP_CONFIG_NAME = 'default';

export async function fetchSpiritWorldMapConfig(
	name = DEFAULT_SPIRIT_WORLD_MAP_CONFIG_NAME
): Promise<SpiritWorldMapConfig> {
	try {
		const { data, error } = await supabase
			.from('spirit_world_map_configs')
			.select('config')
			.eq('name', name)
			.maybeSingle<Pick<SpiritWorldMapConfigRow, 'config'>>();

		if (error) throw error;
		if (!data?.config) return loadSpiritWorldMapConfig();
		return normalizeSpiritWorldMapConfig(data.config);
	} catch (err) {
		console.warn('Failed to fetch Spirit World map config from DB; using local fallback.', err);
		return loadSpiritWorldMapConfig();
	}
}

export async function upsertSpiritWorldMapConfig(
	config: SpiritWorldMapConfig,
	name = DEFAULT_SPIRIT_WORLD_MAP_CONFIG_NAME
): Promise<SpiritWorldMapConfig> {
	const normalized = normalizeSpiritWorldMapConfig(config);
	try {
		const { data, error } = await supabase
			.from('spirit_world_map_configs')
			.upsert({ name, config: normalized }, { onConflict: 'name', ignoreDuplicates: false })
			.select('config')
			.maybeSingle<Pick<SpiritWorldMapConfigRow, 'config'>>();

		if (error) throw error;

		const saved = data?.config ? normalizeSpiritWorldMapConfig(data.config) : normalized;
		saveSpiritWorldMapConfig(saved);
		return saved;
	} catch (err) {
		console.warn('Failed to save Spirit World map config to DB; saving locally only.', err);
		saveSpiritWorldMapConfig(normalized);
		return normalized;
	}
}

