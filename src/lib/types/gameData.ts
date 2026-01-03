export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type CustomDiceRow = {
	id: string;
	name: string;
	description: string | null;
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
	icon: string | null;
	image_path: string | null;
	template_x: number | null;
	template_y: number | null;
	created_at: string | null;
};

export type OriginRow = {
	id: string;
	name: string;
	position: number;
	icon_emoji: string | null;
	icon_png: string | null;
	icon_token_png: string | null;
	color: string | null;
	description: string | null;
	calling_card: Json | null;
	created_at: string | null;
	updated_at: string | null;
};

export type CallingCardBreakpoint = {
	count: number; // e.g., 3 or 6 for "3 Unique", "6 Unique"
	label?: string; // optional label like "Unique" or custom
	icon_ids: string[]; // Array of icon pool IDs to display for this breakpoint
};

export type CallingCardEffect = {
	type: 'benefit';
	description: string;
	value?: number;
};

export type CallingCard = {
	enabled: boolean;
	hex_spirit_id: string | null; // The Hex Spirit this calling card summons
	breakpoints: CallingCardBreakpoint[];
};

export type CallingOrbTemplateData = {
	backgroundImage: string | null;
	textPositions: {
		breakpointIndex: number;
		x: number;
		y: number;
		fontSize: number;
		color: string;
		fontWeight: string;
		gap?: number;
	}[];
};

export type CallingOrbImageRow = {
	id: string;
	origin_id: string;
	image_path: string;
	template_data: Json | null;
	created_at: string | null;
	updated_at: string | null;
};

export type ClassRow = {
	id: string;
	name: string;
	position: number;
	icon_emoji: string | null;
	icon_png: string | null;
	color: string | null;
	description: string | null;
	breakpoints: Json | null;
	prismatic: Json | null;
	tags: string[] | null;
	effect_schema: Json | null;
	footer: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type RuneRow = {
	id: string;
	name: string;
	origin_id: string | null;
	class_id: string | null;
	icon_path: string | null;
	/** Optional per-rune background image used when generating rune icons. */
	icon_background_path: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type HexSpiritRow = {
	id: string;
	name: string;
	cost: number;
	traits: {
		origin_ids: string[];
		class_ids: string[];
	};
	created_at: string | null;
	game_print_image_path: string | null;
	game_print_no_icons: string | null;
	art_raw_image_path: string | null;
	updated_at: string | null;
	/** Optional override for the PSD folder used during Photoshop export. If null, folder is derived from cost. */
	psd_folder_override: string | null;
	/** Array of rune IDs required to play this spirit. Duplicates mean multiple of that rune needed. */
	rune_cost: string[];
	/** If true, game_print_image_path is manually set and should not be overwritten by icon placer. */
	manual_game_print: boolean;
};

export type SpiritIconSlot = never; // legacy placeholder removed

export type UnitRow = HexSpiritRow;

export type ArtifactTagRow = {
	id: string;
	name: string;
	color: string;
	created_at: string | null;
	updated_at: string | null;
};

export type ArtifactRecipeEntry = {
	rune_id: string;
	quantity: number;
};

export type ArtifactRow = {
	id: string;
	name: string;
	benefit: string;
	recipe_box: ArtifactRecipeEntry[];
	guardian_id: string | null;
	/** legacy fields kept optional for UI compatibility (removed in DB) */
	origin_id?: string | null;
	class_id?: string | null;
	tags?: string[] | null;
	tag_ids: string[] | null;
	quantity: number;
	card_image_path: string | null;
	created_at: string | null;
	updated_at: string | null;
	template_id: string | null;
};

export type GuardianRow = {
	id: string;
	name: string;
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
export type RewardRowType = 'all_in_combat' | 'all_losers' | 'all_winners' | 'one_winner' | 'tournament';

export type RewardRow = {
	type: RewardRowType;
	icon_ids: string[];
	label?: string; // Optional custom label override
};

export type TradeRow = {
	left_icon_ids: string[];
	right_icon_ids: string[];
	left_icon_groups?: string[][];
	right_icon_groups?: string[][];
};

export type GainRow = {
	icon_ids: string[];
	icon_groups?: string[][];
};

// Display configuration for each reward row type
export const REWARD_ROW_CONFIG: Record<RewardRowType, { label: string; color: string; bgColor: string; borderColor: string }> = {
	all_in_combat: { label: 'ALL IN COMBAT GAIN', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.12)', borderColor: 'rgba(251, 191, 36, 0.4)' },
	all_losers: { label: 'ALL LOSERS GAIN', color: '#f87171', bgColor: 'rgba(248, 113, 113, 0.12)', borderColor: 'rgba(248, 113, 113, 0.4)' },
	all_winners: { label: 'ALL WINNERS GAIN', color: '#4ade80', bgColor: 'rgba(74, 222, 128, 0.12)', borderColor: 'rgba(74, 222, 128, 0.4)' },
	one_winner: { label: 'ONE WINNER GAINS', color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.12)', borderColor: 'rgba(56, 189, 248, 0.4)' },
	tournament: { label: 'TOURNAMENT', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.12)', borderColor: 'rgba(251, 191, 36, 0.4)' }
};

export type MonsterRow = {
	id: string;
	name: string;
	damage: number;
	barrier: number;
	state: 'tainted' | 'corrupt' | 'fallen' | 'boss';
	icon: string | null;
	image_path: string | null;
	reward_rows: RewardRow[];
	order_num: number;
	card_image_path: string | null;
	special_conditions: string | null;
	invade_location_id: string | null;
	/** Number of copies of this monster in the deck. Defaults to 1. */
	quantity: number;
	created_at: string | null;
	updated_at: string | null;
	// Legacy fields kept for migration compatibility
	reward_icons?: string[];
	reward_header_type?: 'default' | 'tournament';
};

export type TravelerRow = {
	id: string;
	name: string;
	damage: number;
	barrier: number;
	state: 'tainted' | 'corrupt' | 'fallen' | 'boss';
	icon: string | null;
	image_path: string | null;
	reward_rows: RewardRow[];
	trade_left_icon_ids: string[];
	trade_right_icon_ids: string[];
	trade_rows: TradeRow[];
	gain_rows: GainRow[];
	order_num: number;
	card_image_path: string | null;
	special_conditions: string | null;
	traveler_subtext: string | null;
	traveler_description: string | null;
	invade_location_id: string | null;
	/** Number of copies of this traveler in the deck. Defaults to 1. */
	quantity: number;
	created_at: string | null;
	updated_at: string | null;
	// Legacy fields kept for migration compatibility
	reward_icons?: string[];
	reward_header_type?: 'default' | 'tournament';
};

export type TravelerQuestRow = {
	id: string;
	title: string;
	description: string | null;
	reward_text: string | null;
	/** JSON array of icon_pool UUIDs */
	reward_icon_ids: string[];
	tags: string[];
	order_num: number;
	card_image_path: string | null;
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

export type ArtifactTemplateRow = {
	id: string;
	name: string;
	config: Json;
	is_active: boolean;
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

export type EventRow = {
	id: string;
	name: string;
	title: string;
	description: string | null;
	image_path: string | null;
	card_image_path: string | null;
	order_num: number;
	created_at: string | null;
	updated_at: string | null;
};

export type GameLocationRewardRow = {
	type: 'gain';
	gain_icon_ids: string[];
} | {
	type: 'trade';
	cost_icon_ids: string[];
	gain_icon_ids: string[];
};

export type GameLocationRow = {
	id: string;
	name: string;
	origin_id: string | null;
	reward_rows: GameLocationRewardRow[];
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
	  };

export type GameLocationRowCompositionRow = {
	id: string;
	location_id: string;
	row_index: number;
	type: 'gain' | 'trade';
	config: Json;
	row_image_path: string | null;
	pos_x: number;
	pos_y: number;
	scale: number;
	created_at: string | null;
	updated_at: string | null;
};

export type SpecialEffectRow = {
	id: string;
	name: string;
	description: string | null;
	icon: string | null;
	color: string;
	created_at: string | null;
	updated_at: string | null;
};

export type MonsterSpecialEffectRow = {
	id: string;
	monster_id: string;
	special_effect_id: string;
	created_at: string | null;
};

export type TravelerSpecialEffectRow = {
	id: string;
	traveler_id: string;
	special_effect_id: string;
	created_at: string | null;
};

export type CostDuplicates = Record<string, number>;

export type EditionRow = {
	id: string;
	name: string;
	description: string | null;
	origin_ids: string[];
	cost_duplicates: CostDuplicates;
	is_default: boolean;
	created_at: string | null;
	updated_at: string | null;
};

export type SpecialCategoryRow = {
	id: string;
	name: string;
	description: string | null;
	color: string | null;
	icon_emoji: string | null;
	position: number;
	slot_1_class_ids: string[];
	slot_2_class_ids: string[];
	slot_3_class_ids: string[];
	created_at: string | null;
	updated_at: string | null;
};

export type AbyssScenarioRow = {
	id: string;
	name: string;
	description: string | null;
	order_num: number;
	created_at: string | null;
	updated_at: string | null;
};

export type ScenarioCardRow = {
	id: string;
	scenario_id: string;
	card_type: 'monster' | 'event';
	card_id: string;
	order_num: number;
	created_at: string | null;
};

// IconAsset type removed - consolidated into IconPoolRow with source_type='uploaded'
