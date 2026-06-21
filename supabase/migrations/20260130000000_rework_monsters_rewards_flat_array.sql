-- Snapshot current monsters table, then replace the reward/damage track with a single ordered reward icon list.
-- Date: 2026-01-30

-- 1) Backup current data (snapshot copy)
create table if not exists "arc-spirits-rev2".monsters_backup_20260130 as
select * from "arc-spirits-rev2".monsters;

comment on table "arc-spirits-rev2".monsters_backup_20260130 is
  'Snapshot of arc-spirits-rev2.monsters taken on 2026-01-30 before reward track removal.';

-- 2) New canonical rewards column (ordered; icon_pool IDs; unlimited length)
alter table "arc-spirits-rev2".monsters
  add column if not exists reward_icon_ids uuid[] not null default '{}'::uuid[];

comment on column "arc-spirits-rev2".monsters.reward_icon_ids is
  'Flattened ordered reward icons (icon_pool UUIDs). Backfilled from reward_track + legacy reward_icons + reward_rows.';

-- 3) Backfill reward_icon_ids by flattening all legacy reward sources
with
  track as (
    select
      m.id,
      array_agg(e.elem::uuid order by s.slot_ord, e.elem_ord)
        filter (where e.elem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as icons
    from "arc-spirits-rev2".monsters m
    left join lateral jsonb_array_elements(coalesce(m.reward_track, '[]'::jsonb)) with ordinality s(slot, slot_ord)
      on true
    left join lateral jsonb_array_elements_text(coalesce(s.slot, '[]'::jsonb)) with ordinality e(elem, elem_ord)
      on true
    group by m.id
  ),
  rows as (
    select
      m.id,
      array_agg(i.icon::uuid order by r.row_ord, i.icon_ord)
        filter (where i.icon ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as icons
    from "arc-spirits-rev2".monsters m
    left join lateral jsonb_array_elements(coalesce(m.reward_rows, '[]'::jsonb)) with ordinality r(row, row_ord)
      on true
    left join lateral jsonb_array_elements_text(coalesce(r.row->'icon_ids', '[]'::jsonb)) with ordinality i(icon, icon_ord)
      on true
    group by m.id
  ),
  merged as (
    select
      m.id,
      coalesce(t.icons, '{}'::uuid[])
      || coalesce(m.reward_icons, '{}'::uuid[])
      || coalesce(r.icons, '{}'::uuid[]) as reward_icon_ids
    from "arc-spirits-rev2".monsters m
    left join track t on t.id = m.id
    left join rows r on r.id = m.id
  )
update "arc-spirits-rev2".monsters m
set reward_icon_ids = merged.reward_icon_ids
from merged
where merged.id = m.id;

-- 4) Drop legacy reward/track columns
alter table "arc-spirits-rev2".monsters
  drop column if exists reward_track,
  drop column if exists reward_rows,
  drop column if exists reward_icons,
  drop column if exists reward_header_type,
  drop column if exists show_tutorial,
  drop column if exists barrier_icon_ids;
