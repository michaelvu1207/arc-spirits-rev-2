-- Add a unified reward-track structure to monsters (replaces legacy reward row system for card rewards).

alter table "arc-spirits-rev2".monsters
  add column if not exists reward_track jsonb not null default '[]'::jsonb;

comment on column "arc-spirits-rev2".monsters.reward_track is
  'JSONB array of slots, each slot is a list of icon_pool UUIDs. Semantics: slot0 participation, slots 1..killed-1 are Damage 1.., slot killed is KILLED; killed = max(1, barrier).';

