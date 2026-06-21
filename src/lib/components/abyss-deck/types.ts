import type { MonsterRow, StageCardRow, SpecialEffectRow, RewardRow } from '$lib/types/gameData';

export type AbyssScenario = {
	id: string;
	name: string;
	description: string | null;
	order_num: number;
	created_at: string | null;
	updated_at: string | null;
};

export type ScenarioCard = {
	id: string;
	scenario_id: string;
	card_type: 'monster' | 'stage_card';
	card_id: string;
	order_num: number;
	created_at: string | null;
};

export type ResolvedRewardRow = RewardRow & {
	icon_urls: (string | null)[];
};

export type Monster = MonsterRow & {
	/** Number of copies of this monster in the selected edition deck. */
	quantity: number;
	icon_url: string | null;
	art_url: string | null;
	effects?: SpecialEffectRow[];
	invade_location_name?: string | null;
};

export type StageCard = StageCardRow & {
	art_url: string | null;
};

/** Legacy alias (Stage Cards supersede Event Cards). */
export type Event = StageCard;

export type ScenarioCardWithData = ScenarioCard & {
	card_data: Monster | StageCard;
};
