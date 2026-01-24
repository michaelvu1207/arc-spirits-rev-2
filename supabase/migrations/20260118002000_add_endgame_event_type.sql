-- Allow an additional event stage: endgame

alter table "arc-spirits-rev2".events
  drop constraint if exists events_event_type_check;

alter table "arc-spirits-rev2".events
  add constraint events_event_type_check
  check (event_type in ('stage_1', 'stage_2', 'stage_3', 'final_stage', 'endgame'));

comment on column "arc-spirits-rev2".events.event_type is
  'Narrative stage for the event: stage_1, stage_2, stage_3, final_stage, or endgame';
