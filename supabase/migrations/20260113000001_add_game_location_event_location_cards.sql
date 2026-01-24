-- Game Locations can optionally be exported/rendered as "Event Location Cards":
-- event-card sized, using the event card frame/background but showing only a location image.

alter table "arc-spirits-rev2".game_locations
  add column if not exists card_style text;

update "arc-spirits-rev2".game_locations
  set card_style = 'standard'
  where card_style is null;

alter table "arc-spirits-rev2".game_locations
  alter column card_style set default 'standard';

alter table "arc-spirits-rev2".game_locations
  alter column card_style set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".game_locations'::regclass
      and conname = 'game_locations_card_style_check'
  ) then
    alter table "arc-spirits-rev2".game_locations
      add constraint game_locations_card_style_check
      check (card_style in ('standard', 'event_location_card'));
  end if;
end $$;

alter table "arc-spirits-rev2".game_locations
  add column if not exists event_card_image_path text;

create index if not exists game_locations_card_style_idx
  on "arc-spirits-rev2".game_locations (card_style);

