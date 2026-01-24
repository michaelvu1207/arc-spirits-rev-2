-- Ensure monsters.monster_classification allows final_boss.

do $$
declare
  current_def text;
begin
  select pg_get_constraintdef(c.oid)
    into current_def
  from pg_constraint c
  where c.conrelid = '"arc-spirits-rev2".monsters'::regclass
    and c.conname = 'monsters_monster_classification_check';

  if current_def is null or current_def not ilike '%final_boss%' then
    execute 'alter table "arc-spirits-rev2".monsters drop constraint if exists monsters_monster_classification_check';
    execute 'alter table "arc-spirits-rev2".monsters ' ||
      'add constraint monsters_monster_classification_check ' ||
      'check (monster_classification in (''monster'', ''abyss_guardian'', ''boss'', ''final_boss''))';
  end if;
end $$;

