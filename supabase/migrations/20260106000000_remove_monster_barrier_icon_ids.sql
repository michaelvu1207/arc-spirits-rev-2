-- Remove deprecated barrier icon slots for monsters (replaced by reward_track)

alter table "arc-spirits-rev2".monsters
  drop column if exists barrier_icon_ids;

