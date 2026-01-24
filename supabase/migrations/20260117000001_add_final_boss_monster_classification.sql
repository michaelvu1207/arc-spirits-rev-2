-- Add new monster_classification value: final_boss

alter table "arc-spirits-rev2".monsters
  drop constraint if exists monsters_monster_classification_check;

alter table "arc-spirits-rev2".monsters
  add constraint monsters_monster_classification_check
  check (
    monster_classification = any (
      array[
        'monster'::text,
        'abyss_guardian'::text,
        'boss'::text,
        'final_boss'::text
      ]
    )
  );

