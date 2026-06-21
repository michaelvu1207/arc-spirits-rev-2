-- Add a new resistance stat to monsters.
-- Date: 2026-01-30

alter table "arc-spirits-rev2".monsters
  add column if not exists resistance integer not null default 1;

comment on column "arc-spirits-rev2".monsters.resistance is
  'New monster stat. Initialized to 1 for all rows.';

-- Ensure all existing rows are set to 1 (even if the column was created previously as nullable).
update "arc-spirits-rev2".monsters
set resistance = 1
where resistance is distinct from 1;

