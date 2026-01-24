-- Add scenario meta fields for TTS export / UI.
-- - display_name: optional user-facing name (fallback to name)
-- - display_image_path: optional uploaded image path in storage
-- - game_location_ids: optional curated list of game_locations referenced by scenario

alter table "arc-spirits-rev2".scenarios
  add column if not exists display_name text null,
  add column if not exists display_image_path text null,
  add column if not exists game_location_ids uuid[] not null default '{}'::uuid[];

-- Keep compatibility view in sync (Postgres expands `*` at view creation time).
create or replace view "arc-spirits-rev2".abyss_scenarios as
  select * from "arc-spirits-rev2".scenarios;

