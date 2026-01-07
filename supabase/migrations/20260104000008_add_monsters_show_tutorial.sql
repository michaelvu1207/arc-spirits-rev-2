-- Allow monsters to toggle the tutorial callout on the card.

alter table "arc-spirits-rev2".monsters
  add column if not exists show_tutorial boolean not null default true;

comment on column "arc-spirits-rev2".monsters.show_tutorial is
  'When true, the card shows the tutorial callout. When false, that callout shows Participation rewards from reward_track[0] instead.';

