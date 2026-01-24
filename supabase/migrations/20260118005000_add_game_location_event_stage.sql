-- Event-location cards (game_locations.card_style='event_location_card') need a stage for TTS export.
-- This stage is not rendered on the card; it's metadata for exported JSON.

alter table "arc-spirits-rev2".game_locations
  add column if not exists event_stage text;

update "arc-spirits-rev2".game_locations
  set event_stage = 'stage_1'
  where event_stage is null;

alter table "arc-spirits-rev2".game_locations
  alter column event_stage set default 'stage_1';

alter table "arc-spirits-rev2".game_locations
  alter column event_stage set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".game_locations'::regclass
      and conname = 'game_locations_event_stage_check'
  ) then
    alter table "arc-spirits-rev2".game_locations
      add constraint game_locations_event_stage_check
      check (event_stage in ('stage_1', 'stage_2', 'stage_3', 'final_stage', 'endgame'));
  end if;
end $$;

comment on column "arc-spirits-rev2".game_locations.event_stage is
  'Narrative stage metadata for event-location cards: stage_1, stage_2, stage_3, final_stage, or endgame';

