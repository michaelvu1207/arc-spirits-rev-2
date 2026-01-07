-- Create vengeance_cards table (quest-style scroll cards).
create table if not exists "arc-spirits-rev2".vengeance_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  reward_text text,
  -- Array of icon_pool UUIDs representing the reward row.
  reward_icon_ids jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  quantity integer not null default 1,
  order_num integer not null default 0,
  card_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vengeance_cards_title_idx
  on "arc-spirits-rev2".vengeance_cards (title);

drop trigger if exists update_vengeance_cards_updated_at on "arc-spirits-rev2".vengeance_cards;

create trigger update_vengeance_cards_updated_at
before update on "arc-spirits-rev2".vengeance_cards
for each row
execute function public.update_updated_at_column();

comment on column "arc-spirits-rev2".vengeance_cards.reward_icon_ids is
  'JSON array of icon_pool UUIDs that make up the vengeance reward row.';

comment on column "arc-spirits-rev2".vengeance_cards.reward_text is
  'Optional text reward. When present, reward_icon_ids should be empty.';

comment on column "arc-spirits-rev2".vengeance_cards.tags is
  'Optional string tags for filtering.';

comment on column "arc-spirits-rev2".vengeance_cards.quantity is
  'Number of copies of this vengeance card to export. Defaults to 1.';

