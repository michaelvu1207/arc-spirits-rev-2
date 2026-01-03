-- Add monster_classification to monsters and migrate legacy boss state into it.

alter table "arc-spirits-rev2".monsters
  add column if not exists monster_classification text not null default 'monster';

-- Ensure a value exists even if the column pre-existed as nullable.
update "arc-spirits-rev2".monsters
set monster_classification = coalesce(monster_classification, 'monster');

-- Migrate legacy boss state into classification.
update "arc-spirits-rev2".monsters
set monster_classification = 'boss'
where state = 'boss';

-- Bosses should still be grouped under Fallen state.
update "arc-spirits-rev2".monsters
set state = 'fallen'
where state = 'boss';

-- Defensive normalization for any legacy/invalid states.
update "arc-spirits-rev2".monsters
set state = 'tainted'
where state not in ('tainted', 'corrupt', 'fallen');

-- Ensure default aligns with the enforced state constraint.
alter table "arc-spirits-rev2".monsters
  alter column state set default 'tainted';

-- Replace state constraint to match the new enum (boss is now a classification).
alter table "arc-spirits-rev2".monsters
  drop constraint if exists monsters_state_check;

alter table "arc-spirits-rev2".monsters
  add constraint monsters_state_check
  check (state = any (array['tainted'::text, 'corrupt'::text, 'fallen'::text]));

-- Add/replace classification constraint.
alter table "arc-spirits-rev2".monsters
  drop constraint if exists monsters_monster_classification_check;

alter table "arc-spirits-rev2".monsters
  add constraint monsters_monster_classification_check
  check (monster_classification = any (array['monster'::text, 'abyss_guardian'::text, 'boss'::text]));

