-- Simple key/value storage for UI configuration (JSON).

create table if not exists "arc-spirits-rev2".ui_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function "arc-spirits-rev2".ui_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ui_settings_set_updated_at_trigger on "arc-spirits-rev2".ui_settings;

create trigger ui_settings_set_updated_at_trigger
before update on "arc-spirits-rev2".ui_settings
for each row
execute function "arc-spirits-rev2".ui_settings_set_updated_at();

