-- Add optional localized Guardian fields.
-- Primary values remain stored in their base columns (e.g. `guardians.name`).

alter table "arc-spirits-rev2".guardians
  add column if not exists name_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".guardians.name_translations is
  'Optional localized guardian name keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `name`.';

