-- Create travelers table (mirrors monsters schema)
create table if not exists "arc-spirits-rev2".travelers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  damage integer not null default 0 check (damage >= 0),
  barrier integer not null default 0 check (barrier >= 0),
  state text not null default 'tainted' check (state in ('tainted','corrupt','fallen','boss')),
  icon text,
  image_path text,
  reward_rows jsonb not null default '[]'::jsonb,
  order_num integer not null default 0,
  card_image_path text,
  special_conditions text,
  invade_location_id uuid null
    references "arc-spirits-rev2".game_locations(id) on delete set null,
  quantity integer not null default 1 check (quantity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists travelers_name_idx
  on "arc-spirits-rev2".travelers (name);

create index if not exists travelers_invade_location_id_idx
  on "arc-spirits-rev2".travelers (invade_location_id);

drop trigger if exists update_travelers_updated_at on "arc-spirits-rev2".travelers;

create trigger update_travelers_updated_at
before update on "arc-spirits-rev2".travelers
for each row
execute function public.update_updated_at_column();

comment on column "arc-spirits-rev2".travelers.invade_location_id is
  'Optional location where this traveler invades (FK to game_locations).';

-- Create traveler_special_effects join table
create table if not exists "arc-spirits-rev2".traveler_special_effects (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references "arc-spirits-rev2".travelers(id) on delete cascade,
  special_effect_id uuid not null references "arc-spirits-rev2".special_effects(id) on delete cascade,
  position integer,
  created_at timestamptz not null default now()
);

create index if not exists traveler_special_effects_traveler_id_idx
  on "arc-spirits-rev2".traveler_special_effects (traveler_id);

create index if not exists traveler_special_effects_special_effect_id_idx
  on "arc-spirits-rev2".traveler_special_effects (special_effect_id);
