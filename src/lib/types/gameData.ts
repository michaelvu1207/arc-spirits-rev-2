export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type ClassType = 'normal' | 'special' | 'human';

export type CustomDiceRow = {
	id: string;
	name: string;
	/** Optional localized dice names keyed by language tag (e.g. 'es', 'fr-CA'). */
	name_translations?: Record<string, string> | null;
	description: string | null;
	/** Optional localized dice descriptions keyed by language tag (e.g. 'es', 'fr-CA'). */
	description_translations?: Record<string, string> | null;
	icon: string | null;
	color: string | null;
	category: string | null;
	dice_type: 'attack' | 'special';
	background_image_path: string | null;
	template_image_path: string | null;
	exported_template_path: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type DiceSideRow = {
	id: string;
	dice_id: string;
	side_number: number;
	reward_type: 'attack' | 'special';
	reward_value: string;
	reward_description: string | null;
	/** Optional localized reward descriptions keyed by language tag (e.g. 'es', 'fr-CA'). */
	reward_description_translations?: Record<string, string> | null;
	icon: string | null;
	image_path: string | null;
	template_x: number | null;
	template_y: number | null;
	created_at: string | null;
};

export type OriginRow = {
	id: string;
	name: string;
	is_enabled: boolean;
	position: number;
	icon_emoji: string | null;
	icon_png: string | null;
	icon_token_png: string | null;
	color: string | null;
	description: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type ClassRow = {
	id: string;
	name: string;
	/** Optional localized class names keyed by language tag (e.g. 'es', 'fr-CA'). */
	name_translations?: Record<string, string> | null;
	position: number;
	icon_emoji: string | null;
	icon_png: string | null;
	color: string | null;
	description: string | null;
	/** Optional localized class descriptions keyed by language tag (e.g. 'es', 'fr-CA'). */
	description_translations?: Record<string, string> | null;
	breakpoints: Json | null;
	prismatic: Json | null;
	tags: string[] | null;
	effect_schema: Json | null;
	footer: string | null;
	/** Optional localized class footers keyed by language tag (e.g. 'es', 'fr-CA'). */
	footer_translations?: Record<string, string> | null;
	class_type: ClassType;
	is_special: boolean;
	created_at: string | null;
	updated_at: string | null;
};

/**
 * A row in the `mat_items` catalog. Holds the two material concepts distinguished
 * by `kind`: origin-linked runes (`kind: 'rune'`) and relics (`kind: 'relic'`).
 * Spirit augments are no longer catalog rows — they are derived from augment classes.
 */
export type MatItemRow = {
	id: string;
	name: string;
	kind: 'rune' | 'relic';
	origin_id: string | null;
	/** Emoji character for relics (no origin). Null for origin runes. */
	emoji: string | null;
	icon_path: string | null;
	/** Optional per-item background image used when generating mat icons. */
	icon_background_path: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type AwakenRuneToken =
	| string
	| { kind: 'or'; rune_ids: string[] };

export type AwakenCondition =
	| { type: 'rune_cost'; rune_ids: AwakenRuneToken[] }
	| { type: 'text'; text: string };

export type HexSpiritRow = {
	id: string;
	name: string;
	description: string | null;
	/** Optional localized names keyed by language tag (e.g. 'es', 'fr-CA'). */
	name_translations?: Record<string, string> | null;
	/** Optional localized descriptions keyed by language tag (e.g. 'es', 'fr-CA'). */
	description_translations?: Record<string, string> | null;
	cost: number;
	traits: {
		origin_ids: string[];
		class_ids: string[];
	};
	created_at: string | null;
	game_print_image_path: string | null;
	game_print_no_icons_path: string | null;
	art_raw_image_path: string | null;
	updated_at: string | null;
	/** Optional override for the PSD folder used during Photoshop export. If null, folder is derived from cost. */
	psd_folder_override: string | null;
	/** Awaken condition: rune cost or text. Null means no condition. */
	awaken_condition: AwakenCondition | null;
	/** If true, game_print_image_path is manually set and should not be overwritten by icon placer. */
	manual_game_print: boolean;
	/** Uploaded base image for the back side (no icons). */
	back_side_base: string | null;
	/** Final back side image (exported with icons or manually set). */
	back_side_export: string | null;
	/** Combined front+back texture for TTS Custom_Model hex tokens. */
	tts_combined_image_path: string | null;
};

export type UnitRow = HexSpiritRow;

export type HexSpiritArtRawVariantSource = 'original' | 'uploaded' | 'generated';

export type HexSpiritArtRawVariantRow = {
	id: string;
	hex_spirit_id: string;
	label: string;
	description: string | null;
	storage_path: string;
	source: HexSpiritArtRawVariantSource;
	prompt: string | null;
	game_print_no_icons_path: string | null;
	game_print_image_path: string | null;
	back_side_base_path: string | null;
	back_side_export_path: string | null;
	tts_combined_image_path: string | null;
	is_variation_selected: boolean;
	pipeline_status: string | null;
	pipeline_error: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type RewardRowTagRow = {
	id: string;
	name: string;
	color: string;
	created_at: string | null;
	updated_at: string | null;
};

export type GuardianRow = {
	id: string;
	name: string;
	/** Optional localized names keyed by language tag (e.g. 'es', 'fr-CA'). */
	name_translations?: Record<string, string> | null;
	origin_id: string;
	image_mat_path: string | null;
	chibi_image_path: string | null;
	icon_image_path: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type QuestRow = {
	id: string;
	name: string;
	description: string;
	victory_points: number;
	created_at: string | null;
	updated_at: string | null;
};

export type ExtraComponentRow = {
	id: string;
	name: string;
	description: string | null;
	image_path: string | null;
	created_at: string | null;
	updated_at: string | null;
};

// Centralized icon pool for reward icons
// All icon sources (origins, classes, runes, dice_sides) sync to this table via triggers
// Uploaded icons are inserted directly into this table
export type IconPoolSourceType = 'origin' | 'class' | 'rune' | 'dice_side' | 'uploaded';

export type IconPoolRow = {
	id: string;
	name: string;
	description?: string | null;
	/** Optional localized icon descriptions keyed by language tag (e.g. 'es', 'fr-CA'). */
	description_translations?: Record<string, string> | null;
	icon_guide_name?: string | null;
	/** Optional localized Icon Guide name keyed by language tag (e.g. 'es', 'fr-CA'). */
	icon_guide_name_translations?: Record<string, string> | null;
	icon_guide_group?: string | null;
	/** Optional localized Icon Guide group label keyed by language tag (e.g. 'es', 'fr-CA'). */
	icon_guide_group_translations?: Record<string, string> | null;
	icon_guide_position?: number | null;
	source_type: IconPoolSourceType;
	source_id: string | null;
	source_table: string | null; // 'origins' | 'classes' | 'runes' | 'dice_sides' | null (for uploaded)
	file_path: string;
	metadata?: Record<string, unknown>; // Source-specific data (color, position, origin_id, etc.)
	tags?: string[]; // Tags for organizing icons, especially uploaded ones
	export_as_token?: boolean;
	created_at: string | null;
	updated_at: string | null;
};

// Reward row types for monster cards
export type RewardRowType =
	| 'all_players'
	| 'all_in_combat'
	| 'all_in_combat_pick_one'
	| 'all_losers'
	| 'all_winners'
	| 'one_winner'
	| 'tournament';

export type RewardRow = {
	type: RewardRowType;
	icon_ids: string[];
	label?: string; // Optional custom label override
};

// Display configuration for each reward row type
export const REWARD_ROW_CONFIG: Record<RewardRowType, { label: string; color: string; bgColor: string; borderColor: string }> = {
	all_players: { label: 'ALL PLAYERS GAIN', color: '#f472b6', bgColor: 'rgba(244, 114, 182, 0.12)', borderColor: 'rgba(244, 114, 182, 0.4)' },
	all_in_combat: { label: 'ALL IN COMBAT GAIN', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.12)', borderColor: 'rgba(251, 191, 36, 0.4)' },
	all_in_combat_pick_one: { label: 'ALL IN COMBAT PICK 1', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.12)', borderColor: 'rgba(251, 191, 36, 0.4)' },
	all_losers: { label: 'ALL LOSERS GAIN', color: '#f87171', bgColor: 'rgba(248, 113, 113, 0.12)', borderColor: 'rgba(248, 113, 113, 0.4)' },
	all_winners: { label: 'ALL WINNERS GAIN', color: '#4ade80', bgColor: 'rgba(74, 222, 128, 0.12)', borderColor: 'rgba(74, 222, 128, 0.4)' },
	one_winner: { label: 'ONE WINNER GAINS', color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.12)', borderColor: 'rgba(56, 189, 248, 0.4)' },
	tournament: { label: 'TOURNAMENT', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.12)', borderColor: 'rgba(251, 191, 36, 0.4)' }
};

export type MonsterRow = {
	id: string;
	name: string;
	/** Optional localized names keyed by language tag (e.g. 'es', 'fr-CA'). */
	name_translations?: Record<string, string> | null;
	damage: number;
	barrier: number;
	/** Flat array of up to 6 icon IDs awarded on kill. */
	reward_track: string[];
	stage: 'stage_1' | 'stage_2' | 'stage_3' | 'final_stage' | 'inactive';
	monster_classification: 'monster' | 'abyss_guardian' | 'boss' | 'final_boss';
	icon: string | null;
	image_path: string | null;
	order_num: number;
	/** Monster game print (NO INFO). Uploaded/script-processed base image used as input for the layout placer. */
	card_base_image_path: string | null;
	card_image_path: string | null;
	/** Optional per-language card image path keyed by language tag (e.g. 'es', 'fr-CA'). */
	card_image_path_translations?: Record<string, string> | null;
	special_conditions: string | null;
	/** Optional localized special_conditions keyed by language tag (e.g. 'es', 'fr-CA'). */
	special_conditions_translations?: Record<string, string> | null;
	invade_location_id: string | null;
	/** Array of icon_pool IDs representing the monster's dice pool. */
	dice_pool: string[];
	created_at: string | null;
	updated_at: string | null;
};

export type RarityTraitRow = {
	id: string;
	cost: number;
	origin_traits: number;
	class_traits: number;
	created_at: string | null;
	updated_at: string | null;
};

// Shop analysis / simulation settings
export type SimulationSettingsRow = {
	id: string;
	name: string;
	shop_size: number;
	draws_per_player: number;
	monster_counts: Json;
	monster_take_limits: Json;
	rarity_overrides: Json;
	metadata: Json;
	created_at: string;
	updated_at: string;
};

export type SimulationSettingsInsert = {
	id?: string;
	name: string;
	shop_size?: number;
	draws_per_player?: number;
	monster_counts?: Json;
	monster_take_limits?: Json;
	rarity_overrides?: Json;
	metadata?: Json;
	created_at?: string;
	updated_at?: string;
};

export type SimulationSettingsUpdate = Partial<SimulationSettingsInsert>;

export type StageCardKind = 'event' | 'stage_location' | (string & {});

export type StageCardRowBase = {
	id: string;
	/** Legacy internal identifier (historically set to id). */
	name: string;
	/** Stage card discriminator (e.g. event, stage_location, guide). */
	card_kind: StageCardKind;
	/** Narrative stage metadata (stage_1..endgame). */
	stage: import('./eventTypes').EventType;
	title: string;
	description: string | null;
	image_path: string | null;
	card_image_path: string | null;
	order_num: number;
	created_at: string | null;
	updated_at: string | null;
	/** Extensible payload for future card kinds. */
	data: Json;
	/** Optional location backing this stage card (stage_location cards). */
	game_location_id: string | null;
};

export type StageEventCardRow = StageCardRowBase & {
	card_kind: 'event';
	reward_rows: RewardRow[];
	game_location_id: null;
};

export type StageLocationCardRow = StageCardRowBase & {
	card_kind: 'stage_location';
	/** Not used for stage_location cards (reward rows come from game_locations). */
	reward_rows: RewardRow[];
	game_location_id: string;
};

export type StageCardRow = StageEventCardRow | StageLocationCardRow;

export type RewardIconToken =
	| string
	| {
			kind: 'or';
			icon_ids: string[];
	  };

export type GameLocationRewardRow = {
	type: 'gain';
	gain_icon_ids: RewardIconToken[];
} | {
	type: 'trade';
	cost_icon_ids: RewardIconToken[];
	gain_icon_ids: RewardIconToken[];
} | {
	type: 'text';
	text: string;
};

export type GameLocationRow = {
	id: string;
	name: string;
	origin_id: string | null;
	background_image_path: string | null;
	image_with_icons_path: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type LocationIconPlacementConfigRow = {
	id: string;
	name: string;
	config: Json;
	created_at: string | null;
	updated_at: string | null;
};

export type SpiritWorldMapConfigRow = {
	id: string;
	name: string;
	config: Json;
	created_at: string | null;
	updated_at: string | null;
};

export type GameLocationRowIconPlacement = {
	instance_id: string;
	icon_id: string;
	x: number;
	y: number;
};

export type GameLocationRowDesign =
	| {
			type: 'gain';
			icons: GameLocationRowIconPlacement[];
	  }
	| {
			type: 'trade';
			cost: GameLocationRowIconPlacement | null;
			gain: GameLocationRowIconPlacement[];
	  }
	| {
			type: 'text';
			text: string;
	  };

export type GameLocationRowCompositionRow = {
	id: string;
	name: string | null;
	type: 'gain' | 'trade' | 'text';
	config: Record<string, unknown>;
	row_image_path: string | null;
	tag_ids: string[];
	quantity: number;
	created_at: string | null;
	updated_at: string | null;
};

export type RewardRowAssignment = {
	id: string;
	location_id: string;
	row_id: string;
	row_index: number;
	pos_x: number;
	pos_y: number;
	scale: number;
	created_at: string;
};

/** Convert a standalone reward row's config + type into a GameLocationRewardRow. */
export function configToRewardRow(
	type: 'gain' | 'trade' | 'text',
	config: Record<string, unknown>
): GameLocationRewardRow {
	if (type === 'text') {
		return { type: 'text', text: typeof config.text === 'string' ? config.text : '' };
	}
	if (type === 'trade') {
		return {
			type: 'trade',
			cost_icon_ids: Array.isArray(config.cost_icon_ids) ? config.cost_icon_ids : [],
			gain_icon_ids: Array.isArray(config.gain_icon_ids) ? config.gain_icon_ids : []
		};
	}
	return {
		type: 'gain',
		gain_icon_ids: Array.isArray(config.gain_icon_ids) ? config.gain_icon_ids : []
	};
}

export type SpecialEffectType = 'before_combat' | 'during_combat' | 'after_combat' | 'combat_type';

export type SpecialEffectRow = {
	id: string;
	name: string;
	/** Optional localized names keyed by language tag (e.g. 'es', 'fr-CA'). */
	name_translations?: Record<string, string> | null;
	description: string | null;
	/** Optional localized description keyed by language tag (e.g. 'es', 'fr-CA'). */
	description_translations?: Record<string, string> | null;
	icon: string | null;
	color: string;
	effect_type: SpecialEffectType;
	created_at: string | null;
	updated_at: string | null;
};

export type MonsterSpecialEffectRow = {
	id: string;
	monster_id: string;
	special_effect_id: string;
	created_at: string | null;
};

export type MonsterV2Row = {
	id: string;
	name: string;
	name_translations?: Record<string, string> | null;
	attack_type: 'damage' | 'dice_pool';
	damage: number;
	barrier: number;
	stage: number;
	reward_track: string[];
	order_num: number;
	card_image_path: string | null;
	card_image_path_translations?: Record<string, string> | null;
	dice_pool: string[];
	choose_amount: number;
	created_at: string | null;
	updated_at: string | null;
};

export type CostDuplicates = Record<string, number>;

export type EditionRow = {
	id: string;
	name: string;
	description: string | null;
	origin_ids: string[];
	cost_duplicates: CostDuplicates;
	is_default: boolean;
	is_enabled: boolean;
	created_at: string | null;
	updated_at: string | null;
};


export type AbyssScenarioRow = {
	id: string;
	edition_id: string;
	name: string;
	/** Optional user-facing scenario name (fallback to `name`). */
	display_name: string | null;
	description: string | null;
	is_enabled: boolean;
	/** Optional curated list of game locations referenced by this scenario (separate from deck entries). */
	game_location_ids: string[];
	/** Optional display image path in storage (bucket-relative). */
	display_image_path: string | null;
	order_num: number;
	created_at: string | null;
	updated_at: string | null;
};

/** Current canonical table name for scenarios (abyss_scenarios is a compatibility view). */
export type ScenarioRow = AbyssScenarioRow;

export type EditionScenarioRow = {
	edition_id: string;
	scenario_id: string;
	order_num: number;
	created_at: string | null;
	updated_at: string | null;
};

export type ScenarioCardRow = {
	id: string;
	scenario_id: string;
	card_type: 'monster' | 'stage_card';
	card_id: string;
	order_num: number;
	quantity: number;
	created_at: string | null;
};

export type EventCardRow = {
	id: string;
	internal_name: string;
	stage: import('./eventTypes').EventType;
	title: string;
	description: string | null;
	reward_rows: RewardRow[];
	image_path: string | null;
	card_image_path: string | null;
	data: Json;
	order_num: number;
	created_at: string | null;
	updated_at: string | null;
};

export type StageCompletionCardRow = {
	id: string;
	title: string;
	complete_condition: string;
	reward_rows: RewardRow[];
	stage: import('./eventTypes').EventType;
	scenario_id: string | null;
	image_path: string | null;
	card_image_path: string | null;
	data: Json;
	order_num: number;
	created_at: string | null;
	updated_at: string | null;
};

export type ScenarioDeckEntryKind = 'monster' | 'location' | 'event' | 'stage_completion';

export type ScenarioDeckEntryRow = {
	id: string;
	scenario_id: string;
	kind: ScenarioDeckEntryKind;
	order_num: number;
	quantity: number;
	entry_stage: import('./eventTypes').EventType | null;
	data: Json;
	monster_id: string | null;
	game_location_id: string | null;
	event_id: string | null;
	stage_completion_card_id: string | null;
	legacy_scenario_card_id: string | null;
	created_at: string | null;
	updated_at: string | null;
};

// IconAsset type removed - consolidated into IconPoolRow with source_type='uploaded'

export type ThreeDModelRow = {
	id: string;
	name: string;
	obj_path: string | null;
	mtl_path: string | null;
	png_path: string | null;
	created_at: string;
	updated_at: string;
};

export type LookupService = {
	getLabel: (id: string | null, defaultValue?: string) => string;
	get: (id: string | null) => any;
};
