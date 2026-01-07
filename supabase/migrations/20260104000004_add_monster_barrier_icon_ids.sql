-- Add barrier icon slots for monsters (icons displayed in the bottom barrier track)

alter table "arc-spirits-rev2".monsters
  add column if not exists barrier_icon_ids uuid[] not null default '{}'::uuid[];

comment on column "arc-spirits-rev2".monsters.barrier_icon_ids is
  'Optional icon_pool UUIDs for each barrier slot (left-to-right).';

