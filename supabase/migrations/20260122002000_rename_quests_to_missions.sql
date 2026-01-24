-- Rename Quest cards -> Missions (canonical naming)
--
-- Goal:
-- - Quest cards are now referred to as "missions" across DB + app.
-- - Keep compatibility views (`quests`, `traveler_quests`) so older code can still read/write.
-- - Update unified scenario deck entries to use:
--   kind = 'mission' and column mission_id (instead of kind='quest' / quest_id).

-- 1) Rename table `quests` -> `missions` (idempotent)
do $$
begin
  if to_regclass('"arc-spirits-rev2".missions') is null
     and to_regclass('"arc-spirits-rev2".quests') is not null then
    alter table "arc-spirits-rev2".quests rename to missions;
  end if;
end $$;

-- 2) Compatibility view: keep `quests` working for reads/writes.
do $$
begin
  if to_regclass('"arc-spirits-rev2".quests') is null
     and to_regclass('"arc-spirits-rev2".missions') is not null then
    execute 'create view "arc-spirits-rev2".quests as select * from "arc-spirits-rev2".missions';
  end if;
end $$;

-- 3) Compatibility view: keep `traveler_quests` working for reads/writes.
do $$
begin
  if to_regclass('"arc-spirits-rev2".traveler_quests') is null
     and to_regclass('"arc-spirits-rev2".missions') is not null then
    execute 'create view "arc-spirits-rev2".traveler_quests as select * from "arc-spirits-rev2".missions';
  end if;
end $$;

-- 4) scenario_deck_entries: quest -> mission (column + kind + constraints)
alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_kind_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_one_ref_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_kind_ref_match_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'scenario_deck_entries'
      and column_name = 'quest_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'scenario_deck_entries'
      and column_name = 'mission_id'
  ) then
    alter table "arc-spirits-rev2".scenario_deck_entries rename column quest_id to mission_id;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'scenario_deck_entries_quest_id_fkey'
  ) then
    alter table "arc-spirits-rev2".scenario_deck_entries
      rename constraint scenario_deck_entries_quest_id_fkey to scenario_deck_entries_mission_id_fkey;
  end if;
end $$;

update "arc-spirits-rev2".scenario_deck_entries
set kind = 'mission'
where kind = 'quest';

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_kind_check
  check (kind = any (array['monster'::text, 'location'::text, 'traveler'::text, 'mission'::text, 'event'::text]));

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_one_ref_check
  check (num_nonnulls(monster_id, game_location_id, traveler_id, mission_id, event_id) = 1);

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_kind_ref_match_check
  check (
    (kind = 'monster' and monster_id is not null and game_location_id is null and traveler_id is null and mission_id is null and event_id is null)
    or (kind = 'location' and monster_id is null and game_location_id is not null and traveler_id is null and mission_id is null and event_id is null)
    or (kind = 'traveler' and monster_id is null and game_location_id is null and traveler_id is not null and mission_id is null and event_id is null)
    or (kind = 'mission' and monster_id is null and game_location_id is null and traveler_id is null and mission_id is not null and event_id is null)
    or (kind = 'event' and monster_id is null and game_location_id is null and traveler_id is null and mission_id is null and event_id is not null)
  );

