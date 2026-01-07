-- Rename Locations Guide -> Icon Guide (manual-only pin tag)

alter table "arc-spirits-rev2".icon_pool
  rename column location_guide_position to icon_guide_position;

comment on column "arc-spirits-rev2".icon_pool.icon_guide_position is
  'Optional manual ordering index for Icon Guide. Lower values appear first.';

-- Migrate any pinned tags from the old name to the new name
update "arc-spirits-rev2".icon_pool
set tags = array_remove(tags, 'location_guide')
where tags is not null
  and 'location_guide' = any(tags)
  and 'icon_guide' = any(tags);

update "arc-spirits-rev2".icon_pool
set tags = array_append(array_remove(tags, 'location_guide'), 'icon_guide')
where tags is not null
  and 'location_guide' = any(tags)
  and not ('icon_guide' = any(tags));

