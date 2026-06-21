import { supabase } from '$lib/api/supabaseClient';
import type { CardType } from '$lib/generators/shared/layoutTypes';

/**
 * Load a card layout config from the unified card_layout_configs table.
 * Returns the raw JSONB config or null if not found.
 */
export async function loadLayoutConfig(
	cardType: CardType,
	configKey = 'base'
): Promise<{ config: unknown; error: Error | null }> {
	const { data, error } = await supabase
		.schema('arc_spirits_assets')
		.from('card_layout_configs')
		.select('config')
		.eq('card_type', cardType)
		.eq('config_key', configKey)
		.maybeSingle();

	if (error) return { config: null, error: new Error(error.message) };
	return { config: data?.config ?? null, error: null };
}

/**
 * Save a card layout config to the unified card_layout_configs table.
 * Upserts on (card_type, config_key).
 */
export async function saveLayoutConfig(
	cardType: CardType,
	configKey: string,
	config: unknown
): Promise<{ error: Error | null }> {
	const { error } = await supabase
		.schema('arc_spirits_assets')
		.from('card_layout_configs')
		.upsert(
			{
				card_type: cardType,
				config_key: configKey,
				config,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'card_type,config_key' }
		);

	if (error) return { error: new Error(error.message) };
	return { error: null };
}
