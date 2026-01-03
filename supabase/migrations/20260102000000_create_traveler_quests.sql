-- Create traveler_quests table (artifact-style quest cards)
create table if not exists "arc-spirits-rev2".traveler_quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  -- Array of icon_pool UUIDs representing the reward row.
  reward_icon_ids jsonb not null default '[]'::jsonb,
  order_num integer not null default 0,
  card_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists traveler_quests_title_idx
  on "arc-spirits-rev2".traveler_quests (title);

drop trigger if exists update_traveler_quests_updated_at on "arc-spirits-rev2".traveler_quests;

create trigger update_traveler_quests_updated_at
before update on "arc-spirits-rev2".traveler_quests
for each row
execute function public.update_updated_at_column();

comment on column "arc-spirits-rev2".traveler_quests.reward_icon_ids is
  'JSON array of icon_pool UUIDs that make up the quest reward row.';
