-- Edition-specific Arcane Abyss decks
-- Moves monster deck quantity/order and event order into per-edition mapping tables.

-- Per-edition monster deck membership + ordering + quantity
create table if not exists "arc-spirits-rev2".edition_monster_cards (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references "arc-spirits-rev2".editions(id) on delete cascade,
  monster_id uuid not null references "arc-spirits-rev2".monsters(id) on delete cascade,
  order_num integer not null default 0,
  quantity integer not null default 1 check (quantity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, monster_id)
);

create index if not exists edition_monster_cards_edition_order_idx
  on "arc-spirits-rev2".edition_monster_cards (edition_id, order_num);

create index if not exists edition_monster_cards_monster_id_idx
  on "arc-spirits-rev2".edition_monster_cards (monster_id);

-- Per-edition event deck membership + ordering
create table if not exists "arc-spirits-rev2".edition_event_cards (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references "arc-spirits-rev2".editions(id) on delete cascade,
  event_id uuid not null references "arc-spirits-rev2".events(id) on delete cascade,
  order_num integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, event_id)
);

create index if not exists edition_event_cards_edition_order_idx
  on "arc-spirits-rev2".edition_event_cards (edition_id, order_num);

create index if not exists edition_event_cards_event_id_idx
  on "arc-spirits-rev2".edition_event_cards (event_id);

-- updated_at triggers
drop trigger if exists update_edition_monster_cards_updated_at on "arc-spirits-rev2".edition_monster_cards;
create trigger update_edition_monster_cards_updated_at
before update on "arc-spirits-rev2".edition_monster_cards
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_edition_event_cards_updated_at on "arc-spirits-rev2".edition_event_cards;
create trigger update_edition_event_cards_updated_at
before update on "arc-spirits-rev2".edition_event_cards
for each row
execute function public.update_updated_at_column();

-- Enable RLS + permissive policies (this is a game-data management interface)
alter table "arc-spirits-rev2".edition_monster_cards enable row level security;
drop policy if exists "Allow all for edition_monster_cards" on "arc-spirits-rev2".edition_monster_cards;
create policy "Allow all for edition_monster_cards"
on "arc-spirits-rev2".edition_monster_cards
for all
using (true)
with check (true);

alter table "arc-spirits-rev2".edition_event_cards enable row level security;
drop policy if exists "Allow all for edition_event_cards" on "arc-spirits-rev2".edition_event_cards;
create policy "Allow all for edition_event_cards"
on "arc-spirits-rev2".edition_event_cards
for all
using (true)
with check (true);

-- Backfill existing editions so current exports stay the same (e.g. "Base" includes all current monsters/events).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'arc-spirits-rev2'
      and table_name = 'monsters'
      and column_name = 'quantity'
  ) then
    insert into "arc-spirits-rev2".edition_monster_cards (edition_id, monster_id, order_num, quantity)
    select e.id, m.id, coalesce(m.order_num, 0), coalesce(m.quantity, 1)
    from "arc-spirits-rev2".editions e
    cross join "arc-spirits-rev2".monsters m
    on conflict (edition_id, monster_id) do nothing;
  else
    insert into "arc-spirits-rev2".edition_monster_cards (edition_id, monster_id, order_num, quantity)
    select e.id, m.id, coalesce(m.order_num, 0), 1
    from "arc-spirits-rev2".editions e
    cross join "arc-spirits-rev2".monsters m
    on conflict (edition_id, monster_id) do nothing;
  end if;

  insert into "arc-spirits-rev2".edition_event_cards (edition_id, event_id, order_num)
  select e.id, ev.id, coalesce(ev.order_num, 0)
  from "arc-spirits-rev2".editions e
  cross join "arc-spirits-rev2".events ev
  on conflict (edition_id, event_id) do nothing;
end $$;

-- Quantity is now edition-specific.
alter table "arc-spirits-rev2".monsters
  drop column if exists quantity;

