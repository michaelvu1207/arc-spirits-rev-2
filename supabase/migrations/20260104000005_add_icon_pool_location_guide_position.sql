-- Add optional ordering field for Locations Guide legend UI.

alter table "arc-spirits-rev2".icon_pool
  add column if not exists location_guide_position integer;

comment on column "arc-spirits-rev2".icon_pool.location_guide_position is
  'Optional sort/group position for Locations Guide (lower numbers appear first).';

