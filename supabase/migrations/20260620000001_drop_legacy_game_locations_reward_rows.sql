-- Drop the legacy game_locations.reward_rows jsonb column.
--
-- Location reward rows are now authored exclusively in the normalized model
-- (game_location_rows + reward_row_assignments). The old jsonb column was a
-- second, stale source of truth (e.g. it was missing rows that the new model
-- has) and is no longer read by any consumer: the game (spectate) and the
-- rev-2 editor/card configurator both read the normalized model, and the
-- data-render export has been removed.

alter table "arc-spirits-rev2".game_locations drop column if exists reward_rows;
