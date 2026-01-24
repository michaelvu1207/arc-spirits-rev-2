-- Add optional localized Class + Dice fields.
-- Primary values remain stored in their base columns (e.g. `classes.name`, `custom_dice.name`).

alter table "arc-spirits-rev2".classes
  add column if not exists name_translations jsonb not null default '{}'::jsonb,
  add column if not exists description_translations jsonb not null default '{}'::jsonb,
  add column if not exists footer_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".classes.name_translations is
  'Optional localized class name keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `name`.';

comment on column "arc-spirits-rev2".classes.description_translations is
  'Optional localized class description keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `description`.';

comment on column "arc-spirits-rev2".classes.footer_translations is
  'Optional localized class footer keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `footer`.';

alter table "arc-spirits-rev2".custom_dice
  add column if not exists name_translations jsonb not null default '{}'::jsonb,
  add column if not exists description_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".custom_dice.name_translations is
  'Optional localized dice name keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `name`.';

comment on column "arc-spirits-rev2".custom_dice.description_translations is
  'Optional localized dice description keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `description`.';

alter table "arc-spirits-rev2".dice_sides
  add column if not exists reward_description_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".dice_sides.reward_description_translations is
  'Optional localized dice side reward description keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `reward_description`.';

