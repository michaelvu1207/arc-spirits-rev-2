-- Rename the persisted game-state snapshot columns to the new "mat" umbrella naming.
-- These hold runes AND relics (mats), and spirit-augment attachments respectively.
-- Column renames are metadata-only — all existing snapshot rows (~4019) keep their data.
--
-- Spectate is the sole writer/reader of these columns and is deployed in lockstep with
-- this rename, so no backward-compatible fallback is needed.

alter table "arc-spirits-game-history".game_state_snapshots
  rename column runes to mats;

alter table "arc-spirits-game-history".game_state_snapshots
  rename column spirit_rune_attachments to spirit_augment_attachments;
