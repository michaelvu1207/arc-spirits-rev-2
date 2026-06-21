import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

type SpiritRow = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  cost: number;
  traits: { origin_ids?: string[]; class_ids?: string[] } | null;
  game_print_image_path: string | null;
  back_side_export: string | null;
  tts_combined_image_path: string | null;
};

type NamedId = { id: string; name: string };

type NamedIdWithTranslations = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
};

type GuardianRow = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  origin_id: string | null;
  image_mat_path: string | null;
  chibi_image_path: string | null;
  icon_image_path: string | null;
};

type RewardRowData = {
  type: string;
  icon_ids: string[];
  label?: string;
};

type ResolvedIcon = { id: string; name: string; image_url: string | null };
type ResolvedRewardRow = { type: string; label: string | null; icons: ResolvedIcon[] };

type MonsterRow = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  stage: string | null;
  barrier: number | null;
  damage: number | null;
  invade_location_id: string | null;
  order_num: number | null;
  card_image_path: string | null;
  card_image_path_translations?: Record<string, string> | null;
  card_base_image_path: string | null;
  /** Flat array of up to 4 icon IDs awarded on kill. */
  reward_track: string[] | null;
  /** Array of icon_pool IDs representing the monster's dice pool. */
  dice_pool: string[] | null;
  special_conditions: string | null;
  special_conditions_translations?: Record<string, string> | null;
};

type MonsterV2Row = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  attack_type: string;
  damage: number;
  barrier: number;
  stage: number;
  order_num: number;
  card_image_path: string | null;
  card_image_path_translations?: Record<string, string> | null;
  reward_track: string[] | null;
  dice_pool: string[] | null;
};

type StageCompletionCardDbRow = {
  id: string;
  title: string;
  complete_condition: string;
  stage: string;
  reward_rows: RewardRowData[] | null;
  image_path: string | null;
  card_image_path: string | null;
  data: unknown | null;
  order_num: number | null;
};

type StageDividerDbRow = {
  id: string;
  stage_completion: string | null;
  data: unknown | null;
};

type ScenarioDeckEntryDbRow = {
  id: string;
  kind: string;
  order_num: number | null;
  quantity: number | null;
  entry_stage: string | null;
  monster_id: string | null;
  game_location_id: string | null;
  event_id: string | null;
  stage_divider_id: string | null;
  stage_completion_card_id: string | null;
  data: unknown | null;
};

type EventCardDbRow = {
  id: string;
  internal_name: string;
  stage: string | null;
  title: string;
  description: string | null;
  reward_rows: RewardRowData[] | null;
  image_path: string | null;
  card_image_path: string | null;
  data: unknown | null;
  order_num: number | null;
};

type SpecialEffectRow = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  description: string | null;
  description_translations?: Record<string, string> | null;
  icon: string | null;
  color: string;
};

type MonsterSpecialEffectRow = {
  monster_id: string;
  special_effect_id: string;
  position: number | null;
};

// MiscAssetRow removed - now using icon_pool with source_type='uploaded' instead

type EditionRow = {
  id: string;
  name: string;
  origin_ids: string[] | null;
  cost_duplicates: Record<string, number> | null;
};

type RuneRow = {
  id: string;
  name: string;
  origin_id: string | null;
  class_id: string | null;
  emoji: string | null;
  icon_path: string | null;
};

type CustomDiceRow = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  description: string | null;
  description_translations?: Record<string, string> | null;
  icon: string | null;
  color: string | null;
  dice_type: "attack" | "special";
  exported_template_path: string | null;
  background_image_path: string | null;
};

type DiceSideRow = {
  id: string;
  dice_id: string;
  side_number: number;
  reward_type: "attack" | "special";
  reward_value: string;
  reward_description: string | null;
  reward_description_translations?: Record<string, string> | null;
};

type ClassRow = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  position: number;
  icon_emoji: string | null;
  icon_png: string | null;
  color: string | null;
  description: string | null;
  description_translations?: Record<string, string> | null;
  tags: string[] | null;
  effect_schema: unknown | null;
  footer: string | null;
  footer_translations?: Record<string, string> | null;
  class_type: "normal" | "special" | "human";
  is_special: boolean;
};

type OriginRow = {
  id: string;
  name: string;
  position: number;
  color: string | null;
  description: string | null;
  icon_png: string | null;
  calling_card: {
    enabled: boolean;
    hex_spirit_id: string | null;
    breakpoints: { count: number; label?: string; icon_ids: string[] }[];
  } | null;
};

type CallingOrbImageRow = {
  id: string;
  origin_id: string;
  image_path: string;
};

type HexSpiritBasic = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  cost: number;
  game_print_image_path: string | null;
  back_side_export: string | null;
  tts_combined_image_path: string | null;
  traits: { origin_ids?: string[]; class_ids?: string[] } | null;
};

type IconPoolRow = {
  id: string;
  name: string;
  description?: string | null;
  description_translations?: Record<string, string> | null;
  icon_guide_name?: string | null;
  icon_guide_name_translations?: Record<string, string> | null;
  icon_guide_group?: string | null;
  icon_guide_group_translations?: Record<string, string> | null;
  icon_guide_position?: number | null;
  source_type: string;
  file_path: string | null;
  tags: string[] | null;
  export_as_token: boolean;
  metadata?: {
    description?: string | null;
    file_type?: string | null;
    file_size?: number | null;
  } | null;
};

type GameLocationRow = {
  id: string;
  name: string;
  origin_id: string | null;
  background_image_path: string | null;
  image_with_icons_path: string | null;
};

type GameLocationRowJoinedRow = {
  row_id: string;
  location_id: string;
  row_index: number;
  type: string;
  config: unknown;
  row_image_path: string | null;
};

type AllRewardRowDbRow = {
  id: string;
  name: string | null;
  type: string;
  config: unknown;
  row_image_path: string | null;
  tag_ids: string[] | null;
  quantity: number;
};

type SpiritWorldMapConfigPathsRow = {
  background_image_path: string | null;
  generated_image_path: string | null;
  layout_v2_location_ids: unknown | null;
};

type StorageObjectMetaRow = {
  mimetype: string | null;
  size: string | null;
  updated_at: unknown;
};

type StorageObjectMetaWithNameRow = {
  path: string;
  mimetype: string | null;
  size: string | null;
  updated_at: unknown;
};

const SCHEMA = "arc_spirits_assets";
const BUCKET = "game_assets";

const stringify = (obj: unknown) =>
  JSON.stringify(obj, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

const normalizeLanguageTag = (value: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/_/g, "-").toLowerCase();
  if (!normalized) return null;
  if (normalized === "base" || normalized === "default") return null;
  return normalized;
};

const sanitizeLanguageForPath = (lang: string) =>
  lang
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const getTranslationValue = (record: unknown, lang: string): string | null => {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const normalizedLang = normalizeLanguageTag(lang) ?? lang.trim().toLowerCase();
  if (!normalizedLang) return null;

  const obj = record as Record<string, unknown>;
  const direct = obj[normalizedLang];
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = normalizeLanguageTag(key) ?? key.trim().toLowerCase();
    if (!normalizedKey || normalizedKey !== normalizedLang) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
};

const pickLocalizedText = (
  base: string | null | undefined,
  translations: unknown,
  lang: string | null,
) => {
  if (!lang) return base ?? null;
  return getTranslationValue(translations, lang) ?? base ?? null;
};

const localizeClassEffectSchema = (schema: unknown, lang: string | null) => {
  if (!lang) return schema ?? null;
  if (!Array.isArray(schema)) return schema ?? null;

  return schema.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const bp = raw as Record<string, unknown>;

    let count = bp.count;
    if (typeof count === "string") {
      const translatedCount = getTranslationValue(bp.count_translations, lang);
      if (translatedCount) count = translatedCount;
    }

    let description = bp.description;
    const translatedDescription = getTranslationValue(bp.description_translations, lang);
    if (translatedDescription) description = translatedDescription;

    const effectsRaw = Array.isArray(bp.effects) ? bp.effects : [];
    const effects = effectsRaw.map((effectRaw) => {
      if (!effectRaw || typeof effectRaw !== "object" || Array.isArray(effectRaw)) return effectRaw;
      const effect = effectRaw as Record<string, unknown>;
      const type = effect.type;
      if (type === "benefit") {
        const baseDesc = typeof effect.description === "string" ? effect.description : "";
        const translatedDesc = getTranslationValue(effect.description_translations, lang);
        const next = { ...effect, description: translatedDesc ?? baseDesc };
        delete (next as any).description_translations;
        return next;
      }
      if (type === "flat_stat") {
        const baseCondition = typeof effect.condition === "string" ? effect.condition : "";
        const translatedCondition = getTranslationValue(effect.condition_translations, lang);
        const next = { ...effect };
        if (translatedCondition) next.condition = translatedCondition;
        else if (baseCondition) next.condition = baseCondition;
        delete (next as any).condition_translations;
        return next;
      }
      return effect;
    });

    const next = { ...bp, count, description, effects };
    delete (next as any).count_translations;
    delete (next as any).description_translations;
    return next;
  });
};

// Storage render base URL (image transformation endpoint)
const storageRenderBaseUrl = (req: Request) => {
  const host = new URL(req.url).host; // e.g., gvxfokbptelmvvlxbigh.functions.supabase.co
  const projectRef = host.split(".")[0];
  return `https://${projectRef}.supabase.co/storage/v1/render/image/public/${BUCKET}/`;
};

// Storage object base URL (direct file endpoint)
const storageObjectBaseUrl = (req: Request) => {
  const host = new URL(req.url).host; // e.g., gvxfokbptelmvvlxbigh.functions.supabase.co
  const projectRef = host.split(".")[0];
  return `https://${projectRef}.supabase.co/storage/v1/object/public/${BUCKET}/`;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  // Allow Supabase client headers (apikey/authorization) and typical JSON requests
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Expose-Headers": "content-disposition, last-modified, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Parse edition query parameter (default to "Base")
  const url = new URL(req.url);
  const editionName = url.searchParams.get("edition") ?? "Base";
  const scenarioIdParam = url.searchParams.get("scenario_id");
  const scenarioNameParam = url.searchParams.get("scenario");
  const exportLang = normalizeLanguageTag(url.searchParams.get("lang"));
  const exportLangPath = exportLang ? sanitizeLanguageForPath(exportLang) : null;
  // Asset compression toggle: when ?compressed=1, every game_assets URL in the
  // response is rewritten to its compressed counterpart from public.asset_compressed.
  // Default is off so existing clients are unaffected. Falls back per-URL if the
  // compressed row is missing.
  const compressedFlag = ((): boolean => {
    const v = url.searchParams.get("compressed");
    return v === "1" || v === "true" || v === "yes";
  })();

  const dbUrl =
    Deno.env.get("SUPABASE_DB_URL") ??
    Deno.env.get("SUPABASE_DB_CONNECTION_STRING") ??
    Deno.env.get("DATABASE_URL");
  if (!dbUrl) return new Response("Database connection string not set", { status: 500, headers: corsHeaders });

  const client = new Client(dbUrl);
  await client.connect();

  try {
    // Fetch the edition first
    const editionRes = await client.queryObject<EditionRow>(
      `select id, name, origin_ids, cost_duplicates from "${SCHEMA}".editions where name = $1`,
      [editionName]
    );

    if (editionRes.rows.length === 0) {
      return new Response(`Edition "${editionName}" not found`, { status: 404, headers: corsHeaders });
    }

    const edition = editionRes.rows[0];
    const editionOriginIds = edition.origin_ids ?? [];
    const costDuplicates = edition.cost_duplicates ?? {};

    type ScenarioRow = {
      id: string;
      name: string;
      display_name: string | null;
      description: string | null;
      game_location_ids: string[] | null;
      display_image_path: string | null;
      order_num: number | null;
    };
    let scenario: ScenarioRow | null = null;

    if (scenarioIdParam) {
      const scenarioRes = await client.queryObject<ScenarioRow>(
        `select s.id, s.name, s.display_name, s.description, s.game_location_ids, s.display_image_path, es.order_num
         from "${SCHEMA}".edition_scenarios es
         join "${SCHEMA}".scenarios s on s.id = es.scenario_id
         where s.id = $1 and es.edition_id = $2`,
        [scenarioIdParam, edition.id]
      );
      if (scenarioRes.rows.length === 0) {
        return new Response(`Scenario not found for edition "${edition.name}"`, { status: 404, headers: corsHeaders });
      }
      scenario = scenarioRes.rows[0];
    } else if (scenarioNameParam) {
      const scenarioRes = await client.queryObject<ScenarioRow>(
        `select s.id, s.name, s.display_name, s.description, s.game_location_ids, s.display_image_path, es.order_num
         from "${SCHEMA}".edition_scenarios es
         join "${SCHEMA}".scenarios s on s.id = es.scenario_id
         where es.edition_id = $1 and s.name = $2`,
        [edition.id, scenarioNameParam]
      );
      if (scenarioRes.rows.length === 0) {
        return new Response(`Scenario "${scenarioNameParam}" not found for edition "${edition.name}"`, {
          status: 404,
          headers: corsHeaders,
        });
      }
      scenario = scenarioRes.rows[0];
    } else {
      const scenarioRes = await client.queryObject<ScenarioRow>(
        `select s.id, s.name, s.display_name, s.description, s.game_location_ids, s.display_image_path, es.order_num
         from "${SCHEMA}".edition_scenarios es
         join "${SCHEMA}".scenarios s on s.id = es.scenario_id
         where es.edition_id = $1
         order by es.order_num, s.name
         limit 1`,
        [edition.id]
      );
      scenario = scenarioRes.rows[0] ?? null;
    }

    const scenarioId = scenario?.id ?? null;

	    const [
	      originsRes,
	      classesRes,
	      guardiansRes,
		      scenarioDeckEntriesRes,
		      monstersRes,
			      eventCardsRes,
			      gameLocationsRes,
		      gameLocationRowsRes,
		      allRewardRowsRes,
		      spiritsRes,
		      runesRes,
		      originsFullRes,
	      callingOrbsRes,
	      hexSpiritsBasicRes,
	      customDiceRes,
	      classesFullRes,
	      diceSidesRes,
	      tokensRes,
		      allIconsRes,
		      specialEffectsRes,
		      monsterSpecialEffectsRes,
		      stageCompletionCardsRes,
	      stageDividersRes,
	      screenshotsRes,
	      threeDModelsRes,
	      monstersV2Res,
	    ] = await Promise.all([
	      client.queryObject<NamedId>(`select id, name from "${SCHEMA}".origins`),
	      client.queryObject<NamedIdWithTranslations>(`select id, name, name_translations from "${SCHEMA}".classes`),
	      client.queryObject<GuardianRow>(
	        `select id, name, name_translations, origin_id, image_mat_path, chibi_image_path, icon_image_path from "${SCHEMA}".guardians`
	      ),
		      client.queryObject<ScenarioDeckEntryDbRow>(
		        `select
		          id, kind, order_num, quantity, entry_stage,
		          monster_id, game_location_id, event_id,
		          stage_divider_id, stage_completion_card_id, data
	        from "${SCHEMA}".scenario_deck_entries
	        where scenario_id = $1
	        order by order_num`,
	        [scenarioId]
	      ),
	      // Simple table queries (no JOINs needed)
	      client.queryObject<MonsterRow>(
	        `select id, name, name_translations, stage, barrier, damage, invade_location_id, order_num,
	          card_image_path, card_image_path_translations, card_base_image_path, reward_track,
	          dice_pool, special_conditions, special_conditions_translations
	        from "${SCHEMA}".monsters`
	      ),
		      client.queryObject<EventCardDbRow>(
		        `select id, internal_name, stage, title, description, reward_rows, image_path, card_image_path, data, order_num
		        from "${SCHEMA}".event_cards`
		      ),
			      client.queryObject<GameLocationRow>(
		        `select id, name, origin_id, background_image_path, image_with_icons_path from "${SCHEMA}".game_locations order by name`
		      ),
		      client.queryObject<GameLocationRowJoinedRow>(
		        `select r.id as row_id, a.location_id, a.row_index, r.type, r.config, r.row_image_path
		         from "${SCHEMA}".reward_row_assignments a
		         join "${SCHEMA}".game_location_rows r on r.id = a.row_id
		         order by a.location_id, a.row_index`
		      ),
		      client.queryObject<AllRewardRowDbRow>(
		        `select id, name, type, config, row_image_path, tag_ids, quantity
		         from "${SCHEMA}".game_location_rows
		         order by name`
		      ),
		      client.queryObject<SpiritRow>(
		        `select id, name, name_translations, cost, traits, game_print_image_path, back_side_export, tts_combined_image_path from "${SCHEMA}".hex_spirits`
		      ),
	      client.queryObject<RuneRow>(`select id, name, origin_id, class_id, emoji, icon_path from "${SCHEMA}".runes`),
	      // Full origins with calling card data
	      client.queryObject<OriginRow>(`select id, name, position, color, description, icon_png, calling_card from "${SCHEMA}".origins order by position`),
	      // Calling orb images
	      client.queryObject<CallingOrbImageRow>(`select id, origin_id, image_path from "${SCHEMA}".calling_orb_images`),
	      // Basic hex spirit info for calling card associations
	      client.queryObject<HexSpiritBasic>(
	        `select id, name, name_translations, cost, game_print_image_path, back_side_export, tts_combined_image_path, traits from "${SCHEMA}".hex_spirits`
	      ),
	      // Custom dice with their prefab templates
	      client.queryObject<CustomDiceRow>(`select id, name, name_translations, description, description_translations, icon, color, dice_type, exported_template_path, background_image_path from "${SCHEMA}".custom_dice`),
	      // Full classes with effect schema (contains dice_id references in breakpoints)
	      client.queryObject<ClassRow>(`select id, name, name_translations, position, icon_emoji, icon_png, color, description, description_translations, tags, effect_schema, footer, footer_translations, class_type, is_special from "${SCHEMA}".classes order by position`),
	      // Dice sides for face value counts
	      client.queryObject<DiceSideRow>(`select id, dice_id, side_number, reward_type, reward_value, reward_description, reward_description_translations from "${SCHEMA}".dice_sides order by dice_id, side_number`),
	      // Tokens from icon_pool marked for export
	      client.queryObject<IconPoolRow>(`select id, name, source_type, file_path, tags, export_as_token from "${SCHEMA}".icon_pool where export_as_token = true order by name`),
	      // All icons from icon_pool for reward resolution and full export
	      client.queryObject<IconPoolRow>(`select id, name, description, description_translations, icon_guide_name, icon_guide_name_translations, icon_guide_group, icon_guide_group_translations, icon_guide_position, source_type, file_path, tags, export_as_token, metadata from "${SCHEMA}".icon_pool order by source_type, name`),
	      // Special effects definitions
	      client.queryObject<SpecialEffectRow>(`select id, name, name_translations, description, description_translations, icon, color from "${SCHEMA}".special_effects`),
		      // Monster-to-special-effects junction (with position for ordering)
		      client.queryObject<MonsterSpecialEffectRow>(`select monster_id, special_effect_id, position from "${SCHEMA}".monster_special_effects order by monster_id, position`),
		      // Stage completion cards
	      client.queryObject<StageCompletionCardDbRow>(
	        `select id, title, complete_condition, stage, reward_rows, image_path, card_image_path, data, order_num from "${SCHEMA}".stage_completion_cards`
	      ),
	      // Stage dividers
	      client.queryObject<StageDividerDbRow>(`select id, stage_completion, data from "${SCHEMA}".stage_dividers`),
	      // Screenshot uploads (storage bucket)
	      client.queryObject<StorageObjectMetaWithNameRow>(
	        `select path, mimetype, size, updated_at from "${SCHEMA}".screenshots_export order by path`,
	      ),
	      // 3D models
	      client.queryObject<{ id: string; name: string; obj_path: string | null; mtl_path: string | null; png_path: string | null }>(
	        `select id, name, obj_path, mtl_path, png_path from "${SCHEMA}".three_d_models order by name`,
	      ),
	      // Monsters V2 (abyss deck)
	      client.queryObject<MonsterV2Row>(
	        `select id, name, name_translations, attack_type, damage, barrier, stage, order_num,
	          card_image_path, card_image_path_translations, reward_track, dice_pool
	        from "${SCHEMA}".monsters_v2 order by order_num`,
	      ),
	    ]);

	    const originMap = new Map(originsRes.rows.map((r) => [r.id, r.name]));
	    const classMap = new Map(classesRes.rows.map((r) => [r.id, pickLocalizedText(r.name, r.name_translations, exportLang) ?? r.name]));
	    const gameLocationNameById = new Map(gameLocationsRes.rows.map((r) => [r.id, r.name]));
	    const gameLocationRowImageMap = new Map(
	      gameLocationRowsRes.rows.map((r) => [`${r.location_id}:${r.row_index}`, r.row_image_path])
	    );
	    // Build a map of location_id → sorted joined reward rows from the junction table
	    const locationRewardRowsMap = new Map<string, GameLocationRowJoinedRow[]>();
	    for (const r of gameLocationRowsRes.rows) {
	      const arr = locationRewardRowsMap.get(r.location_id) ?? [];
	      arr.push(r);
	      locationRewardRowsMap.set(r.location_id, arr);
	    }
	    const base = storageRenderBaseUrl(req);
	    const objectBase = storageObjectBaseUrl(req);
    const resolveStorageImageUrl = (path: string | null): string | null =>
      path ? `${base}${encodeURI(path)}?quality=80` : null;
    const resolveStorageObjectUrl = (path: string | null, params?: Record<string, string>): string | null => {
      if (!path) return null;
      const url = new URL(`${objectBase}${encodeURI(path)}`);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.set(k, v);
        }
      }
      return url.toString();
    };

    const toCacheBustParam = (value: unknown): string | null => {
      if (!value) return null;
      if (value instanceof Date) return String(value.getTime());
      if (typeof value === "number" && Number.isFinite(value)) return String(Math.floor(value));
      if (typeof value === "string") {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? String(parsed) : null;
      }
      return null;
    };

	    // Build icon map for reward resolution (id -> { name, file_path, description })
	    const iconMap = new Map(
	      allIconsRes.rows.map((r) => [
	        r.id,
	        {
	          name: r.name,
	          file_path: r.file_path,
	          description: pickLocalizedText(
	            typeof r.description === "string" ? r.description : null,
	            r.description_translations,
	            exportLang,
	          ),
	          icon_guide_name: pickLocalizedText(
	            typeof r.icon_guide_name === "string" && r.icon_guide_name.trim().length > 0
	              ? r.icon_guide_name.trim()
	              : null,
	            r.icon_guide_name_translations,
	            exportLang,
	          ),
	          icon_guide_group: pickLocalizedText(
	            typeof r.icon_guide_group === "string" && r.icon_guide_group.trim().length > 0
	              ? r.icon_guide_group.trim()
	              : null,
	            r.icon_guide_group_translations,
	            exportLang,
	          ),
	          icon_guide_position:
	            typeof r.icon_guide_position === "number" ? r.icon_guide_position : null,
	        },
	      ])
	    );

    const resolveIcon = (iconId: string) => {
      const iconData = iconMap.get(iconId);
      return {
        id: iconId,
        name: iconData?.name ?? "Unknown",
        image_url: resolveStorageImageUrl(iconData?.file_path ?? null),
      };
    };

    // Spirit World board export
    let spiritWorldBackgroundPath: string | null = null;
    let spiritWorldGeneratedPath: string | null = null;
    let spiritWorldLayoutV2LocationIds: string[] = [];

    const normalizeStringIdList = (value: unknown): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value) as unknown;
          return normalizeStringIdList(parsed);
        } catch {
          return [];
        }
      }
      return [];
    };

    try {
      const spiritWorldConfigRes = await client.queryObject<SpiritWorldMapConfigPathsRow>(
        `select
          config->>'background_image_path' as background_image_path,
          config->>'generated_image_path' as generated_image_path,
          config->'layout_v2'->'location_ids' as layout_v2_location_ids
        from "${SCHEMA}".spirit_world_map_configs
        where name = 'default'`
      );
      spiritWorldBackgroundPath = spiritWorldConfigRes.rows[0]?.background_image_path ?? null;
      spiritWorldGeneratedPath = spiritWorldConfigRes.rows[0]?.generated_image_path ?? null;
      spiritWorldLayoutV2LocationIds = normalizeStringIdList(
        spiritWorldConfigRes.rows[0]?.layout_v2_location_ids ?? null,
      );
    } catch (err) {
      console.warn(
        "Failed to load Spirit World map config; falling back to icon_pool SpiritWorld asset if present.",
        err,
      );
    }

    const spiritWorldIcon = allIconsRes.rows.find((i) =>
      i.name === "SpiritWorld" ||
      (Array.isArray(i.tags) && i.tags.includes("spirit_world"))
    );

    const spiritWorldBoardPath = spiritWorldGeneratedPath ?? spiritWorldIcon?.file_path ?? null;

    let spiritWorldBoardFileType: string | null = null;
    let spiritWorldBoardFileSize: string | null = null;
    let spiritWorldBoardCacheBust: string | null = null;

    if (spiritWorldBoardPath) {
      try {
        const metaRes = await client.queryObject<StorageObjectMetaRow>(
          `select
            metadata->>'mimetype' as mimetype,
            metadata->>'size' as size,
            updated_at
          from storage.objects
          where bucket_id = $1 and name = $2
          limit 1`,
          [BUCKET, spiritWorldBoardPath],
        );
        spiritWorldBoardFileType = metaRes.rows[0]?.mimetype ?? null;
        spiritWorldBoardFileSize = metaRes.rows[0]?.size ?? null;
        spiritWorldBoardCacheBust = toCacheBustParam(metaRes.rows[0]?.updated_at) ?? null;
      } catch (err) {
        console.warn("Failed to read Spirit World board storage metadata", err);
      }
    }

    // Spirit World export PNG can be too large for the render/transform endpoint; use the direct object URL.
    const spiritWorldBoardUrl = resolveStorageObjectUrl(
      spiritWorldBoardPath,
      spiritWorldBoardCacheBust ? { cb: spiritWorldBoardCacheBust } : undefined,
    );

    const individualLocationBoards = (() => {
      const includeSet = new Set(spiritWorldLayoutV2LocationIds);
      const shouldFilter = includeSet.size > 0;

      return gameLocationsRes.rows
        .filter((l) => l.image_with_icons_path !== null)
        .filter((l) => (shouldFilter ? includeSet.has(l.id) : true))
        .map((l) => ({
          id: l.id,
          name: l.name,
          file_type: null,
          file_size: null,
          image_url: resolveStorageObjectUrl(l.image_with_icons_path),
        }))
        .filter((b) => b.image_url !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    })();

    const boards = [
      ...allIconsRes.rows
        .filter((i) => Array.isArray(i.tags) && i.tags.includes("board"))
        .map((i) => ({
          id: i.id,
          name: i.name,
          file_type: i.metadata?.file_type ?? null,
          file_size: i.metadata?.file_size != null ? String(i.metadata.file_size) : null,
          image_url: resolveStorageObjectUrl(i.file_path),
        }))
        .filter((b) => b.image_url !== null && b.name !== "SpiritWorld"),
      ...(spiritWorldBoardUrl
        ? [
            {
              id: spiritWorldIcon?.id ?? "spirit-world",
              name: "SpiritWorld",
              file_type:
                spiritWorldBoardFileType ??
                (spiritWorldGeneratedPath
                  ? "image/png"
                  : spiritWorldIcon?.metadata?.file_type ?? null),
              file_size:
                spiritWorldBoardFileSize ??
                (spiritWorldIcon?.metadata?.file_size != null
                  ? String(spiritWorldIcon.metadata.file_size)
                  : null),
              image_url: spiritWorldBoardUrl,
              individual_location_board:
                individualLocationBoards.length > 0 ? { locations: individualLocationBoards } : null,
            },
          ]
        : []),
    ].sort((a, b) => a.name.localeCompare(b.name));

    const screenshots = screenshotsRes.rows.map((row) => {
      const path = row.path;
      const filename = path.split("/").pop() ?? path;
      const baseName = filename.replace(/\.[^.]+$/, "");
      const file_type = row.mimetype ?? null;
      const file_size = row.size ?? null;

      return {
        name: baseName,
        path,
        file_type,
        file_size,
        image_url: file_type?.startsWith("image/") ? resolveStorageImageUrl(path) : null,
        file_url: resolveStorageObjectUrl(path),
      };
    });

    const three_d_models = threeDModelsRes.rows.map((m) => ({
      id: m.id,
      name: m.name,
      obj_url: resolveStorageObjectUrl(m.obj_path),
      mtl_url: resolveStorageObjectUrl(m.mtl_path),
      png_url: resolveStorageObjectUrl(m.png_path),
    }));

    // Build monster -> effect IDs mapping (monster_id -> array of effect IDs)
    const monsterEffectsMap = new Map<string, string[]>();
    for (const mse of monsterSpecialEffectsRes.rows) {
      const existing = monsterEffectsMap.get(mse.monster_id) ?? [];
      existing.push(mse.special_effect_id);
      monsterEffectsMap.set(mse.monster_id, existing);
    }

    // Build special_effects lookup array for export
    const special_effects = specialEffectsRes.rows.map((e) => {
      const name = pickLocalizedText(e.name, e.name_translations, exportLang) ?? e.name;
      const description = pickLocalizedText(e.description, e.description_translations, exportLang);
      return {
        id: e.id,
        name,
        description,
        icon: e.icon,
        color: e.color,
      };
    });

    // Build lookup maps for stage_deck resolution
    const monsterMap = new Map(monstersRes.rows.map((m) => [m.id, m]));
    const eventCardMap = new Map(eventCardsRes.rows.map((c) => [c.id, c]));
    const stageCompletionCardMap = new Map(stageCompletionCardsRes.rows.map((sc) => [sc.id, sc]));
    const stageDividerMap = new Map(stageDividersRes.rows.map((sd) => [sd.id, sd]));

	    type LocationRewardRow =
	      | { type: "gain"; gain_icon_ids: string[] }
	      | { type: "trade"; cost_icon_ids: string[]; gain_icon_ids: string[] }
	      | { type: "text"; text: string };

	    const normalizeIconIds = (value: unknown): string[] =>
	      Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

	    const normalizeRewardTrack = (value: unknown): string[] => {
	      if (!value) return [];
	      if (typeof value === "string") {
	        try {
	          return normalizeRewardTrack(JSON.parse(value) as unknown);
	        } catch {
	          return [];
	        }
	      }
	      if (!Array.isArray(value)) return [];
	      return value
	        .filter((id): id is string => typeof id === "string")
	        .map((id) => id.trim())
	        .filter((id) => id.length > 0)
	        .slice(0, 4);
	    };

    const configToLocationRewardRow = (type: string, config: unknown): LocationRewardRow => {
      const cfg = (config && typeof config === "object") ? config as Record<string, unknown> : {};
      if (type === "text") {
        return { type: "text", text: typeof cfg.text === "string" ? cfg.text : "" };
      }
      if (type === "trade") {
        return {
          type: "trade",
          cost_icon_ids: normalizeIconIds(cfg.cost_icon_ids),
          gain_icon_ids: normalizeIconIds(cfg.gain_icon_ids),
        };
      }
      return { type: "gain", gain_icon_ids: normalizeIconIds(cfg.gain_icon_ids) };
    };

    const getJoinedRewardRows = (locationId: string): LocationRewardRow[] => {
      const joined = locationRewardRowsMap.get(locationId) ?? [];
      return joined.map((r) => configToLocationRewardRow(r.type, r.config));
    };

    // Build calling orb images map (origin_id -> image_path)
    const callingOrbMap = new Map(callingOrbsRes.rows.map((r) => [r.origin_id, r.image_path]));

    // Build hex spirits map for calling card associations
    const hexSpiritMap = new Map(hexSpiritsBasicRes.rows.map((r) => [r.id, r]));

    // Build dice sides map (dice_id -> sides array)
    const diceSidesMap = new Map<string, DiceSideRow[]>();
    for (const side of diceSidesRes.rows) {
      const existing = diceSidesMap.get(side.dice_id) ?? [];
      existing.push(side);
      diceSidesMap.set(side.dice_id, existing);
    }

    // Map origins with calling cards and calling orb images
    const origins = originsFullRes.rows.map((o) => {
      const icon_url = o.icon_png ? `${base}${encodeURI(o.icon_png)}?quality=80` : null;
      const callingOrbPath = callingOrbMap.get(o.id);
      const calling_orb_image_url = callingOrbPath ? `${base}${encodeURI(callingOrbPath)}?quality=80` : null;

      // Get associated hex spirit if calling card is enabled
      // Structure matches the hex_spirits array output exactly
      let associated_hex_spirit = null;
	      if (o.calling_card?.enabled && o.calling_card?.hex_spirit_id) {
	        const spirit = hexSpiritMap.get(o.calling_card.hex_spirit_id);
	        if (spirit) {
	          const spiritName = pickLocalizedText(spirit.name, spirit.name_translations, exportLang) ?? spirit.name;
	          const spiritOriginIds = spirit.traits?.origin_ids ?? [];
	          const spiritClassIds = spirit.traits?.class_ids ?? [];
	          associated_hex_spirit = {
	            id: spirit.id,
	            name: spiritName,
	            cost: spirit.cost,
	            traits: {
	              origins: spiritOriginIds.map((id) => ({ id, name: originMap.get(id) ?? null })),
	              classes: spiritClassIds.map((id) => ({ id, name: classMap.get(id) ?? null })),
            },
            image_url: spirit.game_print_image_path
              ? `${base}${encodeURI(spirit.game_print_image_path)}?quality=80`
              : null,
            back_image_url: spirit.back_side_export
              ? `${base}${encodeURI(spirit.back_side_export)}?quality=80`
              : null,
            combined_tts_image_url: spirit.tts_combined_image_path
              ? `${base}${encodeURI(spirit.tts_combined_image_path)}?quality=80`
              : null,
          };
        }
      }

      return {
        id: o.id,
        name: o.name,
        position: o.position,
        color: o.color,
        description: o.description,
        icon_url,
        calling_card: o.calling_card?.enabled
          ? {
              enabled: true,
              breakpoints: o.calling_card.breakpoints,
              hex_spirit_id: o.calling_card.hex_spirit_id,
            }
          : null,
        calling_orb_image_url,
        associated_hex_spirit,
      };
    });

    // Only include guardians that have a mat_image_path (playable guardians)
    const guardians = guardiansRes.rows
      .filter((g) => g.image_mat_path)
      .map((g) => {
        const origin_name = g.origin_id ? originMap.get(g.origin_id) ?? null : null;
        const name = pickLocalizedText(g.name, g.name_translations, exportLang) ?? g.name;
        const mat_image_url = `${base}${encodeURI(g.image_mat_path!)}?quality=80`;
        const chibi_image_url = g.chibi_image_path
          ? `${base}${encodeURI(g.chibi_image_path)}?quality=80`
          : null;
        const icon_image_url = g.icon_image_path
          ? `${base}${encodeURI(g.icon_image_path)}?quality=80`
          : null;
        // TTS Menu character select images (stored at known paths)
        const char_select_url = `${base}${encodeURI(`tts_menu/guardians/${g.id}/char_select.png`)}?quality=80`;
        // Player color selected images (6 colors)
        const char_select_red_url = `${base}${encodeURI(`tts_menu/guardians/${g.id}/red_selected.png`)}?quality=80`;
        const char_select_orange_url = `${base}${encodeURI(`tts_menu/guardians/${g.id}/orange_selected.png`)}?quality=80`;
        const char_select_yellow_url = `${base}${encodeURI(`tts_menu/guardians/${g.id}/yellow_selected.png`)}?quality=80`;
        const char_select_green_url = `${base}${encodeURI(`tts_menu/guardians/${g.id}/green_selected.png`)}?quality=80`;
        const char_select_blue_url = `${base}${encodeURI(`tts_menu/guardians/${g.id}/blue_selected.png`)}?quality=80`;
        const char_select_purple_url = `${base}${encodeURI(`tts_menu/guardians/${g.id}/purple_selected.png`)}?quality=80`;
        return {
          id: g.id,
          name,
          origin_id: g.origin_id,
          origin_name,
          mat_image_url,
          chibi_image_url,
          icon_image_url,
          char_select_url,
          char_select_red_url,
          char_select_orange_url,
          char_select_yellow_url,
          char_select_green_url,
          char_select_blue_url,
          char_select_purple_url,
        };
      });

    // Filter spirits by edition's origin_ids and duplicate based on cost_duplicates
    const hex_spirits: {
      id: string;
      name: string;
      cost: number;
      traits: { origins: { id: string; name: string | null }[]; classes: { id: string; name: string | null }[] };
      image_url: string | null;
      back_image_url: string | null;
      combined_tts_image_url: string | null;
      copy_index: number;
    }[] = [];

	    for (const s of spiritsRes.rows) {
	      const spiritOriginIds = s.traits?.origin_ids ?? [];

      // Check if spirit has at least one origin that matches the edition
      const hasMatchingOrigin = spiritOriginIds.some((oid) => editionOriginIds.includes(oid));
      if (!hasMatchingOrigin) continue;

      const origins = spiritOriginIds.map((id) => ({ id, name: originMap.get(id) ?? null }));
      const classes = (s.traits?.class_ids ?? []).map((id) => ({ id, name: classMap.get(id) ?? null }));
      const image_url = s.game_print_image_path
        ? `${base}${encodeURI(s.game_print_image_path)}?quality=80`
        : null;
      const back_image_url = s.back_side_export
        ? `${base}${encodeURI(s.back_side_export)}?quality=80`
        : null;
      const combined_tts_image_url = resolveStorageImageUrl(s.tts_combined_image_path);

      // Get duplicate count for this spirit's cost (default to 1)
      const duplicateCount = costDuplicates[String(s.cost)] ?? 1;

	      // Add copies based on duplicate count
	      for (let i = 0; i < duplicateCount; i++) {
	        const displayName = pickLocalizedText(s.name, s.name_translations, exportLang) ?? s.name;
	        hex_spirits.push({
	          id: s.id,
	          name: displayName,
	          cost: s.cost,
	          traits: { origins, classes },
	          image_url,
	          back_image_url,
	          combined_tts_image_url,
	          copy_index: i + 1,
        });
      }
    }

    // --- Resolver functions for stage_deck card data ---

    const resolveMonsterCard = (m: MonsterRow) => {
      const finalCardPath = pickLocalizedText(m.card_image_path, m.card_image_path_translations, exportLang);
      const baseCardPath = m.card_base_image_path ?? null;
      const image_url = (finalCardPath ?? baseCardPath)
        ? `${base}${encodeURI(finalCardPath ?? baseCardPath!)}?quality=80`
        : null;
      const image_url_final = finalCardPath ? `${base}${encodeURI(finalCardPath)}?quality=80` : null;
      const image_url_base = baseCardPath ? `${base}${encodeURI(baseCardPath)}?quality=80` : null;
      const reward_track = normalizeRewardTrack(m.reward_track);
      const reward_icons = reward_track.map(resolveIcon);
      const name = pickLocalizedText(m.name, m.name_translations, exportLang) ?? m.name;
      const invade_location_id = m.invade_location_id ?? null;
      const invade_location_name = invade_location_id ? gameLocationNameById.get(invade_location_id) ?? null : null;
      const effect_ids = monsterEffectsMap.get(m.id) ?? [];
      const dice_pool: string[] = Array.isArray(m.dice_pool) ? m.dice_pool : [];
      const special_conditions = pickLocalizedText(m.special_conditions, m.special_conditions_translations, exportLang);

      return {
        id: m.id,
        name,
        stage: m.stage,
        barrier: m.barrier,
        damage: m.damage,
        invade_location_id,
        invade_location_name,
        image_url,
        image_url_final,
        image_url_base,
        effect_ids,
        dice_pool,
        reward_track,
        reward_icons,
        special_conditions,
      };
    };

    const resolveMonsterV2Card = (m: MonsterV2Row) => {
      const finalCardPath = pickLocalizedText(m.card_image_path, m.card_image_path_translations, exportLang);
      const image_url = finalCardPath ? `${base}${encodeURI(finalCardPath)}?quality=80` : null;
      const reward_track = normalizeRewardTrack(m.reward_track);
      const reward_icons = reward_track.map(resolveIcon);
      const name = pickLocalizedText(m.name, m.name_translations, exportLang) ?? m.name;
      const dice_pool: string[] = Array.isArray(m.dice_pool) ? m.dice_pool : [];
      const dice_pool_icons = dice_pool.map(resolveIcon);

      return {
        id: m.id,
        name,
        attack_type: m.attack_type,
        stage: m.stage,
        barrier: m.barrier,
        damage: m.attack_type === "damage" ? m.damage : null,
        order_num: m.order_num,
        image_url,
        dice_pool,
        dice_pool_icons,
        reward_track,
        reward_icons,
      };
    };

    const monsters_v2 = monstersV2Res.rows.map(resolveMonsterV2Card);

    const resolveEventCard = (c: EventCardDbRow) => {
      const image_url = c.card_image_path ? `${base}${encodeURI(c.card_image_path)}?quality=80` : null;
      const reward_rows: ResolvedRewardRow[] = (c.reward_rows ?? []).map((row) => ({
        type: row.type,
        label: row.label ?? null,
        icons: (row.icon_ids ?? []).map(resolveIcon),
      }));

      return {
        id: c.id,
        name: c.title,
        description: c.description ?? null,
        stage: c.stage ?? null,
        image_url,
        reward_rows,
      };
    };

    const resolveLocationCard = (l: GameLocationRow) => {
      const origin_name = l.origin_id ? originMap.get(l.origin_id) ?? null : null;
      const image_url = l.image_with_icons_path
        ? `${base}${encodeURI(l.image_with_icons_path)}?quality=80`
        : null;
      const background_image_url = l.background_image_path
        ? `${base}${encodeURI(l.background_image_path)}?quality=80`
        : null;

      return {
        id: l.id,
        name: l.name,
        origin_id: l.origin_id,
        origin_name,
        image_url,
        background_image_url,
      };
    };

    const resolveStageCompletionCard = (sc: StageCompletionCardDbRow) => {
      const image_url = sc.card_image_path
        ? `${base}${encodeURI(sc.card_image_path)}?quality=80`
        : null;
      const reward_rows: ResolvedRewardRow[] = (sc.reward_rows ?? []).map((row) => ({
        type: row.type,
        label: row.label ?? null,
        icons: (row.icon_ids ?? []).map(resolveIcon),
      }));

      return {
        id: sc.id,
        title: sc.title,
        complete_condition: sc.complete_condition,
        stage: sc.stage,
        reward_rows,
        image_url,
      };
    };

    const resolveStageDividerCard = (sd: StageDividerDbRow) => ({
      id: sd.id,
      stage_completion: sd.stage_completion ?? null,
    });

    // --- Build unified stage_deck ---

    const stage_deck = scenarioDeckEntriesRes.rows.map((entry) => {
      const baseEntry = {
        kind: entry.kind,
        order_num: entry.order_num ?? 999,
        quantity: Math.max(1, Math.trunc(entry.quantity ?? 1)),
        entry_stage: entry.entry_stage ?? null,
        data: entry.data ?? null,
      };

      switch (entry.kind) {
        case "monster": {
          const m = entry.monster_id ? monsterMap.get(entry.monster_id) : undefined;
          return { ...baseEntry, card: m ? resolveMonsterCard(m) : null };
        }
        case "event": {
          const c = entry.event_id ? eventCardMap.get(entry.event_id) : undefined;
          return { ...baseEntry, card: c ? resolveEventCard(c) : null };
        }
        case "location": {
          const l = entry.game_location_id ? gameLocationsRes.rows.find((gl) => gl.id === entry.game_location_id) : undefined;
          return { ...baseEntry, card: l ? resolveLocationCard(l) : null };
        }
        case "stage_completion": {
          const sc = entry.stage_completion_card_id ? stageCompletionCardMap.get(entry.stage_completion_card_id) : undefined;
          return { ...baseEntry, card: sc ? resolveStageCompletionCard(sc) : null };
        }
        case "stage_divider": {
          const sd = entry.stage_divider_id ? stageDividerMap.get(entry.stage_divider_id) : undefined;
          return { ...baseEntry, card: sd ? resolveStageDividerCard(sd) : null };
        }
        default:
          return { ...baseEntry, card: null };
      }
    });

    // Map runes with origin/class names resolved
    const runes = runesRes.rows.map((r) => {
      const origin_name = r.origin_id ? originMap.get(r.origin_id) ?? null : null;
      const class_name = r.class_id ? classMap.get(r.class_id) ?? null : null;
      const icon_url = r.icon_path ? `${base}${encodeURI(r.icon_path)}?quality=80` : null;
      const type = r.origin_id ? "origin" : r.class_id ? "class" : "special";
      return {
        id: r.id,
        name: r.name,
        type,
        origin_id: r.origin_id,
        origin_name,
        class_id: r.class_id,
        class_name,
        emoji: r.emoji,
        icon_url,
      };
    });

    // Map custom dice with prefab template URLs and face counts
    const custom_dice = customDiceRes.rows.map((d) => {
      const prefab_image_url = d.exported_template_path
        ? `${base}${encodeURI(d.exported_template_path)}?quality=80`
        : null;
      const background_image_url = d.background_image_path
        ? `${base}${encodeURI(d.background_image_path)}?quality=80`
        : null;

      // Get sides for this dice and build faces array
      const sides = diceSidesMap.get(d.id) ?? [];
      const faces = sides.map((s) => ({
        side_number: s.side_number,
        reward_type: s.reward_type,
        reward_value: s.reward_value,
        reward_description: pickLocalizedText(s.reward_description, s.reward_description_translations, exportLang),
      }));

      return {
        id: d.id,
        name: pickLocalizedText(d.name, d.name_translations, exportLang) ?? d.name,
        description: pickLocalizedText(d.description, d.description_translations, exportLang),
        icon: d.icon,
        color: d.color,
        dice_type: d.dice_type,
        prefab_image_url,
        background_image_url,
        faces,
      };
    });

    // Map classes with effect schema (contains dice_id references in breakpoints)
    const classes = classesFullRes.rows.map((c) => {
      const icon_url = c.icon_png ? `${base}${encodeURI(c.icon_png)}?quality=80` : null;
      return {
        id: c.id,
        name: pickLocalizedText(c.name, c.name_translations, exportLang) ?? c.name,
        position: c.position,
        icon_emoji: c.icon_emoji,
        icon_url,
        color: c.color,
        description: pickLocalizedText(c.description, c.description_translations, exportLang),
        tags: c.tags,
        effect_schema: localizeClassEffectSchema(c.effect_schema, exportLang),
        footer: pickLocalizedText(c.footer, c.footer_translations, exportLang),
        class_type: c.class_type ?? (c.is_special ? "special" : "normal"),
        is_special: c.is_special,
      };
    });

    // Map tokens from icon_pool marked for export
    const tokens = tokensRes.rows.map((t) => {
      const image_url = t.file_path ? `${base}${encodeURI(t.file_path)}?quality=80` : null;
      return {
        id: t.id,
        name: t.name,
        source_type: t.source_type,
        image_url,
      };
    });

    // Map all icons from icon_pool
    const icon_pool = allIconsRes.rows.map((i) => {
      const isSpiritWorld =
        i.name === "SpiritWorld" ||
        (Array.isArray(i.tags) && i.tags.includes("spirit_world"));
      const image_url = isSpiritWorld ? spiritWorldBoardUrl : resolveStorageImageUrl(i.file_path);
      return {
        id: i.id,
        name: i.name,
        source_type: i.source_type,
        tags: i.tags ?? [],
        export_as_token: i.export_as_token,
        image_url,
      };
    });

    // TTS Menu configuration
    const tts_menu = {
      background_url: `${base}${encodeURI("tts_menu/background.png")}?quality=80`,
    };

	    // Map game locations with reward rows resolved via icon_pool.
	    // Include every table-backed location, then append the fixed Arcane Abyss location.
	    const tableGameLocations = gameLocationsRes.rows.map((l) => {
	      const origin_name = l.origin_id ? originMap.get(l.origin_id) ?? null : null;
	      const image_url = l.image_with_icons_path
	        ? `${base}${encodeURI(l.image_with_icons_path)}?quality=80`
        : null;
      const background_image_url = l.background_image_path
        ? `${base}${encodeURI(l.background_image_path)}?quality=80`
        : null;

	      const rewardRows = getJoinedRewardRows(l.id);
		      const reward_rows = rewardRows.map((row) => {
		        if (row.type === "trade") {
		          return {
		            type: "trade" as const,
		            cost_icons: (row.cost_icon_ids ?? []).map(resolveIcon),
		            gain_icons: (row.gain_icon_ids ?? []).map(resolveIcon),
		          };
		        }
		        if (row.type === "text") {
		          return {
		            type: "text" as const,
		            text: row.text ?? "",
		          };
		        }
		        return {
		          type: "gain" as const,
		          icons: (row.gain_icon_ids ?? []).map(resolveIcon),
		        };
		      });

	      return {
	        id: l.id,
	        name: l.name,
        origin_id: l.origin_id,
        origin_name,
        image_url,
        background_image_url,
	        reward_rows,
	      };
	    });

	    const arcaneAbyssLocation = {
	      id: "arcane_abyss",
	      name: "Arcane Abyss",
	      origin_id: null,
	      origin_name: null,
	      image_url: null,
	      background_image_url: null,
	      reward_rows: [],
	    };

	    const hasArcaneAbyss = tableGameLocations.some(
	      (l) => l.id === arcaneAbyssLocation.id || l.name.trim().toLowerCase() === "arcane abyss",
	    );
	    const game_locations = hasArcaneAbyss
	      ? tableGameLocations
	      : [...tableGameLocations, arcaneAbyssLocation];

	    // Build assignment lookup: row_id → assignment details[]
	    const assignmentsByRowId = new Map<string, { location_id: string; location_name: string; row_index: number }[]>();
	    for (const a of gameLocationRowsRes.rows) {
	      const arr = assignmentsByRowId.get(a.row_id) ?? [];
	      arr.push({
	        location_id: a.location_id,
	        location_name: gameLocationNameById.get(a.location_id) ?? "Unknown",
	        row_index: a.row_index,
	      });
	      assignmentsByRowId.set(a.row_id, arr);
	    }

	    // Export ALL reward rows (not just assigned ones)
	    const reward_rows = allRewardRowsRes.rows.map((r) => ({
	      id: r.id,
	      name: r.name,
	      tag_ids: r.tag_ids ?? [],
	      quantity: r.quantity ?? 1,
	      row_object: configToLocationRewardRow(r.type, r.config),
	      row_image_url: resolveStorageImageUrl(r.row_image_path),
	      assignments: assignmentsByRowId.get(r.id) ?? [],
	    }));

    // Icon Guide: icons manually pinned via icon_pool.tags ("icon_guide").
    const iconGuideIconIds = new Set<string>();
    for (const icon of allIconsRes.rows) {
      if (Array.isArray(icon.tags) && icon.tags.includes("icon_guide")) {
        iconGuideIconIds.add(icon.id);
      }
    }

    const icon_guide_icons = Array.from(iconGuideIconIds)
      .map((iconId) => {
        const iconData = iconMap.get(iconId);
        const displayName = iconData?.icon_guide_name ?? iconData?.name ?? "Unknown";
        return {
          id: iconId,
          group: iconData?.icon_guide_group ?? null,
          position: iconData?.icon_guide_position ?? null,
          name: displayName,
          description: iconData?.description ?? null,
          image_url: resolveStorageImageUrl(iconData?.file_path ?? null),
        };
      })
      .sort((a, b) => {
        const groupA = a.group;
        const groupB = b.group;
        const aHasGroup = groupA !== null;
        const bHasGroup = groupB !== null;
        if (aHasGroup !== bHasGroup) return aHasGroup ? -1 : 1;
        if (groupA && groupB) {
          const groupCmp = groupA.localeCompare(groupB, undefined, { sensitivity: "base" });
          if (groupCmp !== 0) return groupCmp;
        }
        const posA = a.position ?? Number.POSITIVE_INFINITY;
        const posB = b.position ?? Number.POSITIVE_INFINITY;
        if (posA !== posB) return posA - posB;
        return a.name.localeCompare(b.name);
      });

    const baseIconGuidePngPath = "exports/icon_guide/icon_guide.png";
    const legacyIconGuidePngPath = "exports/location_guide/location_guide.png";
    const iconGuidePngPath = exportLangPath
      ? `exports/icon_guide/icon_guide_${exportLangPath}.png`
      : baseIconGuidePngPath;
    // Always return the deterministic public URL; it may 404 if the PNG hasn't been exported yet.
    let icon_guide_png_url: string | null = resolveStorageObjectUrl(iconGuidePngPath);
    try {
      const metaRes = await client.queryObject<StorageObjectMetaRow>(
        `select
          metadata->>'mimetype' as mimetype,
          metadata->>'size' as size,
          updated_at
        from storage.objects
        where bucket_id = $1 and name = $2
        limit 1`,
        [BUCKET, iconGuidePngPath],
      );
      const cacheBust = toCacheBustParam(metaRes.rows[0]?.updated_at);
      if (metaRes.rows.length > 0) {
        icon_guide_png_url = resolveStorageObjectUrl(
          iconGuidePngPath,
          cacheBust ? { cb: cacheBust } : undefined,
        );
      } else if (exportLangPath) {
        const baseMetaRes = await client.queryObject<StorageObjectMetaRow>(
          `select
            metadata->>'mimetype' as mimetype,
            metadata->>'size' as size,
            updated_at
          from storage.objects
          where bucket_id = $1 and name = $2
          limit 1`,
          [BUCKET, baseIconGuidePngPath],
        );
        const baseCacheBust = toCacheBustParam(baseMetaRes.rows[0]?.updated_at);
        if (baseMetaRes.rows.length > 0) {
          icon_guide_png_url = resolveStorageObjectUrl(
            baseIconGuidePngPath,
            baseCacheBust ? { cb: baseCacheBust } : undefined,
          );
        }
      } else {
        const legacyMetaRes = await client.queryObject<StorageObjectMetaRow>(
          `select
            metadata->>'mimetype' as mimetype,
            metadata->>'size' as size,
            updated_at
          from storage.objects
          where bucket_id = $1 and name = $2
          limit 1`,
          [BUCKET, legacyIconGuidePngPath],
        );
        const legacyCacheBust = toCacheBustParam(legacyMetaRes.rows[0]?.updated_at);
        if (legacyMetaRes.rows.length > 0) {
          icon_guide_png_url = resolveStorageObjectUrl(
            legacyIconGuidePngPath,
            legacyCacheBust ? { cb: legacyCacheBust } : undefined,
          );
        }
      }
    } catch (err) {
      console.warn("Failed to read Icon Guide PNG storage metadata", err);
    }

    // Schema documentation
	    const schema_docs = `# Arc Spirits TTS Export Schema Documentation

## Overview

This document describes the JSON schema for the Arc Spirits Tabletop Simulator (TTS) export format.
Most image URLs use Supabase Storage render URLs with \`?quality=80\`. Large board images (e.g. SpiritWorld) use direct \`/storage/v1/object/public\` URLs.

			---

	## Root Object

		| Field | Type | Description |
		|-------|------|-------------|
			| \`exported_at\` | string | ISO 8601 timestamp of when the export was generated |
			| \`export_language\` | string | Language tag used to localize translatable fields (or \`base\`) |
			| \`edition\` | Edition | The edition configuration used for this export |
			| \`schema_docs\` | string | This documentation in markdown format |
			| \`origins\` | Origin[] | Array of origin factions |
			| \`classes\` | Class[] | Array of character classes |
			| \`hex_spirits\` | HexSpirit[] | Array of hex spirit cards (filtered by edition) |
		| \`stage_deck\` | StageDeckEntry[] | Unified ordered deck for the selected scenario (monster/event/location/stage_completion/stage_divider) |
		| \`game_locations\` | GameLocation[] | All table-backed game locations plus the hardcoded Arcane Abyss |
		| \`icon_guide_icons\` | IconGuideIcon[] | Icons manually pinned to the Icon Guide |
	| \`icon_guide_png_url\` | string \\| null | Public URL to the Icon Guide PNG (may 404 if not exported yet) |
	| \`special_effects\` | SpecialEffect[] | Array of special effect definitions |
	| \`guardians\` | Guardian[] | Array of playable guardian characters |
	| \`runes\` | Rune[] | Array of rune tokens |
	| \`tokens\` | Token[] | Array of game tokens from icon pool (export_as_token = true) |
	| \`icon_pool\` | IconPoolEntry[] | Complete icon pool with all icons (includes uploaded assets) |
	| \`custom_dice\` | CustomDice[] | Array of custom dice with face configurations |
	| \`tts_menu\` | TTSMenu | TTS menu configuration and assets |
	| \`screenshots\` | Screenshot[] | Array of screenshot/media uploads included in the export |
	| \`boards\` | Board[] | Array of board images (includes SpiritWorld) |
	| \`three_d_models\` | ThreeDModel[] | Array of 3D model assets (OBJ/MTL/PNG) |
	| \`monsters_v2\` | MonsterV2[] | Array of V2 (abyss deck) monster cards ordered by order_num |

---

	## Edition

	| Field | Type | Description |
	|-------|------|-------------|
		| \`name\` | string | Edition name (e.g., "Base", "Expansion") |
		| \`origin_count\` | number | Number of origins included in this edition |
		| \`cost_duplicates\` | Record<string, number> | Map of spirit cost to duplicate count |

		---

	## Origin

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Origin name |
| \`position\` | number | Display order |
| \`color\` | string \\| null | Hex color code |
| \`description\` | string \\| null | Origin description |
| \`icon_url\` | string \\| null | Origin icon image URL |
| \`calling_card\` | CallingCard \\| null | Calling card configuration if enabled |
| \`calling_orb_image_url\` | string \\| null | Calling orb image URL |
| \`associated_hex_spirit\` | HexSpirit \\| null | The hex spirit summoned by this calling card |

### CallingCard

| Field | Type | Description |
|-------|------|-------------|
| \`enabled\` | boolean | Whether calling card is active |
| \`breakpoints\` | Breakpoint[] | Array of breakpoint thresholds |
| \`hex_spirit_id\` | string \\| null | ID of the associated hex spirit |

### Breakpoint

| Field | Type | Description |
|-------|------|-------------|
| \`count\` | number | Number required (e.g., 3 for "3 Unique") |
| \`label\` | string | Optional label (e.g., "Unique") |
| \`icon_ids\` | string[] | Array of icon pool IDs to display |

---

## Class

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Class name |
| \`position\` | number | Display order |
| \`icon_emoji\` | string \\| null | Emoji representation |
| \`icon_url\` | string \\| null | Class icon image URL |
| \`color\` | string \\| null | Hex color code |
| \`description\` | string \\| null | Class description |
| \`tags\` | string[] \\| null | Class tags/categories |
| \`effect_schema\` | object \\| null | Class effect configuration (may contain dice_id references) |
| \`footer\` | string \\| null | Footer text for cards |
| \`special\` | string \\| null | Special category name if part of one |

---

## HexSpirit

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Spirit name |
| \`cost\` | number | Summoning cost |
| \`traits\` | Traits | Origin and class trait associations |
| \`image_url\` | string \\| null | Card image URL |
| \`copy_index\` | number | Copy number (1-based, for duplicate cards) |

### Traits

| Field | Type | Description |
|-------|------|-------------|
| \`origins\` | NamedRef[] | Array of origin references |
| \`classes\` | NamedRef[] | Array of class references |

### NamedRef

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID of the referenced entity |
| \`name\` | string \\| null | Resolved name |

---

## StageDeckEntry

The unified stage deck. Each entry represents one card in the scenario deck, with fully-resolved inline card data. Consumer handles quantity duplication.

| Field | Type | Description |
|-------|------|-------------|
| \`kind\` | string | Entry kind: "monster", "event", "location", "stage_completion", "stage_divider" |
| \`order_num\` | number | Sort order (default: 999) |
| \`quantity\` | number | Copies of this entry to include (default: 1). Consumer handles duplication. |
| \`entry_stage\` | string \\| null | Optional stage/row identifier for UI grouping |
| \`data\` | object \\| null | Optional per-entry custom JSON data |
| \`card\` | object \\| null | Fully-resolved card data (shape depends on \`kind\`). Null if referenced entity is missing. |

### Card shapes by kind

#### kind="monster"
| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Monster UUID |
| \`name\` | string | Monster name |
| \`stage\` | string \\| null | Monster stage |
| \`barrier\` | number \\| null | Barrier value |
| \`damage\` | number \\| null | Damage value |
| \`invade_location_id\` | string \\| null | Invade location UUID |
| \`invade_location_name\` | string \\| null | Resolved invade location name |
| \`image_url\` | string \\| null | Card image URL (prefers final, falls back to base) |
| \`image_url_final\` | string \\| null | Final card image URL |
| \`image_url_base\` | string \\| null | Base card image URL |
| \`effect_ids\` | string[] | Special effect UUIDs (lookup via special_effects) |
| \`dice_pool\` | string[] | Icon pool IDs for the monster's dice pool |
| \`reward_track\` | string[] | Flat array of up to 4 on-kill reward icon IDs |
| \`reward_icons\` | RewardIcon[] | Resolved on-kill reward icons |
| \`special_conditions\` | string \\| null | Special conditions text |

#### kind="event"
| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Event card UUID |
| \`name\` | string | Display title |
| \`description\` | string \\| null | Event description |
| \`stage\` | string \\| null | Event stage |
| \`image_url\` | string \\| null | Card image URL |
| \`reward_rows\` | RewardRow[] | Reward row configurations |

#### kind="location"
| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Game location UUID |
| \`name\` | string | Location name |
| \`origin_id\` | string \\| null | Associated origin UUID |
| \`origin_name\` | string \\| null | Resolved origin name |
| \`image_url\` | string \\| null | Location image URL (with icons) |
| \`background_image_url\` | string \\| null | Background image URL |

#### kind="stage_completion"
| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Stage completion card UUID |
| \`title\` | string | Card title |
| \`complete_condition\` | string | Condition text for stage completion |
| \`stage\` | string | Stage identifier |
| \`reward_rows\` | RewardRow[] | Reward row configurations |
| \`image_url\` | string \\| null | Card image URL |

#### kind="stage_divider"
| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Stage divider UUID |
| \`stage_completion\` | string \\| null | Stage completion text |

### RewardIcon

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Icon pool UUID |
| \`name\` | string | Icon name |
| \`image_url\` | string \\| null | Icon image URL |

### RewardRow

| Field | Type | Description |
|-------|------|-------------|
| \`type\` | string | Reward distribution type (all_in_combat, all_players, etc.) |
| \`label\` | string \\| null | Custom label override |
| \`icons\` | RewardIcon[] | Array of reward icons |

		## GameLocation

Game locations include their resolved reward rows and the generated location image (with icons).

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Location name |
| \`origin_id\` | string \\| null | Associated origin UUID |
| \`origin_name\` | string \\| null | Resolved origin name |
| \`image_url\` | string \\| null | Generated location image URL (with icons) |
| \`background_image_url\` | string \\| null | Background image URL (without icons) |
| \`reward_rows\` | LocationRewardRow[] | Array of reward rows (gain, trade, or text) |

### LocationRewardRow

- Gain row: \`{ type: "gain", icons: RewardIcon[] }\`
- Trade row: \`{ type: "trade", cost_icons: RewardIcon[], gain_icons: RewardIcon[] }\`
- Text row: \`{ type: "text", text: string }\`

## reward_rows (top-level)

Independent reward row list exported separately from \`game_locations\`.

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Composite key: \`{location_id}:{row_index}\` |
| \`location_id\` | string | Source game location UUID |
| \`location_name\` | string | Source game location name |
| \`row_index\` | number | 0-based index in that location's \`reward_rows\` |
| \`row_object\` | object | Normalized reward-row object |
| \`row_image_url\` | string \\| null | URL from \`game_location_rows.row_image_path\` |

---

## IconGuideIcon

Icons manually pinned to the Icon Guide (intended for a legend/guide UI).

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Icon pool UUID |
| \`group\` | string \\| null | Optional group label used to visually separate icons |
| \`position\` | number \\| null | Optional sort position within a group (lower numbers appear first) |
| \`name\` | string | Display name (uses Icon Guide name override when set) |
| \`description\` | string \\| null | Optional guide/legend description |
| \`image_url\` | string \\| null | Icon image URL |

---

## Icon Guide PNG

The latest exported Icon Guide PNG. This is generated via the web UI and stored at
\`exports/icon_guide/icon_guide.png\` in the \`${BUCKET}\` bucket.

| Field | Type | Description |
|-------|------|-------------|
| \`icon_guide_png_url\` | string \\| null | Public URL to the Icon Guide PNG (may 404 if not exported yet) |

---

## SpecialEffect

Reusable special effects that can be applied to monsters.

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Effect name (e.g., "Barrier", "Regenerate") |
| \`description\` | string \\| null | Effect description/rules text |
| \`icon\` | string \\| null | Emoji or icon identifier |
| \`color\` | string | Hex color code for display |

---

## Guardian

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Guardian name |
| \`origin_id\` | string \\| null | Associated origin UUID |
| \`origin_name\` | string \\| null | Resolved origin name |
| \`mat_image_url\` | string | Player mat image URL |
| \`chibi_image_url\` | string \\| null | Chibi character image URL |
| \`icon_image_url\` | string \\| null | Guardian icon URL |
| \`char_select_url\` | string | Character select screen image |
| \`char_select_red_url\` | string | Red player color variant |
| \`char_select_orange_url\` | string | Orange player color variant |
| \`char_select_yellow_url\` | string | Yellow player color variant |
| \`char_select_green_url\` | string | Green player color variant |
| \`char_select_blue_url\` | string | Blue player color variant |
| \`char_select_purple_url\` | string | Purple player color variant |

---

## Rune

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Rune name |
| \`type\` | "origin" \\| "class" | Rune category |
| \`origin_id\` | string \\| null | Origin UUID (if origin rune) |
| \`origin_name\` | string \\| null | Resolved origin name |
| \`class_id\` | string \\| null | Class UUID (if class rune) |
| \`class_name\` | string \\| null | Resolved class name |
| \`icon_url\` | string \\| null | Rune icon URL |

---

## Token

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Token name |
| \`source_type\` | string | Source category (origin, class, etc.) |
| \`image_url\` | string \\| null | Token image URL |

---

## IconPoolEntry

Complete icon pool entry with all metadata.

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Icon name |
| \`source_type\` | string | Source: "origin", "class", "rune", "dice_side", "uploaded" |
| \`tags\` | string[] | Tags for organization (primarily for uploaded icons) |
| \`export_as_token\` | boolean | Whether this icon is included in tokens array |
| \`image_url\` | string \\| null | Icon image URL |

---

## CustomDice

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Dice name |
| \`description\` | string \\| null | Dice description |
| \`icon\` | string \\| null | Emoji or icon identifier |
| \`color\` | string \\| null | Hex color code |
| \`dice_type\` | "attack" \\| "special" | Dice category |
| \`prefab_image_url\` | string \\| null | Dice template/prefab image URL |
| \`faces\` | DiceFace[] | Array of face configurations |

### DiceFace

| Field | Type | Description |
|-------|------|-------------|
| \`side_number\` | number | Face number (1-6 for d6) |
| \`reward_type\` | "attack" \\| "special" | Type of reward |
| \`reward_value\` | string | Value or effect |
| \`reward_description\` | string \\| null | Additional description |

---

## TTSMenu

| Field | Type | Description |
|-------|------|-------------|
| \`background_url\` | string | TTS menu background image URL |

---

## Board

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Board name |
| \`file_type\` | string \\| null | MIME type (when known) |
| \`file_size\` | string \\| null | File size in bytes (when known) |
| \`image_url\` | string | Board image URL |
| \`individual_location_board\` | IndividualLocationBoard \\| null | When \`name\` is \`SpiritWorld\`, may include per-location board images (with icons) |

---

## IndividualLocationBoard

| Field | Type | Description |
|-------|------|-------------|
| \`locations\` | IndividualLocationBoardEntry[] | Game locations exported as individual boards (uses \`game_locations.image_with_icons_path\`) |

---

## IndividualLocationBoardEntry

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | game_locations UUID |
| \`name\` | string | Game location name |
| \`file_type\` | string \\| null | MIME type (when known) |
| \`file_size\` | string \\| null | File size in bytes (when known) |
| \`image_url\` | string | Direct object URL to the game location image (with icons) |

---

## Screenshot

| Field | Type | Description |
|-------|------|-------------|
| \`name\` | string | Screenshot base filename |
| \`path\` | string | Storage path in \`${BUCKET}\` |
| \`file_type\` | string \\| null | MIME type (when known) |
| \`file_size\` | string \\| null | File size in bytes (when known) |
| \`image_url\` | string \\| null | Rendered image URL (when image) |
| \`file_url\` | string | Direct object URL |

---

## ThreeDModel

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Model name |
| \`obj_url\` | string \\| null | Direct object URL to the OBJ mesh file |
| \`mtl_url\` | string \\| null | Direct object URL to the MTL material file |
| \`png_url\` | string \\| null | Direct object URL to the PNG texture file |

---

## MonsterV2

V2 monsters from the abyss deck. Each monster has an exclusive attack type — either direct damage or a dice pool, never both.

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Monster name (localized) |
| \`attack_type\` | string | \`"damage"\` or \`"dice_pool"\` — determines which attack field is active |
| \`stage\` | number | Stage number (integer, 1-based) |
| \`barrier\` | number | Barrier value |
| \`damage\` | number \\| null | Damage value (only set when attack_type is \`"damage"\`, null otherwise) |
| \`order_num\` | number | Sort order within the deck |
| \`image_url\` | string \\| null | Rendered card image URL |
| \`dice_pool\` | string[] | Array of icon_pool IDs (populated when attack_type is \`"dice_pool"\`) |
| \`dice_pool_icons\` | ResolvedIcon[] | Resolved icon objects for dice pool |
| \`reward_track\` | string[] | Flat array of up to 4 reward icon IDs |
| \`reward_icons\` | ResolvedIcon[] | Resolved icon objects for reward track |

---

## Notes

### General
- All UUIDs are v4 format strings
- All image URLs include \`?quality=80\` for optimized delivery
- Null values indicate optional/missing data

### Computed Fields
These fields are calculated during export, not stored in the database:
- \`copy_index\` on HexSpirit - Generated based on edition's \`cost_duplicates\` setting
- \`effect_ids\` on Monster card - Collected from \`monster_special_effects\` junction table
- \`dice_pool\` on Monster card - Read directly from monsters.dice_pool column
- \`type\` on Rune - Derived from whether \`origin_id\` or \`class_id\` is set
- \`origin_name\`, \`class_name\`, \`tag_names\` - Resolved from ID references
- \`card\` on StageDeckEntry - Resolved inline from the referenced entity table

### Filtering & Sorting
- \`hex_spirits\` are filtered by edition's \`origin_ids\` and are duplicated based on \`cost_duplicates\`
- \`stage_deck\` is the unified per-scenario ordered list of cards. Each entry has a \`kind\` discriminator and fully-resolved inline \`card\` data. \`quantity\` stays as a number; consumer handles duplication.
- \`stage_deck\` is sorted by \`order_num\` ascending (default: 999) for the chosen scenario (\`scenario_id\` or \`scenario\` query param; default = first by \`order_num\`).
- \`guardians\` only includes entries with a \`mat_image_path\` (playable guardians)
- \`tokens\` only includes \`icon_pool\` entries where \`export_as_token = true\`

### Intentionally Excluded
Some database fields are not exported as they are internal/admin-only:
- \`created_at\`, \`updated_at\` timestamps on all tables
- \`prismatic\` on Classes (internal game logic)
- \`rune_cost\`, \`icon_slots\`, \`art_raw_image_path\` on HexSpirits (internal)
- \`icon\`, \`image_path\` on Monsters (rendered into card image)

### Cross-References
- Class \`effect_schema\` contains \`dice_id\` references that link to CustomDice entries
- CustomDice \`faces\` array contains the actual dice face values (\`reward_type\`, \`reward_value\`)
- Use the dice_id from class effect_schema to look up the corresponding CustomDice and its faces
`;

		    let payload: Record<string, unknown> = {
		      exported_at: new Date().toISOString(),
		      export_language: exportLang ?? "base",
		      schema_docs,
	      edition: {
	        name: edition.name,
	        origin_count: editionOriginIds.length,
	        cost_duplicates: costDuplicates,
	      },
	      origins,
	      classes,
	      hex_spirits,
	      stage_deck,
	      game_locations,
	      reward_rows,
		      icon_guide_icons,
		      icon_guide_png_url,
	      special_effects,
	      guardians,
	      runes,
	      tokens,
	      icon_pool,
      custom_dice,
      tts_menu,
      screenshots,
      boards,
      three_d_models,
      monsters_v2,
    };

    // ---- Optional URL substitution to compressed mirror ----
    // When ?compressed=1 is set, swap every game_assets URL for its compressed
    // counterpart in public.asset_compressed. Missing rows fall back to the
    // original URL, so the response is always self-consistent.
    if (compressedFlag) {
      try {
        const rows = await client.queryObject<{ source_path: string; comp_url: string }>(
          `select source_path, comp_url from "arc_spirits_assets".asset_compressed`,
        );
        // Index by source path. The export emits two URL flavors for the same
        // source — render-transform (`/storage/v1/render/image/public/...`) and
        // direct-object (`/storage/v1/object/public/...`) — and both share the
        // same path after the bucket. Keying by path covers both.
        const byPath = new Map<string, string>();
        for (const r of rows.rows) byPath.set(r.source_path, r.comp_url);

        // Match either URL flavor pointing at the source bucket and capture
        // the path after `game_assets/`. Trailing `?...` query is stripped.
        const SOURCE_URL_RE =
          /https?:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/(?:object|render\/image)\/public\/game_assets\/([^?\s"'<>]+)/i;

        let substituted = 0;
        const visit = (node: unknown): unknown => {
          if (node == null) return node;
          if (typeof node === "string") {
            const m = node.match(SOURCE_URL_RE);
            if (!m) return node;
            const path = decodeURIComponent(m[1]);
            const hit = byPath.get(path);
            if (hit) {
              substituted++;
              return hit;
            }
            return node;
          }
          if (Array.isArray(node)) return node.map(visit);
          if (typeof node === "object") {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
              out[k] = visit(v);
            }
            return out;
          }
          return node;
        };
        payload = visit(payload) as Record<string, unknown>;
        payload.compressed = true;
        payload.compressed_substitutions = substituted;
        payload.compressed_available = byPath.size;
      } catch (err) {
        console.error("Compression substitution failed; returning originals", err);
        payload.compressed = false;
        payload.compressed_error = err instanceof Error ? err.message : String(err);
      }
    }

    const body = stringify(payload);

    const lastModified = new Date().toUTCString();

	    // Sanitize edition name for filename (replace spaces with dashes, remove special chars)
	    const safeEditionName = edition.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

	    return new Response(body, {
	      status: 200,
      headers: {
	        ...corsHeaders,
	        "Content-Type": "application/json",
	        "Content-Disposition": `attachment; filename="tts-export-${safeEditionName}-${new Date().toISOString().slice(0, 10)}.json"`,
	        "Last-Modified": lastModified,
	      },
	    });
  } catch (error) {
    console.error("Export failed", error);
    return new Response(`Export failed: ${error instanceof Error ? error.message : error}`, { status: 500, headers: corsHeaders });
  } finally {
    await client.end();
  }
});
