alter table "arc-spirits-rev2".travelers
  add column if not exists traveler_description text;

comment on column "arc-spirits-rev2".travelers.traveler_description is
  'Optional description block shown above the trade row on traveler cards.';
