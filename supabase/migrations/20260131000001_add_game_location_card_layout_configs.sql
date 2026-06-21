-- Game location card layout configuration (global template)
-- Stores draggable placement coordinates for the Location Card "layout placer" tool.
-- Date: 2026-01-31

create table if not exists "arc-spirits-rev2".game_location_card_layout_configs (
  -- Single-row config keyed by a stable string like 'base' (or 'base:en', etc.)
  key text primary key,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table "arc-spirits-rev2".game_location_card_layout_configs is
  'Saved placement config for game location cards (name + reward row overlays).';

drop trigger if exists update_game_location_card_layout_configs_updated_at on "arc-spirits-rev2".game_location_card_layout_configs;
create trigger update_game_location_card_layout_configs_updated_at
before update on "arc-spirits-rev2".game_location_card_layout_configs
for each row
execute function public.update_updated_at_column();

alter table "arc-spirits-rev2".game_location_card_layout_configs enable row level security;
drop policy if exists "Allow all for game_location_card_layout_configs" on "arc-spirits-rev2".game_location_card_layout_configs;
create policy "Allow all for game_location_card_layout_configs"
on "arc-spirits-rev2".game_location_card_layout_configs
for all
using (true)
with check (true);

