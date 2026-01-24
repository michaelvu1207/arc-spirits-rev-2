-- Ensure scenario_cards.card_type allows event_location.

do $$
declare
  current_def text;
begin
  select pg_get_constraintdef(c.oid)
    into current_def
  from pg_constraint c
  where c.conrelid = '"arc-spirits-rev2".scenario_cards'::regclass
    and c.conname = 'scenario_cards_card_type_check';

  -- If the constraint is missing or doesn't include event_location, recreate it.
  if current_def is null or current_def not ilike '%event_location%' then
    execute 'alter table "arc-spirits-rev2".scenario_cards drop constraint if exists scenario_cards_card_type_check';
    execute 'alter table "arc-spirits-rev2".scenario_cards ' ||
      'add constraint scenario_cards_card_type_check ' ||
      'check (card_type in (''monster'', ''event'', ''event_location''))';
  end if;
end $$;
