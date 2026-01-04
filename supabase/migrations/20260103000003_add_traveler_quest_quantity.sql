-- Add quantity to traveler_quests (controls duplicate copies in exports)
alter table if exists "arc-spirits-rev2".traveler_quests
  add column if not exists quantity integer not null default 1 check (quantity >= 1);

comment on column "arc-spirits-rev2".traveler_quests.quantity is
  'Number of copies of this quest to export to decks. Defaults to 1.';
