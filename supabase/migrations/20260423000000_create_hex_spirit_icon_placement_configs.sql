-- Hex spirit icon placement configuration (front + back)
-- Stores the draggable icon/text slot coordinates used by the HexSpirit icon placer.

create table if not exists "arc-spirits-rev2".hex_spirit_icon_placement_configs (
  key text primary key,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table "arc-spirits-rev2".hex_spirit_icon_placement_configs is
  'Saved placement configs for HexSpirit front/back icon placer slots.';

comment on column "arc-spirits-rev2".hex_spirit_icon_placement_configs.key is
  'Stable config key, currently front or back.';

comment on column "arc-spirits-rev2".hex_spirit_icon_placement_configs.config is
  'JSON icon placement config. Front stores tiered origin/class slots; back stores rune, text, and special-class slots.';

drop trigger if exists update_hex_spirit_icon_placement_configs_updated_at
  on "arc-spirits-rev2".hex_spirit_icon_placement_configs;

create trigger update_hex_spirit_icon_placement_configs_updated_at
before update on "arc-spirits-rev2".hex_spirit_icon_placement_configs
for each row
execute function public.update_updated_at_column();

alter table "arc-spirits-rev2".hex_spirit_icon_placement_configs enable row level security;

drop policy if exists "Allow all for hex_spirit_icon_placement_configs"
  on "arc-spirits-rev2".hex_spirit_icon_placement_configs;

create policy "Allow all for hex_spirit_icon_placement_configs"
on "arc-spirits-rev2".hex_spirit_icon_placement_configs
for all
using (true)
with check (true);

insert into "arc-spirits-rev2".hex_spirit_icon_placement_configs (key, config)
values
  ('front', '{}'::jsonb),
  ('back', '{}'::jsonb)
on conflict (key) do nothing;
