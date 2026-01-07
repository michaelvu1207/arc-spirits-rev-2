-- Add optional localized Icon Guide fields for icon_pool.
-- Primary values remain stored in `icon_guide_name`, `icon_guide_group`, and `description`.

alter table "arc-spirits-rev2".icon_pool
  add column if not exists icon_guide_name_translations jsonb not null default '{}'::jsonb,
  add column if not exists icon_guide_group_translations jsonb not null default '{}'::jsonb,
  add column if not exists description_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".icon_pool.icon_guide_name_translations is
  'Optional localized Icon Guide name keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `icon_guide_name`.';

comment on column "arc-spirits-rev2".icon_pool.icon_guide_group_translations is
  'Optional localized Icon Guide group label keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `icon_guide_group`.';

comment on column "arc-spirits-rev2".icon_pool.description_translations is
  'Optional localized icon description keyed by language tag (e.g. "es", "fr-CA"). Primary value remains `description`.';
