-- Allow multiple stage_location stage cards per game location
--
-- We want to be able to include the same game location card multiple times in a scenario (as separate stage cards),
-- without using scenario_cards.quantity. This requires allowing multiple `stage_cards` rows to reference the same
-- `game_location_id`.

drop index if exists "arc-spirits-rev2".stage_cards_stage_location_unique_idx;

-- Keep query performance for game_location_id lookups (previously covered by the unique index).
create index if not exists stage_cards_stage_location_location_id_idx
  on "arc-spirits-rev2".stage_cards (game_location_id)
  where card_kind = 'stage_location' and game_location_id is not null;

