alter table "arc-spirits-rev2".travelers
  add column if not exists gain_rows jsonb not null default '[]'::jsonb;

comment on column "arc-spirits-rev2".travelers.gain_rows is
  'Array of gain row objects with icon id lists.';
