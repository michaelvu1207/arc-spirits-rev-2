-- Add Arcane as an assignable monster state.

alter table "arc-spirits-rev2".monsters
  drop constraint if exists monsters_state_check;

alter table "arc-spirits-rev2".monsters
  add constraint monsters_state_check
  check (state = any (array['tainted'::text, 'corrupt'::text, 'fallen'::text, 'arcane'::text]));

