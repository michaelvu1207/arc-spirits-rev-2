alter table "arc-spirits-rev2".editions
  add column if not exists is_enabled boolean not null default true;

alter table "arc-spirits-rev2".scenarios
  add column if not exists is_enabled boolean not null default true;

