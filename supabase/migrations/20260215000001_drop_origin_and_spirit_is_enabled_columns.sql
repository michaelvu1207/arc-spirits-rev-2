-- Remove legacy in-row enable flags now that disabled state is sourced from dedicated tables.

drop index if exists "arc-spirits-rev2".origins_is_enabled_idx;
drop index if exists "arc-spirits-rev2".hex_spirits_is_enabled_idx;

alter table "arc-spirits-rev2".origins
	drop column if exists is_enabled;

alter table "arc-spirits-rev2".hex_spirits
	drop column if exists is_enabled;
