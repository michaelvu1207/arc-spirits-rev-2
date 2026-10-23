-- User-defined tags for grouping spirits in the data editor gallery.

create table if not exists arc_spirits_assets.hex_spirit_gallery_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#f97316',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hex_spirit_gallery_tags_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists hex_spirit_gallery_tags_name_unique_idx
  on arc_spirits_assets.hex_spirit_gallery_tags (lower(btrim(name)));

create table if not exists arc_spirits_assets.hex_spirit_gallery_tag_assignments (
  tag_id uuid not null references arc_spirits_assets.hex_spirit_gallery_tags(id) on delete cascade,
  hex_spirit_id uuid not null references arc_spirits_assets.hex_spirits(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tag_id, hex_spirit_id)
);

create index if not exists hex_spirit_gallery_tag_assignments_spirit_idx
  on arc_spirits_assets.hex_spirit_gallery_tag_assignments (hex_spirit_id);

drop trigger if exists update_hex_spirit_gallery_tags_updated_at
  on arc_spirits_assets.hex_spirit_gallery_tags;

create trigger update_hex_spirit_gallery_tags_updated_at
before update on arc_spirits_assets.hex_spirit_gallery_tags
for each row
execute function public.update_updated_at_column();

alter table arc_spirits_assets.hex_spirit_gallery_tags enable row level security;
alter table arc_spirits_assets.hex_spirit_gallery_tag_assignments enable row level security;

drop policy if exists hex_spirit_gallery_tags_anon_all
  on arc_spirits_assets.hex_spirit_gallery_tags;
create policy hex_spirit_gallery_tags_anon_all
  on arc_spirits_assets.hex_spirit_gallery_tags
  for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists hex_spirit_gallery_tag_assignments_anon_all
  on arc_spirits_assets.hex_spirit_gallery_tag_assignments;
create policy hex_spirit_gallery_tag_assignments_anon_all
  on arc_spirits_assets.hex_spirit_gallery_tag_assignments
  for all to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete
  on arc_spirits_assets.hex_spirit_gallery_tags
  to anon, authenticated, service_role;

grant select, insert, update, delete
  on arc_spirits_assets.hex_spirit_gallery_tag_assignments
  to anon, authenticated, service_role;

comment on table arc_spirits_assets.hex_spirit_gallery_tags is
  'User-defined labels for grouping spirits in gallery cards such as Arcane Abyss.';

comment on table arc_spirits_assets.hex_spirit_gallery_tag_assignments is
  'Many-to-many assignments between gallery tags and hex spirits.';
