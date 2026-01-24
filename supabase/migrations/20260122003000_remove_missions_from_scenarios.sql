-- Missions are independent (not part of scenario decks)
--
-- This migration updates scenario_deck_entries to remove mission support:
-- - Deletes any existing mission entries from scenario_deck_entries
-- - Drops the mission_id column
-- - Restricts kind to monster|location|traveler|event

-- Remove any existing mission entries first.
delete from "arc-spirits-rev2".scenario_deck_entries
where kind = 'mission';

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_kind_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_one_ref_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_kind_ref_match_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_mission_id_fkey;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'scenario_deck_entries'
      and column_name = 'mission_id'
  ) then
    alter table "arc-spirits-rev2".scenario_deck_entries
      drop column mission_id;
  end if;
end $$;

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_kind_check
  check (kind = any (array['monster'::text, 'location'::text, 'traveler'::text, 'event'::text]));

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_one_ref_check
  check (num_nonnulls(monster_id, game_location_id, traveler_id, event_id) = 1);

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_kind_ref_match_check
  check (
    (kind = 'monster' and monster_id is not null and game_location_id is null and traveler_id is null and event_id is null)
    or (kind = 'location' and monster_id is null and game_location_id is not null and traveler_id is null and event_id is null)
    or (kind = 'traveler' and monster_id is null and game_location_id is null and traveler_id is not null and event_id is null)
    or (kind = 'event' and monster_id is null and game_location_id is null and traveler_id is null and event_id is not null)
  );

