-- Editions ↔ Scenarios: allow scenarios to appear in multiple editions
--
-- Adds join table `edition_scenarios` to control which scenarios are enabled for a given edition.
-- Backfills from existing `scenarios.edition_id` + `scenarios.order_num`.

create table if not exists "arc-spirits-rev2".edition_scenarios (
  edition_id uuid not null references "arc-spirits-rev2".editions(id) on delete cascade,
  scenario_id uuid not null references "arc-spirits-rev2".scenarios(id) on delete cascade,
  order_num integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (edition_id, scenario_id)
);

comment on table "arc-spirits-rev2".edition_scenarios is
  'Join table controlling which scenarios are enabled for an edition (many-to-many).';

create index if not exists edition_scenarios_scenario_id_idx
  on "arc-spirits-rev2".edition_scenarios (scenario_id);

create unique index if not exists edition_scenarios_edition_order_key
  on "arc-spirits-rev2".edition_scenarios (edition_id, order_num);

-- Backfill existing 1:many mapping into the join table.
insert into "arc-spirits-rev2".edition_scenarios (edition_id, scenario_id, order_num)
select
  s.edition_id,
  s.id,
  coalesce(s.order_num, 0)
from "arc-spirits-rev2".scenarios s
where s.edition_id is not null
on conflict (edition_id, scenario_id) do nothing;

