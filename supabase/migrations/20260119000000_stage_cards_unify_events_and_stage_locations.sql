-- Stage Cards: unify Event Cards + Stage Location Cards
--
-- Goal:
-- - Rename `events` -> `stage_cards`
-- - Add `card_kind` discriminator and optional `game_location_id` FK
-- - Move legacy "event_location_card" rows (previously stored on `game_locations`) into `stage_cards`
-- - Update `scenario_cards` to reference `stage_cards` via `card_type='stage_card'`
-- - Deprecate event-location specific columns from `game_locations`

-- 1) Rename events -> stage_cards (idempotent)
do $$
begin
  if to_regclass('"arc-spirits-rev2".events') is not null
     and to_regclass('"arc-spirits-rev2".stage_cards') is null then
    alter table "arc-spirits-rev2".events rename to stage_cards;
  end if;
end $$;

-- 2) Rename event_type -> stage (idempotent)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'stage_cards'
      and column_name = 'event_type'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'stage_cards'
      and column_name = 'stage'
  ) then
    alter table "arc-spirits-rev2".stage_cards
      rename column event_type to stage;
  end if;
end $$;

-- 3) Extend stage_cards for future card types
alter table if exists "arc-spirits-rev2".stage_cards
  add column if not exists card_kind text;

update "arc-spirits-rev2".stage_cards
  set card_kind = 'event'
  where card_kind is null;

alter table "arc-spirits-rev2".stage_cards
  alter column card_kind set default 'event';

alter table "arc-spirits-rev2".stage_cards
  alter column card_kind set not null;

comment on column "arc-spirits-rev2".stage_cards.card_kind is
  'Stage card discriminator (e.g. event, stage_location, guide). Add new types without schema changes.';

alter table if exists "arc-spirits-rev2".stage_cards
  add column if not exists game_location_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".stage_cards'::regclass
      and conname = 'stage_cards_game_location_id_fkey'
  ) then
    alter table "arc-spirits-rev2".stage_cards
      add constraint stage_cards_game_location_id_fkey
      foreign key (game_location_id) references "arc-spirits-rev2".game_locations(id) on delete set null;
  end if;
end $$;

comment on column "arc-spirits-rev2".stage_cards.game_location_id is
  'For stage_location cards: FK to the underlying game_locations row.';

alter table if exists "arc-spirits-rev2".stage_cards
  add column if not exists data jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".stage_cards.data is
  'Extensible JSON payload for type-specific fields (future-proofing).';

-- 4) Normalize stage constraint for the renamed column
alter table "arc-spirits-rev2".stage_cards
  drop constraint if exists events_event_type_check;

alter table "arc-spirits-rev2".stage_cards
  drop constraint if exists stage_cards_stage_check;

alter table "arc-spirits-rev2".stage_cards
  add constraint stage_cards_stage_check
  check (stage = any (array['stage_1'::text, 'stage_2'::text, 'stage_3'::text, 'final_stage'::text, 'endgame'::text]));

alter table "arc-spirits-rev2".stage_cards
  alter column stage set default 'stage_1';

comment on column "arc-spirits-rev2".stage_cards.stage is
  'Narrative stage for the stage card: stage_1, stage_2, stage_3, final_stage, or endgame';

-- 5) Backfill stage-location cards into stage_cards
-- These previously lived in game_locations where card_style='event_location_card'.
insert into "arc-spirits-rev2".stage_cards (
  id,
  name,
  card_kind,
  game_location_id,
  stage,
  title,
  description,
  image_path,
  card_image_path,
  reward_rows,
  order_num,
  created_at,
  updated_at,
  stage_completion
)
select
  gl.id,
  gl.id::text,
  'stage_location'::text,
  gl.id,
  gl.event_stage,
  gl.name,
  null,
  gl.background_image_path,
  gl.event_card_image_path,
  '[]'::jsonb,
  0,
  now(),
  now(),
  null
from "arc-spirits-rev2".game_locations gl
where gl.card_style = 'event_location_card'
on conflict (id) do nothing;

create index if not exists stage_cards_card_kind_idx
  on "arc-spirits-rev2".stage_cards (card_kind);

create index if not exists stage_cards_stage_idx
  on "arc-spirits-rev2".stage_cards (stage);

create index if not exists stage_cards_game_location_id_idx
  on "arc-spirits-rev2".stage_cards (game_location_id);

create unique index if not exists stage_cards_stage_location_unique_idx
  on "arc-spirits-rev2".stage_cards (game_location_id)
  where card_kind = 'stage_location' and game_location_id is not null;

-- 6) Update scenario_cards to reference stage_cards (stage cards are no longer split by table)
alter table "arc-spirits-rev2".scenario_cards
  drop constraint if exists scenario_cards_card_type_check;

-- Convert existing links
update "arc-spirits-rev2".scenario_cards
  set card_type = 'stage_card'
  where card_type in ('event', 'event_location');

-- Stage cards are singletons in scenarios (quantity=1)
update "arc-spirits-rev2".scenario_cards
  set quantity = 1
  where card_type = 'stage_card' and quantity <> 1;

alter table "arc-spirits-rev2".scenario_cards
  add constraint scenario_cards_card_type_check
  check (card_type in ('monster', 'stage_card'));

alter table "arc-spirits-rev2".scenario_cards
  drop constraint if exists scenario_cards_event_quantity_check;

alter table "arc-spirits-rev2".scenario_cards
  add constraint scenario_cards_stage_card_quantity_check
  check (card_type <> 'stage_card' or quantity = 1);

drop index if exists "arc-spirits-rev2".scenario_cards_event_card_unique_idx;

-- Enforce that stage cards are scenario-owned (not shared between scenarios)
create unique index if not exists scenario_cards_stage_card_unique_idx
  on "arc-spirits-rev2".scenario_cards (card_id)
  where card_type = 'stage_card';

-- 7) Remove event-location-card fields from game_locations (stage cards own these now)
alter table "arc-spirits-rev2".game_locations
  drop constraint if exists game_locations_card_style_check;

alter table "arc-spirits-rev2".game_locations
  drop constraint if exists game_locations_event_stage_check;

drop index if exists "arc-spirits-rev2".game_locations_card_style_idx;

alter table "arc-spirits-rev2".game_locations
  drop column if exists card_style;

alter table "arc-spirits-rev2".game_locations
  drop column if exists event_card_image_path;

alter table "arc-spirits-rev2".game_locations
  drop column if exists event_stage;

