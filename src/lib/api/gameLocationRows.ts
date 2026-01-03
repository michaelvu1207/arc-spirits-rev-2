import { supabase } from '$lib/api/supabaseClient';
import type { GameLocationRowCompositionRow, GameLocationRowDesign } from '$lib/types/gameData';

export async function fetchGameLocationRows(locationId: string): Promise<GameLocationRowCompositionRow[]> {
	const { data, error } = await supabase
		.from('game_location_rows')
		.select('*')
		.eq('location_id', locationId)
		.order('row_index', { ascending: true });
	if (error) throw new Error(error.message);
	return (data ?? []) as GameLocationRowCompositionRow[];
}

export async function upsertGameLocationRow(params: {
	location_id: string;
	row_index: number;
	type: 'gain' | 'trade';
	config: GameLocationRowDesign;
	row_image_path?: string | null;
	pos_x?: number;
	pos_y?: number;
	scale?: number;
}): Promise<GameLocationRowCompositionRow> {
	const payload = {
		location_id: params.location_id,
		row_index: params.row_index,
		type: params.type,
		config: params.config as any,
		row_image_path: params.row_image_path ?? null,
		pos_x: params.pos_x ?? 0,
		pos_y: params.pos_y ?? 0,
		scale: params.scale ?? 1
	};

	const { data, error } = await supabase
		.from('game_location_rows')
		.upsert(payload, { onConflict: 'location_id,row_index' })
		.select('*')
		.single<GameLocationRowCompositionRow>();
	if (error) throw new Error(error.message);
	return data;
}

export async function updateGameLocationRow(
	id: string,
	patch: Partial<Pick<GameLocationRowCompositionRow, 'config' | 'row_image_path' | 'pos_x' | 'pos_y' | 'scale'>>
): Promise<GameLocationRowCompositionRow> {
	const { data, error } = await supabase
		.from('game_location_rows')
		.update(patch as any)
		.eq('id', id)
		.select('*')
		.single<GameLocationRowCompositionRow>();
	if (error) throw new Error(error.message);
	return data;
}

