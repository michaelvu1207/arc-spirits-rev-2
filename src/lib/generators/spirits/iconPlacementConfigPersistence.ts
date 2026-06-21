import { supabase } from '$lib/api/supabaseClient';

const TABLE_NAME = 'hex_spirit_icon_placement_configs';

export type HexSpiritIconPlacementConfigKey = 'front' | 'back';

interface StoredIconPlacementConfig {
	key: HexSpiritIconPlacementConfigKey;
	config: unknown;
}

export async function loadHexSpiritIconPlacementConfig(
	key: HexSpiritIconPlacementConfigKey
): Promise<unknown | null> {
	const { data, error } = await supabase
		.from(TABLE_NAME)
		.select('key, config')
		.eq('key', key)
		.maybeSingle<StoredIconPlacementConfig>();

	if (error) {
		throw error;
	}

	return data?.config ?? null;
}

export async function saveHexSpiritIconPlacementConfig(
	key: HexSpiritIconPlacementConfigKey,
	config: unknown
): Promise<void> {
	const { error } = await supabase
		.from(TABLE_NAME)
		.upsert({ key, config }, { onConflict: 'key' });

	if (error) {
		throw error;
	}
}
