-- Enable/disable origins globally and expose disabled origins in their own sections

alter table "arc-spirits-rev2".origins
	add column if not exists is_enabled boolean;

update "arc-spirits-rev2".origins
	set is_enabled = true
	where is_enabled is null;

alter table "arc-spirits-rev2".origins
	alter column is_enabled set default true;

alter table "arc-spirits-rev2".origins
	alter column is_enabled set not null;

create index if not exists origins_is_enabled_idx
	on "arc-spirits-rev2".origins (is_enabled);
