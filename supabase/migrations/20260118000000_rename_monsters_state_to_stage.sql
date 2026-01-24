-- Rename monsters.state -> monsters.stage and migrate values to the new stage enum.
-- Stages map to previous state values:
-- - tainted -> stage_1
-- - corrupt -> stage_2
-- - fallen  -> stage_3
-- - arcane  -> final_stage
-- - inactive -> inactive
--
-- Also handles legacy values from earlier migrations (normal/special/boss).

-- Drop the legacy constraint early so we can safely migrate values.
alter table "arc-spirits-rev2".monsters
  drop constraint if exists monsters_state_check;

alter table "arc-spirits-rev2".monsters
  drop constraint if exists monsters_stage_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'monsters'
      and column_name = 'state'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'monsters'
      and column_name = 'stage'
  ) then
    execute 'alter table "arc-spirits-rev2".monsters rename column state to stage';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'monsters'
      and column_name = 'state'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'monsters'
      and column_name = 'stage'
  ) then
    -- If both columns exist, prefer stage and drop state after filling.
    execute 'update "arc-spirits-rev2".monsters set stage = coalesce(stage, state)';
    execute 'alter table "arc-spirits-rev2".monsters drop column state';
  end if;
end $$;

alter table "arc-spirits-rev2".monsters
  add column if not exists stage text;

-- Migrate any legacy values into the new stage values.
update "arc-spirits-rev2".monsters
set stage = case stage
  when 'tainted' then 'stage_1'
  when 'corrupt' then 'stage_2'
  when 'fallen' then 'stage_3'
  when 'arcane' then 'final_stage'
  when 'inactive' then 'inactive'
  when 'normal' then 'stage_1'
  when 'special' then 'final_stage'
  when 'boss' then 'stage_3'
  else stage
end;

-- Defensive normalization for any legacy/invalid stages.
update "arc-spirits-rev2".monsters
set stage = 'stage_1'
where stage not in ('stage_1', 'stage_2', 'stage_3', 'final_stage', 'inactive');

alter table "arc-spirits-rev2".monsters
  alter column stage set default 'stage_1';

update "arc-spirits-rev2".monsters
set stage = coalesce(stage, 'stage_1');

alter table "arc-spirits-rev2".monsters
  alter column stage set not null;

alter table "arc-spirits-rev2".monsters
  add constraint monsters_stage_check
  check (stage in ('stage_1', 'stage_2', 'stage_3', 'final_stage', 'inactive'));
