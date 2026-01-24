-- Align events.event_type values to match monster stages.
-- New allowed set: stage_1, stage_2, stage_3, final_stage
--
-- Legacy mappings:
-- - opening -> stage_1
-- - stage_4 -> final_stage
-- - finale  -> final_stage

-- Drop the legacy constraint early so we can safely migrate values.
alter table "arc-spirits-rev2".events
  drop constraint if exists events_event_type_check;

update "arc-spirits-rev2".events
set event_type = 'stage_1'
where event_type = 'opening';

update "arc-spirits-rev2".events
set event_type = 'final_stage'
where event_type in ('stage_4', 'finale');

-- Defensive normalization for any unexpected legacy values.
update "arc-spirits-rev2".events
set event_type = 'stage_1'
where event_type not in ('stage_1', 'stage_2', 'stage_3', 'final_stage');

alter table "arc-spirits-rev2".events
  add constraint events_event_type_check
  check (event_type in ('stage_1', 'stage_2', 'stage_3', 'final_stage'));

alter table "arc-spirits-rev2".events
  alter column event_type set default 'stage_1';

comment on column "arc-spirits-rev2".events.event_type is
  'Narrative stage for the event: stage_1, stage_2, stage_3, or final_stage';
