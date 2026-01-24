-- Event cards are scenario-owned:
-- - Each event card may belong to at most one scenario (scenario_cards.card_type='event')
-- - Event cards always have quantity=1 in scenario_cards

-- Normalize event quantities to 1
update "arc-spirits-rev2".scenario_cards
  set quantity = 1
  where card_type = 'event' and quantity <> 1;

-- If any event card is linked to multiple scenarios, keep the first link and remove the rest
with duplicates as (
  select card_id
  from "arc-spirits-rev2".scenario_cards
  where card_type = 'event'
  group by card_id
  having count(*) > 1
),
ranked as (
  select id,
         row_number() over (
           partition by card_id
           order by created_at nulls last, order_num asc, id asc
         ) as rn
  from "arc-spirits-rev2".scenario_cards
  where card_type = 'event'
    and card_id in (select card_id from duplicates)
)
delete from "arc-spirits-rev2".scenario_cards sc
where sc.id in (select id from ranked where rn > 1);

-- Enforce quantity=1 for events
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".scenario_cards'::regclass
      and conname = 'scenario_cards_event_quantity_check'
  ) then
    alter table "arc-spirits-rev2".scenario_cards
      add constraint scenario_cards_event_quantity_check
      check (card_type <> 'event' or quantity = 1);
  end if;
end $$;

-- Enforce that event cards are never shared between scenarios
create unique index if not exists scenario_cards_event_card_unique_idx
  on "arc-spirits-rev2".scenario_cards (card_id)
  where card_type = 'event';

