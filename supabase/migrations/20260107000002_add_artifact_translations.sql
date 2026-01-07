-- Add optional localized Artifact fields.
-- Primary values remain stored in `name`, `benefit`, and `card_image_path`.

alter table "arc-spirits-rev2".artifacts
  add column if not exists name_translations jsonb not null default '{}'::jsonb,
  add column if not exists benefit_translations jsonb not null default '{}'::jsonb,
  add column if not exists card_image_path_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".artifacts.name_translations is
  'Optional localized artifact name keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `name`.';

comment on column "arc-spirits-rev2".artifacts.benefit_translations is
  'Optional localized artifact benefit text keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `benefit`.';

comment on column "arc-spirits-rev2".artifacts.card_image_path_translations is
  'Optional per-language artifact card image path keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `card_image_path`.';
