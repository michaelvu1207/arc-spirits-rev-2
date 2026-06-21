-- Phase 3 (column consistency): the "game print, no icons" art path was named
-- `game_print_no_icons` on hex_spirits / disabled_hex_spirits but `game_print_no_icons_path`
-- on hex_spirit_art_raw_variants — forcing an asymmetry workaround in the rev-2 code.
-- Standardize on the `_path` suffix. rev-2-only (spectate does not read this column).
-- Applied in lockstep with the rev-2 code update.

alter table "arc-spirits-rev2".hex_spirits
  rename column game_print_no_icons to game_print_no_icons_path;
alter table "arc-spirits-rev2".disabled_hex_spirits
  rename column game_print_no_icons to game_print_no_icons_path;
