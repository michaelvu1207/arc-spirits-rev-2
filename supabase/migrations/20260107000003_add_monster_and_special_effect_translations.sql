-- Add optional localized Monster + Special Effect fields.
-- Primary values remain stored in their base columns (e.g. `monsters.name`, `special_effects.description`).

alter table "arc-spirits-rev2".monsters
  add column if not exists name_translations jsonb not null default '{}'::jsonb,
  add column if not exists special_conditions_translations jsonb not null default '{}'::jsonb,
  add column if not exists card_image_path_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".monsters.name_translations is
  'Optional localized monster name keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `name`.';

comment on column "arc-spirits-rev2".monsters.special_conditions_translations is
  'Optional localized monster special_conditions keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `special_conditions`.';

comment on column "arc-spirits-rev2".monsters.card_image_path_translations is
  'Optional per-language monster card image path keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `card_image_path`.';

alter table "arc-spirits-rev2".special_effects
  add column if not exists name_translations jsonb not null default '{}'::jsonb,
  add column if not exists description_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".special_effects.name_translations is
  'Optional localized special effect name keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `name`.';

comment on column "arc-spirits-rev2".special_effects.description_translations is
  'Optional localized special effect description keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `description`.';

