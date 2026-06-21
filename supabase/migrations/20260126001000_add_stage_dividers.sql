-- Stage Dividers: scenario deck entries that mark stage transitions
--
-- Adds:
-- - arc-spirits-rev2.stage_dividers: stores divider-specific text (stage_completion)
-- - scenario_deck_entries.kind = 'stage_divider' with FK scenario_deck_entries.stage_divider_id
-- - Updated CHECK constraints to include the new kind and reference column

create table if not exists "arc-spirits-rev2".stage_dividers (
  id uuid primary key default gen_random_uuid(),
  -- Condition to advance to the next stage (displayed on the divider card)
  stage_completion text,
  -- Extensible payload for future divider fields (render style, notes, etc.)
  data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

comment on table "arc-spirits-rev2".stage_dividers is
  'Scenario deck entry type: a stage divider card that shows stage number and completion condition.';

comment on column "arc-spirits-rev2".stage_dividers.stage_completion is
  'Condition to advance to the next stage (display-only).';

alter table "arc-spirits-rev2".scenario_deck_entries
  add column if not exists stage_divider_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".scenario_deck_entries'::regclass
      and conname = 'scenario_deck_entries_stage_divider_id_fkey'
  ) then
    alter table "arc-spirits-rev2".scenario_deck_entries
      add constraint scenario_deck_entries_stage_divider_id_fkey
      foreign key (stage_divider_id) references "arc-spirits-rev2".stage_dividers(id);
  end if;
end $$;

create index if not exists scenario_deck_entries_stage_divider_id_idx
  on "arc-spirits-rev2".scenario_deck_entries (stage_divider_id);

-- Update CHECK constraints to support kind='stage_divider' and the new reference column.
alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_kind_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_kind_check
  check (kind = any (array['monster'::text, 'location'::text, 'traveler'::text, 'event'::text, 'stage_divider'::text]));

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_one_ref_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_one_ref_check
  check ((num_nonnulls(monster_id, game_location_id, traveler_id, event_id, stage_divider_id) = 1));

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_kind_ref_match_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_kind_ref_match_check
  check (
    (
      (kind = 'monster'::text)
      and (monster_id is not null)
      and (game_location_id is null)
      and (traveler_id is null)
      and (event_id is null)
      and (stage_divider_id is null)
    ) or (
      (kind = 'location'::text)
      and (monster_id is null)
      and (game_location_id is not null)
      and (traveler_id is null)
      and (event_id is null)
      and (stage_divider_id is null)
    ) or (
      (kind = 'traveler'::text)
      and (monster_id is null)
      and (game_location_id is null)
      and (traveler_id is not null)
      and (event_id is null)
      and (stage_divider_id is null)
    ) or (
      (kind = 'event'::text)
      and (monster_id is null)
      and (game_location_id is null)
      and (traveler_id is null)
      and (event_id is not null)
      and (stage_divider_id is null)
    ) or (
      (kind = 'stage_divider'::text)
      and (monster_id is null)
      and (game_location_id is null)
      and (traveler_id is null)
      and (event_id is null)
      and (stage_divider_id is not null)
    )
  );

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_stage_requirement_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_stage_requirement_check
  check (
    (
      (kind = any (array['location'::text, 'traveler'::text, 'stage_divider'::text]))
      and (entry_stage is not null)
    ) or (
      (kind <> all (array['location'::text, 'traveler'::text, 'stage_divider'::text]))
      and (entry_stage is null)
    )
  );
