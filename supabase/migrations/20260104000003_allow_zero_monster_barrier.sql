-- Allow monsters.barrier to be 0 (remove stale constraint that required >= 1)

alter table "arc-spirits-rev2".monsters
  drop constraint if exists monsters_level_check;

