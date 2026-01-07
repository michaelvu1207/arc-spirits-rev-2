-- Add Icon Guide-only display overrides

alter table "arc-spirits-rev2".icon_pool
  add column if not exists icon_guide_name text,
  add column if not exists icon_guide_group text;

comment on column "arc-spirits-rev2".icon_pool.icon_guide_name is
  'Optional display name override used only in the Icon Guide UI/export.';

comment on column "arc-spirits-rev2".icon_pool.icon_guide_group is
  'Optional group label used to visually separate icons in the Icon Guide export.';

