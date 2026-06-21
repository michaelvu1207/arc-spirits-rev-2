-- Restore the slot-based reward_track structure on monsters.
-- This reintroduces the canonical reward track used by the monster card icon placer.
-- Date: 2026-02-02

alter table "arc-spirits-rev2".monsters
  add column if not exists reward_track jsonb not null default '[]'::jsonb;

comment on column "arc-spirits-rev2".monsters.reward_track is
  'JSONB array of slots, each slot is a list of icon_pool UUIDs. Semantics: slot0 participation, slots 1..killed-1 are Damage 1.., slot killed is KILLED; killed = max(1, barrier).';

-- Backfill reward_track from the 2026-01-30 snapshot for any monsters that existed at that time.
update "arc-spirits-rev2".monsters m
set reward_track = coalesce(b.reward_track, '[]'::jsonb)
from "arc-spirits-rev2".monsters_backup_20260130 b
where b.id = m.id;

-- Safety: ensure no NULLs remain.
update "arc-spirits-rev2".monsters
set reward_track = '[]'::jsonb
where reward_track is null;
