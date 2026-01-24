-- Edition-specific Arcane Abyss scenarios
-- - Scenarios belong to an edition
-- - scenario_cards stores per-scenario monster/event sets
-- - Monster quantities are scenario-specific (scenario_cards.quantity)
-- - Migrates existing edition_monster_cards / edition_event_cards into a default scenario per edition

-- 1) Make abyss_scenarios edition-scoped
alter table if exists "arc-spirits-rev2".abyss_scenarios
  add column if not exists edition_id uuid;

do $$
declare
  default_edition uuid;
begin
  select id into default_edition
  from "arc-spirits-rev2".editions
  order by is_default desc, name asc
  limit 1;

  if default_edition is not null then
    update "arc-spirits-rev2".abyss_scenarios
      set edition_id = default_edition
      where edition_id is null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".abyss_scenarios'::regclass
      and conname = 'abyss_scenarios_edition_id_fkey'
  ) then
    alter table "arc-spirits-rev2".abyss_scenarios
      add constraint abyss_scenarios_edition_id_fkey
      foreign key (edition_id) references "arc-spirits-rev2".editions(id) on delete cascade;
  end if;
end $$;

do $$
begin
  -- Only enforce NOT NULL when editions exist (otherwise we can't safely backfill).
  if exists (select 1 from "arc-spirits-rev2".editions) then
    alter table "arc-spirits-rev2".abyss_scenarios
      alter column edition_id set not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".abyss_scenarios'::regclass
      and conname = 'abyss_scenarios_edition_id_name_key'
  ) then
    alter table "arc-spirits-rev2".abyss_scenarios
      add constraint abyss_scenarios_edition_id_name_key unique (edition_id, name);
  end if;
end $$;

create index if not exists abyss_scenarios_edition_order_idx
  on "arc-spirits-rev2".abyss_scenarios (edition_id, order_num, name);

-- 2) Add scenario-specific monster quantities
alter table if exists "arc-spirits-rev2".scenario_cards
  add column if not exists quantity integer;

update "arc-spirits-rev2".scenario_cards
  set quantity = 1
  where quantity is null;

alter table "arc-spirits-rev2".scenario_cards
  alter column quantity set default 1;

alter table "arc-spirits-rev2".scenario_cards
  alter column quantity set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = '"arc-spirits-rev2".scenario_cards'::regclass
      and conname = 'scenario_cards_quantity_check'
  ) then
    alter table "arc-spirits-rev2".scenario_cards
      add constraint scenario_cards_quantity_check check (quantity >= 1);
  end if;
end $$;

create index if not exists scenario_cards_scenario_type_order_idx
  on "arc-spirits-rev2".scenario_cards (scenario_id, card_type, order_num);

create index if not exists scenario_cards_card_id_idx
  on "arc-spirits-rev2".scenario_cards (card_id);

-- 3) Create a default scenario per edition, and migrate edition decks into it
insert into "arc-spirits-rev2".abyss_scenarios (edition_id, name, description, order_num)
select e.id, 'Default', 'Default abyss scenario for this edition.', 0
from "arc-spirits-rev2".editions e
where not exists (
  select 1
  from "arc-spirits-rev2".abyss_scenarios s
  where s.edition_id = e.id
    and s.name = 'Default'
);

with default_scenarios as (
  select s.id as scenario_id, s.edition_id
  from "arc-spirits-rev2".abyss_scenarios s
  where s.name = 'Default'
)
insert into "arc-spirits-rev2".scenario_cards (scenario_id, card_type, card_id, order_num, quantity)
select ds.scenario_id, 'monster'::text, emc.monster_id, emc.order_num, emc.quantity
from default_scenarios ds
join "arc-spirits-rev2".edition_monster_cards emc
  on emc.edition_id = ds.edition_id
on conflict (scenario_id, card_type, card_id)
do update set
  order_num = excluded.order_num,
  quantity = excluded.quantity;

with default_scenarios as (
  select s.id as scenario_id, s.edition_id
  from "arc-spirits-rev2".abyss_scenarios s
  where s.name = 'Default'
)
insert into "arc-spirits-rev2".scenario_cards (scenario_id, card_type, card_id, order_num, quantity)
select ds.scenario_id, 'event'::text, eec.event_id, eec.order_num, 1
from default_scenarios ds
join "arc-spirits-rev2".edition_event_cards eec
  on eec.edition_id = ds.edition_id
on conflict (scenario_id, card_type, card_id)
do update set
  order_num = excluded.order_num,
  quantity = excluded.quantity;

-- 4) edition_* tables are superseded by scenarios
drop table if exists "arc-spirits-rev2".edition_monster_cards;
drop table if exists "arc-spirits-rev2".edition_event_cards;

