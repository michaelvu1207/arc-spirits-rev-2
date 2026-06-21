-- Drop confirmed-safe legacy tables: no FK dependents, unreferenced in code.
--   * monsters_backup_20260130          — dated manual backup
--   * disabled_hex_spirits_legacy_markers — empty, explicitly "legacy"
--   * game_state_snapshots (rev2 schema) — old play-test store in the WRONG schema;
--       live play snapshots live in the arc-spirits-game-history schema. This drops
--       ONLY the misplaced rev2 copy.
--   * arc-spirits-pixijs (game-history)  — empty experiment table

drop table if exists "arc-spirits-rev2".monsters_backup_20260130 cascade;
drop table if exists "arc-spirits-rev2".disabled_hex_spirits_legacy_markers cascade;
drop table if exists "arc-spirits-rev2".game_state_snapshots cascade;
drop table if exists "arc-spirits-game-history"."arc-spirits-pixijs" cascade;
