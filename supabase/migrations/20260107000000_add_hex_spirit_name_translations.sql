-- Add optional localized names for hex spirits (primary name remains `name`)

alter table "arc-spirits-rev2".hex_spirits
  add column if not exists name_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".hex_spirits.name_translations is
  'Optional localized names keyed by language tag (e.g. \"es\", \"fr-CA\"). Primary name remains the `name` column.';

