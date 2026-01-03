-- Add tags to traveler_quests
alter table if exists "arc-spirits-rev2".traveler_quests
  add column if not exists tags text[] not null default array[]::text[];

comment on column "arc-spirits-rev2".traveler_quests.tags is
  'Optional tags for organizing traveler quests (e.g. difficulty, region).';

