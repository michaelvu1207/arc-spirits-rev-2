import type { MonsterRow, EventRow, SpecialEffectRow, RewardRow, TradeRow, GainRow } from '$lib/types/gameData';

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
	card_type: 'monster' | 'event';
	card_id: string;
	order_num: number;
	created_at: string | null;
};

export type ResolvedRewardRow = RewardRow & {
	icon_urls: (string | null)[];
};

export type Monster = MonsterRow & {
	icon_url: string | null;
	art_url: string | null;
	effects?: SpecialEffectRow[];
	traveler_subtext?: string | null;
	traveler_description?: string | null;
	trade_left_icon_ids?: string[];
	trade_right_icon_ids?: string[];
	trade_rows?: TradeRow[];
	gain_rows?: GainRow[];
	invade_location_name?: string | null;
};

export type Event = EventRow & {
	art_url: string | null;
};

export type ScenarioCardWithData = ScenarioCard & {
	card_data: Monster | Event;
};
