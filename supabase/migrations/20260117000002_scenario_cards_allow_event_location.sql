-- Allow scenario_cards.card_type to include event_location.

do $$
declare
  c record;
begin
  -- Drop any existing card_type domain check (but keep other checks like event quantity).
  for c in
    select conname
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".scenario_cards'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%card_type in%'
        or pg_get_constraintdef(oid) ilike '%card_type = any%'
      )
      and pg_get_constraintdef(oid) ilike '%monster%'
      and pg_get_constraintdef(oid) ilike '%event%'
  loop
    execute format('alter table "arc-spirits-rev2".scenario_cards drop constraint if exists %I', c.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".scenario_cards'::regclass
      and conname = 'scenario_cards_card_type_check'
  ) then
    alter table "arc-spirits-rev2".scenario_cards
      add constraint scenario_cards_card_type_check
      check (card_type in ('monster', 'event', 'event_location'));
  end if;
end $$;

