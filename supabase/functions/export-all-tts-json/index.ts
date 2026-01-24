import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

type SpiritRow = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  cost: number;
  traits: { origin_ids?: string[]; class_ids?: string[] } | null;
  game_print_image_path: string | null;
};

type NamedId = { id: string; name: string };

type NamedIdWithTranslations = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
};

type ArtifactRow = {
  id: string;
  name: string;
  benefit: string;
  name_translations?: Record<string, string> | null;
  benefit_translations?: Record<string, string> | null;
  recipe_box: unknown;
  guardian_id: string | null;
  tag_ids: string[] | null;
  card_image_path: string | null;
  card_image_path_translations?: Record<string, string> | null;
  quantity: number | null;
};

type GuardianRow = {
  id: string;
  name: string;
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

type MonsterRow = {
  id: string;
  name: string;
  name_translations?: Record<string, string> | null;
  stage: string | null;
  barrier: number | null;
  damage: number | null;
  order_num: number | null;
  card_image_path: string | null;
  card_image_path_translations?: Record<string, string> | null;
  reward_rows: RewardRowData[] | null;
  special_conditions: string | null;
  special_conditions_translations?: Record<string, string> | null;
  quantity: number | null;
};

type TravelerRow = {
  id: string;
  name: string;
  state: string | null;
  order_num: number | null;
  card_image_path: string | null;
  traveler_subtext: string | null;
  traveler_description: string | null;
  trade_rows: unknown | null;
  gain_rows: unknown | null;
  trade_left_icon_ids: string[] | null;
  trade_right_icon_ids: string[] | null;
  quantity: number | null;
};

type MissionDbRow = {
  id: string;
  title: string;
  description: string | null;
  reward_text: string | null;
  reward_icon_ids: unknown | null;
  tags: string[] | null;
  order_num: number | null;
  card_image_path: string | null;
  quantity: number | null;
};

type ScenarioDeckEntryDbRow = {
  id: string;
  kind: string;
  order_num: number | null;
  quantity: number | null;
  entry_stage: string | null;
  monster_id: string | null;
  game_location_id: string | null;
  traveler_id: string | null;
  event_id: string | null;
  data: unknown | null;
};

type ScenarioDeckEventCardRow = {
  id: string;
  order_num: number | null;
  internal_name: string;
  stage: string | null;
  title: string;
  description: string | null;
  stage_completion: string | null;
  reward_rows: RewardRowData[] | null;
  image_path: string | null;
  card_image_path: string | null;
  data: unknown | null;
};

type ScenarioDeckLocationEntryRow = {
  id: string; // scenario_deck_entries.id
  order_num: number | null;
  entry_stage: string | null;
  game_location_id: string;
  location_name: string | null;
  location_background_image_path: string | null;
  location_image_with_icons_path: string | null;
  data: unknown | null;
};

type ScenarioDeckTravelerEntryRow = {
  id: string; // scenario_deck_entries.id
  order_num: number | null;
  entry_stage: string | null;
  traveler_id: string;
  traveler_name: string;
  traveler_description: string | null;
  traveler_subtext: string | null;
  traveler_card_image_path: string | null;
  traveler_image_path: string | null;
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

type SpecialCategoryRow = {
  id: string;
  name: string;
  position: number;
  slot_1_class_ids: string[] | null;
  slot_2_class_ids: string[] | null;
  slot_3_class_ids: string[] | null;
};

type GameLocationRow = {
  id: string;
  name: string;
  origin_id: string | null;
  reward_rows: unknown | null;
  background_image_path: string | null;
  image_with_icons_path: string | null;
};

type SpiritWorldMapConfigPathsRow = {
  background_image_path: string | null;
  generated_image_path: string | null;
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

const SCHEMA = "arc-spirits-rev2";
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
        `select id, name, display_name, description, game_location_ids, display_image_path, order_num from "${SCHEMA}".scenarios where id = $1 and edition_id = $2`,
        [scenarioIdParam, edition.id]
      );
      if (scenarioRes.rows.length === 0) {
        return new Response(`Scenario not found for edition "${edition.name}"`, { status: 404, headers: corsHeaders });
      }
      scenario = scenarioRes.rows[0];
    } else if (scenarioNameParam) {
      const scenarioRes = await client.queryObject<ScenarioRow>(
        `select id, name, display_name, description, game_location_ids, display_image_path, order_num from "${SCHEMA}".scenarios where edition_id = $1 and name = $2`,
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
        `select id, name, display_name, description, game_location_ids, display_image_path, order_num from "${SCHEMA}".scenarios where edition_id = $1 order by order_num, name limit 1`,
        [edition.id]
      );
      scenario = scenarioRes.rows[0] ?? null;
    }

    const scenarioId = scenario?.id ?? null;

	    const [
	      originsRes,
	      classesRes,
	      tagsRes,
	      guardiansRes,
	      scenariosRes,
	      scenarioDeckEntriesRes,
	      monstersRes,
	      scenarioEventCardsRes,
	      scenarioLocationEntriesRes,
      scenarioTravelerEntriesRes,
      travelersRes,
      missionsRes,
      gameLocationsRes,
      spiritsRes,
      artifactsRes,
      runesRes,
      originsFullRes,
      callingOrbsRes,
      hexSpiritsBasicRes,
      customDiceRes,
      classesFullRes,
      diceSidesRes,
      tokensRes,
      specialCategoriesRes,
      allIconsRes,
      specialEffectsRes,
      monsterSpecialEffectsRes,
      screenshotsRes,
	    ] = await Promise.all([
	      client.queryObject<NamedId>(`select id, name from "${SCHEMA}".origins`),
	      client.queryObject<NamedIdWithTranslations>(`select id, name, name_translations from "${SCHEMA}".classes`),
	      client.queryObject<NamedId>(`select id, name from "${SCHEMA}".artifact_tags`),
	      client.queryObject<GuardianRow>(
	        `select id, name, name_translations, origin_id, image_mat_path, chibi_image_path, icon_image_path from "${SCHEMA}".guardians`
	      ),
	      client.queryObject<ScenarioRow>(
	        `select id, name, display_name, description, game_location_ids, display_image_path, order_num from "${SCHEMA}".scenarios where edition_id = $1 order by order_num, name`,
	        [edition.id],
	      ),
	      client.queryObject<ScenarioDeckEntryDbRow>(
	        `select
	          id,
	          kind,
          order_num,
          quantity,
          entry_stage,
          monster_id,
          game_location_id,
          traveler_id,
          event_id,
          data
        from "${SCHEMA}".scenario_deck_entries
        where scenario_id = $1
        order by order_num`,
        [scenarioId]
      ),
      client.queryObject<MonsterRow>(
        `select
          m.id,
          m.name,
          m.name_translations,
          m.stage,
          m.barrier,
          m.damage,
          sde.order_num,
          m.card_image_path,
          m.card_image_path_translations,
          m.reward_rows,
          m.special_conditions,
          m.special_conditions_translations,
          sde.quantity
        from "${SCHEMA}".scenario_deck_entries sde
        join "${SCHEMA}".monsters m on m.id = sde.monster_id
        where sde.scenario_id = $1 and sde.kind = 'monster'
        order by sde.order_num, m.name`,
        [scenarioId]
      ),
      client.queryObject<ScenarioDeckEventCardRow>(
        `select
          c.id,
          sde.order_num,
          c.internal_name,
          c.stage,
          c.title,
          c.description,
          c.stage_completion,
          c.reward_rows,
          c.image_path,
          c.card_image_path,
          c.data
        from "${SCHEMA}".scenario_deck_entries sde
        join "${SCHEMA}".event_cards c on c.id = sde.event_id
        where sde.scenario_id = $1 and sde.kind = 'event'
        order by sde.order_num, c.title`,
        [scenarioId]
      ),
      client.queryObject<ScenarioDeckLocationEntryRow>(
        `select
          sde.id,
          sde.order_num,
          sde.entry_stage,
          sde.game_location_id,
          sde.data,
          gl.name as location_name,
          gl.background_image_path as location_background_image_path,
          gl.image_with_icons_path as location_image_with_icons_path
        from "${SCHEMA}".scenario_deck_entries sde
        join "${SCHEMA}".game_locations gl on gl.id = sde.game_location_id
        where sde.scenario_id = $1 and sde.kind = 'location'
        order by sde.order_num, gl.name`,
        [scenarioId]
      ),
      client.queryObject<ScenarioDeckTravelerEntryRow>(
        `select
          sde.id,
          sde.order_num,
          sde.entry_stage,
          sde.traveler_id,
          t.name as traveler_name,
          t.traveler_description,
          t.traveler_subtext,
          t.card_image_path as traveler_card_image_path,
          t.image_path as traveler_image_path
        from "${SCHEMA}".scenario_deck_entries sde
        join "${SCHEMA}".travelers t on t.id = sde.traveler_id
        where sde.scenario_id = $1 and sde.kind = 'traveler'
        order by sde.order_num, t.name`,
        [scenarioId]
      ),
      client.queryObject<TravelerRow>(
        `select id, name, state, order_num, card_image_path, traveler_subtext, traveler_description, trade_rows, gain_rows, trade_left_icon_ids, trade_right_icon_ids, quantity from "${SCHEMA}".travelers order by order_num`
      ),
      client.queryObject<MissionDbRow>(
        `select id, title, description, reward_text, reward_icon_ids, tags, order_num, card_image_path, quantity from "${SCHEMA}".missions order by order_num, title`
      ),
      client.queryObject<GameLocationRow>(
        `select id, name, origin_id, reward_rows, background_image_path, image_with_icons_path from "${SCHEMA}".game_locations order by name`
      ),
      client.queryObject<SpiritRow>(
        `select id, name, name_translations, cost, traits, game_print_image_path from "${SCHEMA}".hex_spirits where is_enabled = true`
      ),
      client.queryObject<ArtifactRow>(`select id, name, benefit, name_translations, benefit_translations, recipe_box, guardian_id, tag_ids, card_image_path, card_image_path_translations, quantity from "${SCHEMA}".artifacts`),
      client.queryObject<RuneRow>(`select id, name, origin_id, class_id, icon_path from "${SCHEMA}".runes`),
      // Full origins with calling card data
      client.queryObject<OriginRow>(`select id, name, position, color, description, icon_png, calling_card from "${SCHEMA}".origins order by position`),
      // Calling orb images
      client.queryObject<CallingOrbImageRow>(`select id, origin_id, image_path from "${SCHEMA}".calling_orb_images`),
      // Basic hex spirit info for calling card associations
      client.queryObject<HexSpiritBasic>(
        `select id, name, name_translations, cost, game_print_image_path, traits from "${SCHEMA}".hex_spirits where is_enabled = true`
      ),
      // Custom dice with their prefab templates
      client.queryObject<CustomDiceRow>(`select id, name, name_translations, description, description_translations, icon, color, dice_type, exported_template_path from "${SCHEMA}".custom_dice`),
      // Full classes with effect schema (contains dice_id references in breakpoints)
      client.queryObject<ClassRow>(`select id, name, name_translations, position, icon_emoji, icon_png, color, description, description_translations, tags, effect_schema, footer, footer_translations from "${SCHEMA}".classes order by position`),
      // Dice sides for face value counts
      client.queryObject<DiceSideRow>(`select id, dice_id, side_number, reward_type, reward_value, reward_description, reward_description_translations from "${SCHEMA}".dice_sides order by dice_id, side_number`),
      // Tokens from icon_pool marked for export
      client.queryObject<IconPoolRow>(`select id, name, source_type, file_path, tags, export_as_token from "${SCHEMA}".icon_pool where export_as_token = true order by name`),
      // Special categories for grouping classes
      client.queryObject<SpecialCategoryRow>(`select id, name, position, slot_1_class_ids, slot_2_class_ids, slot_3_class_ids from "${SCHEMA}".special_categories`),
      // All icons from icon_pool for reward resolution and full export
      client.queryObject<IconPoolRow>(`select id, name, description, description_translations, icon_guide_name, icon_guide_name_translations, icon_guide_group, icon_guide_group_translations, icon_guide_position, source_type, file_path, tags, export_as_token, metadata from "${SCHEMA}".icon_pool order by source_type, name`),
      // Special effects definitions
      client.queryObject<SpecialEffectRow>(`select id, name, name_translations, description, description_translations, icon, color from "${SCHEMA}".special_effects`),
      // Monster-to-special-effects junction
      client.queryObject<MonsterSpecialEffectRow>(`select monster_id, special_effect_id from "${SCHEMA}".monster_special_effects`),
      // Screenshot uploads (storage bucket)
      client.queryObject<StorageObjectMetaWithNameRow>(
        `select path, mimetype, size, updated_at from "${SCHEMA}".screenshots_export order by path`,
      ),
    ]);

    const originMap = new Map(originsRes.rows.map((r) => [r.id, r.name]));
    const classMap = new Map(classesRes.rows.map((r) => [r.id, pickLocalizedText(r.name, r.name_translations, exportLang) ?? r.name]));
    const tagMap = new Map(tagsRes.rows.map((r) => [r.id, r.name]));
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

    try {
      const spiritWorldConfigRes = await client.queryObject<SpiritWorldMapConfigPathsRow>(
        `select
          config->>'background_image_path' as background_image_path,
          config->>'generated_image_path' as generated_image_path
        from "${SCHEMA}".spirit_world_map_configs
        where name = 'default'`
      );
      spiritWorldBackgroundPath = spiritWorldConfigRes.rows[0]?.background_image_path ?? null;
      spiritWorldGeneratedPath = spiritWorldConfigRes.rows[0]?.generated_image_path ?? null;
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

    // Build resolved reward rows map for each monster (monster_id -> resolved reward rows)
    type ResolvedRewardRow = {
      type: string;
      label: string | null;
      icons: { id: string; name: string; image_url: string | null }[];
    };
    const monsterRewardRowsMap = new Map<string, ResolvedRewardRow[]>();

    for (const m of monstersRes.rows) {
      const rows = m.reward_rows ?? [];
      const resolvedRows: ResolvedRewardRow[] = rows.map((row) => {
        const icons = (row.icon_ids ?? []).map(resolveIcon);

        return {
          type: row.type,
          label: row.label ?? null,
          icons,
        };
      });
      monsterRewardRowsMap.set(m.id, resolvedRows);
    }

    type LocationRewardRow =
      | { type: "gain"; gain_icon_ids: string[] }
      | { type: "trade"; cost_icon_ids: string[]; gain_icon_ids: string[] }
      | { type: "text"; text: string };

    const normalizeIconIds = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

    const normalizeIconGroups = (value: unknown, fallback?: string[]): string[][] => {
      if (Array.isArray(value)) {
        return value
          .map((group) => normalizeIconIds(group))
          .filter((group) => group.length > 0);
      }
      if (Array.isArray(fallback) && fallback.length > 0) {
        return [normalizeIconIds(fallback)];
      }
      return [];
    };

    type TravelerTradeRowNormalized = { left_groups: string[][]; right_groups: string[][] };

    const normalizeTravelerTradeRows = (
      rows: unknown,
      fallbackLeft: string[],
      fallbackRight: string[]
    ): TravelerTradeRowNormalized[] => {
      if (!Array.isArray(rows)) {
        const leftFallback = normalizeIconGroups(null, fallbackLeft);
        const rightFallback = normalizeIconGroups(null, fallbackRight);
        if (leftFallback.length === 0 && rightFallback.length === 0) return [];
        return [{ left_groups: leftFallback, right_groups: rightFallback }];
      }

      return rows
        .map((row): TravelerTradeRowNormalized | null => {
          if (!row || typeof row !== "object") return null;
          const left_groups = normalizeIconGroups((row as any).left_icon_groups, normalizeIconIds((row as any).left_icon_ids));
          const right_groups = normalizeIconGroups((row as any).right_icon_groups, normalizeIconIds((row as any).right_icon_ids));
          if (left_groups.length === 0 && right_groups.length === 0) return null;
          return { left_groups, right_groups };
        })
        .filter((row): row is TravelerTradeRowNormalized => row !== null);
    };

    const normalizeTravelerGainRows = (rows: unknown): string[][][] => {
      if (!Array.isArray(rows)) return [];
      return rows
        .map((row): string[][] | null => {
          if (!row || typeof row !== "object") return null;
          const groups = normalizeIconGroups((row as any).icon_groups, normalizeIconIds((row as any).icon_ids));
          return groups.length > 0 ? groups : null;
        })
        .filter((row): row is string[][] => row !== null);
    };

    const normalizeLocationRewardRows = (rows: unknown): LocationRewardRow[] => {
      if (!Array.isArray(rows)) return [];

      return rows.map((row): LocationRewardRow => {
        if (!row || typeof row !== "object") {
          return { type: "gain", gain_icon_ids: [] };
        }

        // Legacy: { icon_ids: [...] }
        if (Array.isArray((row as any).icon_ids)) {
          return {
            type: "gain",
            gain_icon_ids: normalizeIconIds((row as any).icon_ids),
          };
        }

        const rawType = (row as any).type;
        if (rawType === "text") {
          return { type: "text", text: typeof (row as any).text === "string" ? (row as any).text : "" };
        }

        const type = rawType === "trade" ? "trade" : "gain";
        const gain_icon_ids = normalizeIconIds((row as any).gain_icon_ids);

        if (type === "trade") {
          return {
            type: "trade",
            cost_icon_ids: normalizeIconIds((row as any).cost_icon_ids),
            gain_icon_ids,
          };
        }

        return { type: "gain", gain_icon_ids };
      });
    };

    // Build map of class_id -> special category name
    const classToSpecialCategoryMap = new Map<string, string>();
    for (const cat of specialCategoriesRes.rows) {
      const allClassIds = [
        ...(cat.slot_1_class_ids ?? []),
        ...(cat.slot_2_class_ids ?? []),
        ...(cat.slot_3_class_ids ?? []),
      ];
      for (const classId of allClassIds) {
        classToSpecialCategoryMap.set(classId, cat.name);
      }
    }

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
	          copy_index: i + 1,
        });
      }
    }

	    const artifacts = artifactsRes.rows.map((a) => {
	      const tag_ids = a.tag_ids ?? [];
	      const tag_names = tag_ids.map((id) => tagMap.get(id) ?? null);
	      const imageStoragePath = pickLocalizedText(a.card_image_path, a.card_image_path_translations, exportLang);
	      const image_path = imageStoragePath ? `${base}${encodeURI(imageStoragePath)}?quality=80` : null;

	      const image_path_translations: Record<string, string> = {};
	      if (a.card_image_path_translations && typeof a.card_image_path_translations === "object") {
	        for (const [lang, path] of Object.entries(a.card_image_path_translations)) {
          if (typeof path !== "string" || path.trim().length === 0) continue;
          image_path_translations[String(lang)] = `${base}${encodeURI(path)}?quality=80`;
        }
	      }
	      const name = pickLocalizedText(a.name, a.name_translations, exportLang) ?? a.name;
	      const benefit = pickLocalizedText(a.benefit, a.benefit_translations, exportLang) ?? a.benefit;
	      return {
	        id: a.id,
	        name,
	        benefit,
	        name_translations: a.name_translations ?? {},
	        benefit_translations: a.benefit_translations ?? {},
	        recipe_box: a.recipe_box,
	        guardian_id: a.guardian_id,
        image_path,
        image_path_translations,
        tag_ids,
        tag_names,
        quantity: a.quantity ?? 1,
      };
    });

	    // Map monsters
	    // Expand monsters by quantity (duplicates appear in sequence)
	    const monsterCards = monstersRes.rows.flatMap((m) => {
	      const cardPath = pickLocalizedText(m.card_image_path, m.card_image_path_translations, exportLang);
	      const image_url = cardPath ? `${base}${encodeURI(cardPath)}?quality=80` : null;
	      const reward_rows = monsterRewardRowsMap.get(m.id) ?? [];
	      const name = pickLocalizedText(m.name, m.name_translations, exportLang) ?? m.name;

	      // Get effect IDs for this monster (normalized - just IDs, lookup via special_effects)
	      const effect_ids = monsterEffectsMap.get(m.id) ?? [];

      const quantity = m.quantity ?? 1;
      const baseOrderNum = m.order_num ?? 999;

	      // Create quantity copies of the card
		      return Array.from({ length: quantity }, (_, copyIndex) => ({
		        id: m.id,
		        name,
		        type: "monster" as const,
		        stage: m.stage,
		        barrier: m.barrier,
		        damage: m.damage,
	        // Use fractional order_num to keep copies together in sequence
	        order_num: baseOrderNum + (copyIndex * 0.001),
	        image_url,
        effect_ids,
        reward_rows,
        copy_index: copyIndex + 1,
        total_copies: quantity,
      }));
    });

    // Sort monsters by order_num
    const monsters = [...monsterCards].sort((a, b) => (a.order_num ?? 999) - (b.order_num ?? 999));

    // Map scenario stage deck (event_cards + scenario-specific location/traveler entries)
    const baseEvents = scenarioEventCardsRes.rows.map((c) => {
      const image_url = c.card_image_path ? `${base}${encodeURI(c.card_image_path)}?quality=80` : null;

      const reward_rows: ResolvedRewardRow[] = (c.reward_rows ?? []).map((row) => ({
        type: row.type,
        label: row.label ?? null,
        icons: (row.icon_ids ?? []).map(resolveIcon),
      }));

      return {
        id: c.id,
        name: c.title, // Display name
        type: "event" as const,
        state: "event",
        order_num: c.order_num ?? 999,
        image_url,
        reward_rows,
        // Event-specific fields
        event_name: c.id,
        description: c.description ?? "",
        event_type: c.stage ?? null,
        stage_completion: c.stage_completion ?? null,
        event_kind: "event" as const,
      };
    });

    const stageLocationCards = scenarioLocationEntriesRes.rows.map((c) => {
      const cardPath = c.location_image_with_icons_path ?? c.location_background_image_path ?? null;
      const image_url = cardPath ? `${base}${encodeURI(cardPath)}?quality=80` : null;

      return {
        id: c.id, // entry id (allows duplicates)
        name: c.location_name ?? c.game_location_id,
        type: "event" as const,
        state: "event",
        order_num: c.order_num ?? 999,
        image_url,
        reward_rows: [] as ResolvedRewardRow[],
        event_name: c.id,
        description: "",
        event_type: c.entry_stage ?? null,
        stage_completion: null,
        event_kind: "event_location" as const,
        location_id: c.game_location_id,
      };
    });

    const stageTravelerCards = scenarioTravelerEntriesRes.rows.map((c) => {
      const cardPath = c.traveler_card_image_path ?? c.traveler_image_path ?? null;
      const image_url = cardPath ? `${base}${encodeURI(cardPath)}?quality=80` : null;

      return {
        id: c.id, // entry id (allows duplicates)
        name: c.traveler_name,
        type: "event" as const,
        state: "event",
        order_num: c.order_num ?? 999,
        image_url,
        reward_rows: [] as ResolvedRewardRow[],
        event_name: c.id,
        description: c.traveler_description ?? "",
        event_type: c.entry_stage ?? null,
        stage_completion: null,
        event_kind: "traveler" as const,
        traveler_id: c.traveler_id,
      };
    });

    const events = [...baseEvents, ...stageLocationCards, ...stageTravelerCards].sort(
      (a, b) => (a.order_num ?? 999) - (b.order_num ?? 999)
    );

    const scenario_deck_entries = scenarioDeckEntriesRes.rows.map((e) => ({
      id: e.id,
      kind: e.kind,
      order_num: e.order_num ?? 999,
      quantity: Math.max(1, Math.trunc(e.quantity ?? 1)),
      entry_stage: e.entry_stage ?? null,
      monster_id: e.monster_id ?? null,
      game_location_id: e.game_location_id ?? null,
      traveler_id: e.traveler_id ?? null,
      event_id: e.event_id ?? null,
      data: e.data ?? null,
    }));

    // Map travelers with trade/gain rows resolved via icon_pool
    const travelers = travelersRes.rows.flatMap((t) => {
      const image_url = t.card_image_path
        ? `${base}${encodeURI(t.card_image_path)}?quality=80`
        : null;
      const tradeRows = normalizeTravelerTradeRows(
        t.trade_rows,
        t.trade_left_icon_ids ?? [],
        t.trade_right_icon_ids ?? []
      );
      const gainRows = normalizeTravelerGainRows(t.gain_rows);

      const resolved_trade_rows = tradeRows.map((row) => ({
        left_groups: row.left_groups.map((group) => group.map(resolveIcon)),
        right_groups: row.right_groups.map((group) => group.map(resolveIcon)),
      }));

      const resolved_gain_rows = gainRows.map((groups) =>
        groups.map((group) => group.map(resolveIcon))
      );

      const quantity = t.quantity ?? 1;
      const baseOrderNum = t.order_num ?? 999;

      return Array.from({ length: quantity }, (_, copyIndex) => ({
        id: t.id,
        name: t.name,
        state: t.state,
        order_num: baseOrderNum + copyIndex * 0.001,
        image_url,
        traveler_subtext: t.traveler_subtext,
        traveler_description: t.traveler_description,
        trade_rows: resolved_trade_rows,
        gain_rows: resolved_gain_rows,
        copy_index: copyIndex + 1,
        total_copies: quantity,
      }));
    });

	    // Map missions (scroll-style cards)
	    const missions = missionsRes.rows.flatMap((m) => {
	      const image_url = m.card_image_path
	        ? `${base}${encodeURI(m.card_image_path)}?quality=80`
	        : null;

	      const reward_icon_ids = Array.isArray(m.reward_icon_ids)
	        ? m.reward_icon_ids.filter((id): id is string => typeof id === "string")
	        : [];

	      const reward_icons = reward_icon_ids.map(resolveIcon);
	      const tags = Array.isArray(m.tags)
	        ? m.tags.filter((t): t is string => typeof t === "string")
	        : [];

	      const quantity = Math.max(1, Math.trunc(m.quantity ?? 1));
	      const baseOrderNum = m.order_num ?? 999;

	      return Array.from({ length: quantity }, (_, copyIndex) => ({
	        id: m.id,
	        title: m.title,
	        description: m.description ?? null,
	        order_num: baseOrderNum + copyIndex * 0.001,
	        image_url,
	        reward_text: m.reward_text ?? null,
	        reward_icons,
	        tags,
	        copy_index: copyIndex + 1,
	        total_copies: quantity,
	      }));
	    });

    // Map runes with origin/class names resolved
    const runes = runesRes.rows.map((r) => {
      const origin_name = r.origin_id ? originMap.get(r.origin_id) ?? null : null;
      const class_name = r.class_id ? classMap.get(r.class_id) ?? null : null;
      const icon_url = r.icon_path ? `${base}${encodeURI(r.icon_path)}?quality=80` : null;
      return {
        id: r.id,
        name: r.name,
        type: r.origin_id ? "origin" : "class",
        origin_id: r.origin_id,
        origin_name,
        class_id: r.class_id,
        class_name,
        icon_url,
      };
    });

    // Map custom dice with prefab template URLs and face counts
    const custom_dice = customDiceRes.rows.map((d) => {
      const prefab_image_url = d.exported_template_path
        ? `${base}${encodeURI(d.exported_template_path)}?quality=80`
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
        faces,
      };
    });

    // Map classes with effect schema (contains dice_id references in breakpoints)
    const classes = classesFullRes.rows.map((c) => {
      const icon_url = c.icon_png ? `${base}${encodeURI(c.icon_png)}?quality=80` : null;
      const special = classToSpecialCategoryMap.get(c.id) ?? null;
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
        special,
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

    const attachedGameLocationIds = (() => {
      const ids = new Set<string>();

      const curated = scenario?.game_location_ids;
      if (Array.isArray(curated)) {
        for (const id of curated) {
          if (typeof id !== "string") continue;
          const trimmed = id.trim();
          if (!trimmed) continue;
          ids.add(trimmed);
        }
      }

      for (const entry of scenarioDeckEntriesRes.rows) {
        if (entry.kind === "location" && entry.game_location_id) {
          ids.add(entry.game_location_id);
        }
      }

      for (const row of scenarioLocationEntriesRes.rows) {
        if (row.game_location_id) ids.add(row.game_location_id);
      }

      return ids;
    })();

    // Map game locations with reward rows resolved via icon_pool.
    // Only include locations attached to the selected scenario.
    const game_locations = gameLocationsRes.rows
      .filter((l) => attachedGameLocationIds.has(l.id))
      .map((l) => {
      const origin_name = l.origin_id ? originMap.get(l.origin_id) ?? null : null;
      const image_url = l.image_with_icons_path
        ? `${base}${encodeURI(l.image_with_icons_path)}?quality=80`
        : null;
      const background_image_url = l.background_image_path
        ? `${base}${encodeURI(l.background_image_path)}?quality=80`
        : null;

      const rewardRows = normalizeLocationRewardRows(l.reward_rows);
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
		| \`scenarios\` | ScenarioRef[] | All scenarios for the selected edition (used by scenario picker UIs) |
		| \`schema_docs\` | string | This documentation in markdown format |
		| \`origins\` | Origin[] | Array of origin factions |
		| \`classes\` | Class[] | Array of character classes |
		| \`hex_spirits\` | HexSpirit[] | Array of hex spirit cards (filtered by edition) |
		| \`artifacts\` | Artifact[] | Array of artifact cards |
	| \`monsters\` | Monster[] | Array of monster cards (sorted by order_num) |
	| \`events\` | Event[] | Array of event cards (sorted by order_num; includes event-location cards) |
	| \`scenario_deck_entries\` | ScenarioDeckEntry[] | Canonical per-scenario ordered list of deck entries (monster/location/traveler/event) |
	| \`game_locations\` | GameLocation[] | Game locations attached to the selected scenario |
	| \`icon_guide_icons\` | IconGuideIcon[] | Icons manually pinned to the Icon Guide |
	| \`icon_guide_png_url\` | string \\| null | Public URL to the Icon Guide PNG (may 404 if not exported yet) |
	| \`travelers\` | Traveler[] | Array of traveler cards |
	| \`missions\` | Mission[] | Array of mission scroll cards |
	| \`special_effects\` | SpecialEffect[] | Array of special effect definitions |
	| \`guardians\` | Guardian[] | Array of playable guardian characters |
	| \`runes\` | Rune[] | Array of rune tokens |
	| \`tokens\` | Token[] | Array of game tokens from icon pool (export_as_token = true) |
	| \`icon_pool\` | IconPoolEntry[] | Complete icon pool with all icons (includes uploaded assets) |
	| \`custom_dice\` | CustomDice[] | Array of custom dice with face configurations |
	| \`tts_menu\` | TTSMenu | TTS menu configuration and assets |
	| \`screenshots\` | Screenshot[] | Array of screenshot/media uploads included in the export |
	| \`boards\` | Board[] | Array of board images (includes SpiritWorld) |

---

	## Edition

	| Field | Type | Description |
	|-------|------|-------------|
	| \`name\` | string | Edition name (e.g., "Base", "Expansion") |
	| \`origin_count\` | number | Number of origins included in this edition |
	| \`cost_duplicates\` | Record<string, number> | Map of spirit cost to duplicate count |
	| \`scenario\` | ScenarioRef \\| null | The scenario selected for this export (based on query params) |

	---

	## ScenarioRef
	
	| Field | Type | Description |
	|-------|------|-------------|
	| \`id\` | string | UUID |
	| \`name\` | string | Internal scenario name |
	| \`display_name\` | string | User-facing scenario name (falls back to \`name\`) |
	| \`description\` | string \\| null | Scenario description |
	| \`game_location_ids\` | string[] | Curated list of game location IDs |
	| \`display_image_path\` | string \\| null | Storage path for the display image |
	| \`display_image_url\` | string \\| null | Public URL for the display image |
	
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

## Artifact

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Artifact name |
| \`recipe_box\` | RecipeEntry[] | Crafting recipe |
| \`guardian_id\` | string \\| null | Associated guardian UUID |
| \`image_path\` | string \\| null | Card image URL |
| \`tag_ids\` | string[] | Array of tag UUIDs |
| \`tag_names\` | (string \\| null)[] | Resolved tag names |

### RecipeEntry

| Field | Type | Description |
|-------|------|-------------|
| \`rune_id\` | string | Rune UUID required |
| \`quantity\` | number | Amount needed |

---

## Monster

The monsters array contains only monster cards. Events are exported separately in the \`events\` array.

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Monster name |
| \`type\` | "monster" | Card type discriminator |
| \`stage\` | string | Monster stage: "stage_1", "stage_2", "stage_3", "final_stage", or "inactive" |
| \`barrier\` | number \\| null | Barrier value |
| \`damage\` | number \\| null | Damage value |
| \`order_num\` | number | Sort order (default: 999) |
| \`image_url\` | string \\| null | Card image URL |
| \`effect_ids\` | string[] | Array of special effect UUIDs (lookup via special_effects) |
| \`reward_rows\` | RewardRow[] | Array of reward row configurations |
| \`copy_index\` | number | Copy number (1-based) when quantity > 1 |
| \`total_copies\` | number | Total copies when quantity > 1 |

### RewardRow

| Field | Type | Description |
|-------|------|-------------|
| \`type\` | RewardRowType | Type of reward distribution |
| \`label\` | string \\| null | Custom label override |
| \`icons\` | RewardIcon[] | Array of reward icons |

### RewardRowType

- \`"all_in_combat"\` - All players in combat gain these rewards
- \`"all_in_combat_pick_one"\` - All players in combat pick 1 of these rewards
- \`"all_players"\` - All players gain these rewards
- \`"all_losers"\` - All losing players gain these rewards
- \`"all_winners"\` - All winning players gain these rewards
- \`"one_winner"\` - One winner gains these rewards
- \`"tournament"\` - Tournament-style rewards (1st/2nd/3rd+)

### RewardIcon

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Icon pool UUID |
| \`name\` | string | Icon name |
| \`image_url\` | string \\| null | Icon image URL |

---

	## Event

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Display title |
| \`type\` | "event" | Card type discriminator |
| \`state\` | "event" | Event state discriminator |
| \`order_num\` | number | Sort order (default: 999) |
| \`image_url\` | string \\| null | Card image URL |
| \`reward_rows\` | RewardRow[] | Array of reward row configurations |
| \`event_name\` | string | Event UUID (internal identifier) |
| \`description\` | string | Event description text |
| \`event_type\` | string \\| null | Event type ("stage_1", "stage_2", "stage_3", "final_stage", "endgame") |
| \`stage_completion\` | string \\| null | When this stage should end (shown on the event card) |
| \`event_kind\` | "event" \\| "event_location" | Source discriminator (stage event cards vs stage-location cards) |
	| \`location_id\` | string \\| undefined | Only present when \`event_kind="event_location"\` |

	---
	
	## ScenarioDeckEntry
	
	The canonical list of deck entries for the selected scenario. Each entry references exactly one of:
	- \`monster_id\` when \`kind="monster"\`
	- \`game_location_id\` when \`kind="location"\`
	- \`traveler_id\` when \`kind="traveler"\`
	- \`event_id\` when \`kind="event"\`
	
	| Field | Type | Description |
	|-------|------|-------------|
	| \`id\` | string | UUID |
	| \`kind\` | "monster" \\| "location" \\| "traveler" \\| "event" | Entry kind discriminator |
	| \`order_num\` | number | Sort order (default: 999) |
	| \`quantity\` | number | Copies of this entry to include (default: 1) |
	| \`entry_stage\` | string \\| null | Optional stage/row identifier for UI grouping |
	| \`monster_id\` | string \\| null | Monster UUID (when kind="monster") |
	| \`game_location_id\` | string \\| null | GameLocation UUID (when kind="location") |
	| \`traveler_id\` | string \\| null | Traveler UUID (when kind="traveler") |
	| \`event_id\` | string \\| null | EventCard UUID (when kind="event") |
	| \`data\` | object \\| null | Optional per-entry custom JSON data |
	
	---

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

## Traveler

Traveler cards include resolved gain/trade icon groups, with \`/\` separators represented as grouped arrays.

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | UUID |
| \`name\` | string | Traveler name |
| \`state\` | string \\| null | Traveler state (tainted, corrupt, fallen, boss) |
| \`order_num\` | number | Sort order (default: 999) |
| \`image_url\` | string \\| null | Traveler card image URL |
| \`traveler_subtext\` | string \\| null | Traveler subtext |
| \`traveler_description\` | string \\| null | Traveler description |
| \`trade_rows\` | TravelerTradeRow[] | Trade rows with left/right icon groups |
| \`gain_rows\` | TravelerGainRow[] | Gain rows with icon groups |
| \`copy_index\` | number | Copy number (1-based) when quantity > 1 |
| \`total_copies\` | number | Total copies when quantity > 1 |

### TravelerTradeRow

| Field | Type | Description |
|-------|------|-------------|
| \`left_groups\` | RewardIcon[][] | Left icon groups (each group is an OR option) |
| \`right_groups\` | RewardIcon[][] | Right icon groups (each group is an OR option) |

### TravelerGainRow

Each entry is an array of icon groups (\`RewardIcon[][]\`), where each group is an OR option.

---

	## Mission

	Mission cards (artifact-style scroll cards).

	| Field | Type | Description |
	|-------|------|-------------|
	| \`id\` | string | UUID |
	| \`title\` | string | Mission title |
	| \`description\` | string \\| null | Mission description text |
	| \`order_num\` | number | Sort order (default: 999) |
	| \`image_url\` | string \\| null | Mission card image URL |
	| \`reward_text\` | string \\| null | Optional text reward row |
	| \`reward_icons\` | RewardIcon[] | Resolved reward icons |
	| \`tags\` | string[] | Optional tags |
	| \`copy_index\` | number | Copy number (1-based) when quantity > 1 |
	| \`total_copies\` | number | Total copies when quantity > 1 |

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

## Notes

### General
- All UUIDs are v4 format strings
- All image URLs include \`?quality=80\` for optimized delivery
- Null values indicate optional/missing data

### Computed Fields
These fields are calculated during export, not stored in the database:
- \`copy_index\` on HexSpirit - Generated based on edition's \`cost_duplicates\` setting
- \`effect_ids\` on Monster - Collected from \`monster_special_effects\` junction table
- \`type\` on Rune - Derived from whether \`origin_id\` or \`class_id\` is set
- \`special\` on Class - Looked up from special_categories table
- \`origin_name\`, \`class_name\`, \`tag_names\` - Resolved from ID references

### Filtering & Sorting
- \`hex_spirits\` are filtered by edition's \`origin_ids\`, require \`hex_spirits.is_enabled = true\`, and are duplicated based on \`cost_duplicates\`
- \`scenario_deck_entries\` is the canonical per-scenario ordered list of cards (monster/location/traveler/event). Missions are independent and not scenario-scoped.
- \`monsters\` and \`events\` are derived from \`scenario_deck_entries\` for the chosen scenario (\`scenario_id\` or \`scenario\` query param; default = first by \`order_num\`).
- \`monsters\` array is sorted by \`order_num\` ascending (default: 999)
- \`events\` array is sorted by \`order_num\` ascending (default: 999); sourced from \`scenario_deck_entries.kind = 'event' | 'location' | 'traveler'\` joined to \`event_cards\`, \`game_locations\`, and \`travelers\`.
- \`guardians\` only includes entries with a \`mat_image_path\` (playable guardians)
- \`tokens\` only includes \`icon_pool\` entries where \`export_as_token = true\`

### Intentionally Excluded
Some database fields are not exported as they are internal/admin-only:
- \`created_at\`, \`updated_at\` timestamps on all tables
- \`benefit\`, \`quantity\`, \`template_id\` on Artifacts (rendered into card image)
- \`prismatic\` on Classes (internal game logic)
- \`rune_cost\`, \`icon_slots\`, \`art_raw_image_path\` on HexSpirits (internal)
- \`icon\`, \`image_path\` on Monsters (rendered into card image)

### Cross-References
- Class \`effect_schema\` contains \`dice_id\` references that link to CustomDice entries
- CustomDice \`faces\` array contains the actual dice face values (\`reward_type\`, \`reward_value\`)
- Use the dice_id from class effect_schema to look up the corresponding CustomDice and its faces
`;

	    const normalizeScenarioLocationIds = (value: unknown): string[] => {
	      if (!Array.isArray(value)) return [];
	      const ids: string[] = [];
	      for (const raw of value) {
	        if (typeof raw !== "string") continue;
	        const trimmed = raw.trim();
	        if (!trimmed) continue;
	        ids.push(trimmed);
	      }
	      return ids;
	    };

	    const scenarios = scenariosRes.rows.map((s) => ({
	      id: s.id,
	      name: s.name,
	      display_name: s.display_name ?? s.name,
	      description: s.description ?? null,
	      game_location_ids: normalizeScenarioLocationIds(s.game_location_ids),
	      display_image_path: s.display_image_path ?? null,
	      display_image_url: resolveStorageImageUrl(s.display_image_path ?? null),
	    }));

	    const body = stringify({
	      exported_at: new Date().toISOString(),
	      export_language: exportLang ?? "base",
	      schema_docs,
      edition: {
        name: edition.name,
        origin_count: editionOriginIds.length,
        cost_duplicates: costDuplicates,
        scenario: scenario
          ? {
              id: scenario.id,
              name: scenario.name,
              display_name: scenario.display_name ?? scenario.name,
              description: scenario.description ?? null,
              game_location_ids: normalizeScenarioLocationIds(scenario.game_location_ids),
              display_image_path: scenario.display_image_path ?? null,
              display_image_url: resolveStorageImageUrl(scenario.display_image_path ?? null),
            }
          : null,
      },
      scenarios,
      origins,
      classes,
      hex_spirits,
      artifacts,
      monsters,
      events,
      scenario_deck_entries,
      game_locations,
	      icon_guide_icons,
	      icon_guide_png_url,
	      travelers,
	      missions,
	      special_effects,
	      guardians,
	      runes,
	      tokens,
	      icon_pool,
      custom_dice,
      tts_menu,
      screenshots,
      boards,
    });

    const lastModified = new Date().toUTCString();

    // Sanitize edition name for filename (replace spaces with dashes, remove special chars)
    const safeEditionName = edition.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const safeScenarioName = scenario?.name
      ? scenario.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      : null;
    const scenarioSuffix = safeScenarioName ? `-${safeScenarioName}` : "";

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="tts-export-${safeEditionName}${scenarioSuffix}-${new Date().toISOString().slice(0, 10)}.json"`,
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
