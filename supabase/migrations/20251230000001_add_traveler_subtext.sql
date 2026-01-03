alter table "arc-spirits-rev2".travelers
  add column if not exists traveler_subtext text;

comment on column "arc-spirits-rev2".travelers.traveler_subtext is
  'Optional short subtext line shown on traveler cards.';
