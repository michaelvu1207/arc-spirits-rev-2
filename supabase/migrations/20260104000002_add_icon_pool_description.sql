-- Add optional description text to icon_pool (used for guides/legend UI)

alter table "arc-spirits-rev2".icon_pool
  add column if not exists description text;

comment on column "arc-spirits-rev2".icon_pool.description is
  'Optional human description used in legend/guide UIs.';

