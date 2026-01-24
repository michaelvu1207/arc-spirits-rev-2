-- Unified Scenarios Deck (additive migration)
--
-- Goal:
-- - Move toward a single per-scenario ordered deck list containing:
--   monster cards, location cards, traveler cards, quest cards, event cards.
-- - Each card is owned by its own table:
--   monsters, game_locations, travelers, quests, event_cards.
-- - Keep existing tables (`scenario_cards`, `stage_cards`) for now to avoid breaking the app.
--
-- This migration:
-- 1) Renames abyss_scenarios -> scenarios and traveler_quests -> quests (with compatibility views).
-- 2) Creates event_cards (events live here).
-- 3) Creates scenario_deck_entries (unified deck list).
-- 4) Backfills event_cards + scenario_deck_entries from existing scenario_cards/stage_cards.

-- 1) Rename `abyss_scenarios` -> `scenarios` (idempotent)
do $$
begin
  if to_regclass('"arc-spirits-rev2".scenarios') is null
     and to_regclass('"arc-spirits-rev2".abyss_scenarios') is not null then
    alter table "arc-spirits-rev2".abyss_scenarios rename to scenarios;
  end if;
end $$;

-- Compatibility view: keep `abyss_scenarios` working for reads/writes.
do $$
begin
  if to_regclass('"arc-spirits-rev2".abyss_scenarios') is null
     and to_regclass('"arc-spirits-rev2".scenarios') is not null then
    execute 'create view "arc-spirits-rev2".abyss_scenarios as select * from "arc-spirits-rev2".scenarios';
  end if;
end $$;

-- 2) Rename `traveler_quests` -> `quests` (idempotent)
do $$
begin
  if to_regclass('"arc-spirits-rev2".quests') is null
     and to_regclass('"arc-spirits-rev2".traveler_quests') is not null then
    alter table "arc-spirits-rev2".traveler_quests rename to quests;
  end if;
end $$;

-- Compatibility view: keep `traveler_quests` working for reads/writes.
do $$
begin
  if to_regclass('"arc-spirits-rev2".traveler_quests') is null
     and to_regclass('"arc-spirits-rev2".quests') is not null then
    execute 'create view "arc-spirits-rev2".traveler_quests as select * from "arc-spirits-rev2".quests';
  end if;
end $$;

-- 3) Event Cards table (events live here)
create table if not exists "arc-spirits-rev2".event_cards (
  id uuid primary key default gen_random_uuid(),
  internal_name text not null,
  stage text not null default 'stage_1'::text,
  title text not null,
  description text null,
  stage_completion text null,
  reward_rows jsonb not null default '[]'::jsonb,
  image_path text null,
  card_image_path text null,
  data jsonb not null default '{}'::jsonb,
  order_num integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint event_cards_stage_check
    check (stage = any (array['stage_1'::text, 'stage_2'::text, 'stage_3'::text, 'final_stage'::text, 'endgame'::text]))
);

create unique index if not exists event_cards_internal_name_key
  on "arc-spirits-rev2".event_cards (internal_name);

create index if not exists event_cards_stage_idx
  on "arc-spirits-rev2".event_cards (stage);

create index if not exists event_cards_order_idx
  on "arc-spirits-rev2".event_cards (order_num);

comment on table "arc-spirits-rev2".event_cards is
  'Owned Event Cards library. Scenarios reference these via scenario_deck_entries(kind=event).';

-- 4) Scenario Deck Entries (single ordered list per scenario)
create table if not exists "arc-spirits-rev2".scenario_deck_entries (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references "arc-spirits-rev2".scenarios(id) on delete cascade,

  kind text not null,
  order_num integer not null default 0,
  quantity integer not null default 1,

  -- Scenario-specific stage assignment for cards that need it (location/traveler).
  entry_stage text null,

  -- Scenario-specific overrides (render style, notes, etc).
  data jsonb not null default '{}'::jsonb,

  -- One-of references (exactly one must be set, based on kind).
  monster_id uuid null references "arc-spirits-rev2".monsters(id),
  game_location_id uuid null references "arc-spirits-rev2".game_locations(id),
  traveler_id uuid null references "arc-spirits-rev2".travelers(id),
  quest_id uuid null references "arc-spirits-rev2".quests(id),
  event_id uuid null references "arc-spirits-rev2".event_cards(id),

  -- Backfill helper: maps 1:1 to the legacy scenario_cards row that produced this entry.
  legacy_scenario_card_id uuid null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint scenario_deck_entries_kind_check
    check (kind = any (array['monster'::text, 'location'::text, 'traveler'::text, 'quest'::text, 'event'::text])),

  constraint scenario_deck_entries_quantity_check
    check (quantity >= 1),

  constraint scenario_deck_entries_entry_stage_check
    check (
      entry_stage is null
      or entry_stage = any (array['stage_1'::text, 'stage_2'::text, 'stage_3'::text, 'final_stage'::text, 'endgame'::text])
    ),

  constraint scenario_deck_entries_one_ref_check
    check (num_nonnulls(monster_id, game_location_id, traveler_id, quest_id, event_id) = 1),

  constraint scenario_deck_entries_kind_ref_match_check
    check (
      (kind = 'monster' and monster_id is not null and game_location_id is null and traveler_id is null and quest_id is null and event_id is null)
      or (kind = 'location' and monster_id is null and game_location_id is not null and traveler_id is null and quest_id is null and event_id is null)
      or (kind = 'traveler' and monster_id is null and game_location_id is null and traveler_id is not null and quest_id is null and event_id is null)
      or (kind = 'quest' and monster_id is null and game_location_id is null and traveler_id is null and quest_id is not null and event_id is null)
      or (kind = 'event' and monster_id is null and game_location_id is null and traveler_id is null and quest_id is null and event_id is not null)
    ),

  constraint scenario_deck_entries_stage_requirement_check
    check (
      (kind = any (array['location'::text, 'traveler'::text]) and entry_stage is not null)
      or (kind <> all (array['location'::text, 'traveler'::text]) and entry_stage is null)
    )
);

create unique index if not exists scenario_deck_entries_scenario_order_key
  on "arc-spirits-rev2".scenario_deck_entries (scenario_id, order_num);

create unique index if not exists scenario_deck_entries_legacy_scenario_card_id_key
  on "arc-spirits-rev2".scenario_deck_entries (legacy_scenario_card_id)
  where legacy_scenario_card_id is not null;

create index if not exists scenario_deck_entries_scenario_kind_order_idx
  on "arc-spirits-rev2".scenario_deck_entries (scenario_id, kind, order_num);

comment on table "arc-spirits-rev2".scenario_deck_entries is
  'Unified ordered deck list for a scenario. One row per deck entry; references one owned card table.';

-- 5) Backfill event_cards from legacy stage_cards(card_kind=event)
-- NOTE: Keep IDs stable so future code can link directly.
do $$
begin
  if to_regclass('"arc-spirits-rev2".stage_cards') is not null then
    execute $sql$
      insert into "arc-spirits-rev2".event_cards (
        id,
        internal_name,
        stage,
        title,
        description,
        stage_completion,
        reward_rows,
        image_path,
        card_image_path,
        data,
        order_num,
        created_at,
        updated_at
      )
      select
        sc.id,
        sc.name,
        sc.stage,
        sc.title,
        sc.description,
        sc.stage_completion,
        sc.reward_rows,
        sc.image_path,
        sc.card_image_path,
        sc.data,
        sc.order_num,
        sc.created_at,
        sc.updated_at
      from "arc-spirits-rev2".stage_cards sc
      where sc.card_kind = 'event'
      on conflict (id) do nothing;
    $sql$;
  end if;
end $$;

-- 6) Backfill scenario_deck_entries from legacy scenario_cards + stage_cards wrappers
-- Merge ordering rule (deterministic):
-- - Monsters first (by legacy order_num), then stage_card links (by legacy order_num).
do $$
begin
  if to_regclass('"arc-spirits-rev2".scenario_cards') is not null
     and to_regclass('"arc-spirits-rev2".stage_cards') is not null then
    execute $sql$
      with ordered as (
        select
          sc.id as legacy_scenario_card_id,
          sc.scenario_id,
          case
            when sc.card_type = 'monster' then 'monster'::text
            when sc.card_type = 'stage_card' and st.card_kind = 'event' then 'event'::text
            when sc.card_type = 'stage_card' and st.card_kind = 'stage_location' then 'location'::text
            when sc.card_type = 'stage_card' and st.card_kind = 'traveler' then 'traveler'::text
            else null::text
          end as kind,
          row_number() over (
            partition by sc.scenario_id
            order by
              case when sc.card_type = 'monster' then 1 else 2 end,
              sc.order_num nulls last,
              sc.id
          ) - 1 as new_order_num,

          -- References
          case when sc.card_type = 'monster' then sc.card_id else null end as monster_id,
          case when sc.card_type = 'stage_card' and st.card_kind = 'stage_location' then st.game_location_id else null end as game_location_id,
          case when sc.card_type = 'stage_card' and st.card_kind = 'traveler' then st.traveler_id else null end as traveler_id,
          null::uuid as quest_id,
          case when sc.card_type = 'stage_card' and st.card_kind = 'event' then st.id else null end as event_id,

          -- Scenario-specific fields
          case when sc.card_type = 'stage_card' and st.card_kind in ('stage_location','traveler') then st.stage else null end as entry_stage,
          case when sc.card_type = 'stage_card' and st.card_kind in ('stage_location','traveler') then st.data else '{}'::jsonb end as data,

          -- Quantity
          case when sc.card_type = 'monster' then sc.quantity else 1 end as quantity
        from "arc-spirits-rev2".scenario_cards sc
        left join "arc-spirits-rev2".stage_cards st
          on st.id = sc.card_id
         and sc.card_type = 'stage_card'
        where sc.card_type = 'monster'
           or (sc.card_type = 'stage_card' and st.card_kind in ('event','stage_location','traveler'))
      )
      insert into "arc-spirits-rev2".scenario_deck_entries (
        scenario_id,
        kind,
        order_num,
        quantity,
        entry_stage,
        data,
        monster_id,
        game_location_id,
        traveler_id,
        quest_id,
        event_id,
        legacy_scenario_card_id
      )
      select
        o.scenario_id,
        o.kind,
        o.new_order_num,
        o.quantity,
        o.entry_stage,
        o.data,
        o.monster_id,
        o.game_location_id,
        o.traveler_id,
        o.quest_id,
        o.event_id,
        o.legacy_scenario_card_id
      from ordered o
      where o.kind is not null
        and not exists (
          select 1
          from "arc-spirits-rev2".scenario_deck_entries sde
          where sde.legacy_scenario_card_id = o.legacy_scenario_card_id
        );
    $sql$;
  end if;
end $$;

