-- Add optional text reward row to traveler_quests
alter table if exists "arc-spirits-rev2".traveler_quests
  add column if not exists reward_text text;

comment on column "arc-spirits-rev2".traveler_quests.reward_text is
  'Optional text-based reward row for traveler quests. When set, reward_icon_ids can be empty.';

