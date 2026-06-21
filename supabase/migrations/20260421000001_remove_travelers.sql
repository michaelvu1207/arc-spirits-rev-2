delete from "arc-spirits-rev2".scenario_deck_entries
where kind = 'traveler' or traveler_id is not null;

delete from "arc-spirits-rev2".stage_cards
where card_kind = 'traveler' or traveler_id is not null;

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_traveler_id_fkey;

alter table "arc-spirits-rev2".stage_cards
  drop constraint if exists stage_cards_traveler_id_fkey;

alter table "arc-spirits-rev2".scenario_deck_entries
  drop column if exists traveler_id;

alter table "arc-spirits-rev2".stage_cards
  drop column if exists traveler_id;

drop table if exists "arc-spirits-rev2".traveler_special_effects;
drop table if exists "arc-spirits-rev2".travelers;

alter table "arc-spirits-rev2".scenario_deck_entries
  drop constraint if exists scenario_deck_entries_kind_check;

alter table "arc-spirits-rev2".scenario_deck_entries
  add constraint scenario_deck_entries_kind_check
  check (kind is null or kind in ('monster', 'location', 'event', 'stage_completion', 'stage_divider'));

alter table "arc-spirits-rev2".stage_cards
  drop constraint if exists stage_cards_card_kind_check;

alter table "arc-spirits-rev2".stage_cards
  add constraint stage_cards_card_kind_check
  check (card_kind in ('event', 'stage_location'));
