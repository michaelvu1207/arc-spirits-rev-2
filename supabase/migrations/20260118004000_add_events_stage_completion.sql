-- Add stage completion text for event cards.

alter table "arc-spirits-rev2".events
  add column if not exists stage_completion text;

comment on column "arc-spirits-rev2".events.stage_completion is
  'When this stage should end; shown at the bottom of the event card';
