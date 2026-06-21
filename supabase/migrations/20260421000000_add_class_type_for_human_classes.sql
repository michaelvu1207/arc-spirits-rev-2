alter table "arc-spirits-rev2".classes
  add column if not exists class_type text not null default 'normal';

alter table "arc-spirits-rev2".classes
  drop constraint if exists classes_class_type_check;

update "arc-spirits-rev2".classes
set class_type = case
  when is_special then 'special'
  when class_type in ('normal', 'special', 'human') then class_type
  else 'normal'
end;

with human_origin as (
  select id
  from "arc-spirits-rev2".origins
  where lower(name) like '%human%'
),
human_classes as (
  select distinct c.id
  from "arc-spirits-rev2".hex_spirits hs
  join lateral jsonb_array_elements_text(coalesce(hs.traits->'origin_ids', '[]'::jsonb)) oid(origin_id) on true
  join human_origin ho on ho.id = oid.origin_id::uuid
  join lateral jsonb_array_elements_text(coalesce(hs.traits->'class_ids', '[]'::jsonb)) cid(class_id) on true
  join "arc-spirits-rev2".classes c on c.id = cid.class_id::uuid
)
update "arc-spirits-rev2".classes c
set class_type = 'human',
    is_special = false,
    updated_at = now()
from human_classes h
where c.id = h.id;

update "arc-spirits-rev2".classes
set is_special = (class_type = 'special');

alter table "arc-spirits-rev2".classes
  add constraint classes_class_type_check
  check (class_type in ('normal', 'special', 'human'));

comment on column "arc-spirits-rev2".classes.class_type is
  'Display/behavior category for classes: normal, special, or human. Special classes mirror is_special=true for legacy code; human classes are separate but not special.';
