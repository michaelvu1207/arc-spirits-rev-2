import { supabase, type Rev2Client } from '$lib/api/supabaseClient';
import type { EditionScenarioRow, ScenarioRow } from '$lib/types/gameData';

export async function fetchAllScenarioRecords(client: Rev2Client = supabase): Promise<ScenarioRow[]> {
	const { data, error } = await client
		.from('scenarios')
		.select('id, edition_id, name, display_name, description, is_enabled, game_location_ids, display_image_path, order_num, created_at, updated_at')
		.order('name', { ascending: true });
	if (error) throw error;
	return (data ?? []) as ScenarioRow[];
}

export async function fetchEditionScenarioLinks(
	editionId: string,
	client: Rev2Client = supabase
): Promise<EditionScenarioRow[]> {
	const { data, error } = await client
		.from('edition_scenarios')
		.select('edition_id, scenario_id, order_num, created_at, updated_at')
		.eq('edition_id', editionId)
		.order('order_num', { ascending: true });
	if (error) throw error;
	return (data ?? []) as EditionScenarioRow[];
}

export async function setScenarioEnabledInEdition(
	editionId: string,
	scenarioId: string,
	enabled: boolean,
	client: Rev2Client = supabase
): Promise<void> {
	if (!editionId || !scenarioId) return;

	if (!enabled) {
		const { error } = await client
			.from('edition_scenarios')
			.delete()
			.eq('edition_id', editionId)
			.eq('scenario_id', scenarioId);
		if (error) throw error;
		return;
	}

	// Upsert with next available order_num for this edition.
	const { data: maxData, error: maxErr } = await client
		.from('edition_scenarios')
		.select('order_num')
		.eq('edition_id', editionId)
		.order('order_num', { ascending: false })
		.limit(1);
	if (maxErr) throw maxErr;

	const currentMax = (maxData?.[0]?.order_num ?? -1) as number;
	const nextOrder = currentMax + 1;

	const { error: upsertErr } = await client.from('edition_scenarios').upsert({
		edition_id: editionId,
		scenario_id: scenarioId,
		order_num: nextOrder,
		updated_at: new Date().toISOString()
	});
	if (upsertErr) throw upsertErr;
}

