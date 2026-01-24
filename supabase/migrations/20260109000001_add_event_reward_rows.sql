-- Add reward_rows column to events table
-- JSONB array of RewardRow objects: { type, icon_ids, label? }

alter table "arc-spirits-rev2".events
  add column if not exists reward_rows jsonb not null default '[]'::jsonb;

comment on column "arc-spirits-rev2".events.reward_rows is
  'Event reward rows, typically includes an all_players row.';

