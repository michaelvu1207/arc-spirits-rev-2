-- Drop the orphaned pre-rev2 legacy schema `game_data` in its entirety.
--
-- It holds the OLD Arc Spirits design (units, encounters, artifacts, traits, monster_cards,
-- custom_dice, dice_sides, saved_formations, simulation_settings, meta_simulation_presets)
-- — ~200 rows of dead data, superseded by the arc-spirits-rev2 schema. Verified: zero
-- references in spectate or rev-2 code, and no FK/view dependencies from outside the schema.
-- This is intentional, confirmed removal of legacy data.

drop schema if exists game_data cascade;
