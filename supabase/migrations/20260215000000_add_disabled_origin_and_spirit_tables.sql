-- Track disabled origins and spirits in dedicated tables instead of in-place booleans.
-- Existing code continues to read from this table as the source of truth for enabled state.

create table if not exists "arc-spirits-rev2".disabled_origins (
	origin_id uuid not null primary key references "arc-spirits-rev2".origins(id) on delete cascade,
	reason text not null default 'manual',
	disabled_at timestamptz not null default now()
);

create index if not exists disabled_origins_reason_idx
	on "arc-spirits-rev2".disabled_origins (reason);

create table if not exists "arc-spirits-rev2".disabled_hex_spirits (
	hex_spirit_id uuid not null references "arc-spirits-rev2".hex_spirits(id) on delete cascade,
	context_origin_id uuid null references "arc-spirits-rev2".origins(id) on delete cascade,
	reason text not null,
	disabled_at timestamptz not null default now(),
	primary key (hex_spirit_id, reason)
);

create index if not exists disabled_hex_spirits_reason_idx
	on "arc-spirits-rev2".disabled_hex_spirits (reason);

create index if not exists disabled_hex_spirits_context_origin_id_idx
	on "arc-spirits-rev2".disabled_hex_spirits (context_origin_id)
	where context_origin_id is not null;

-- Backfill legacy disabled flags so behavior stays the same in environments
-- that still have is_enabled columns on core tables.
do $$
begin
	if exists (
		select 1
		from information_schema.columns
		where table_schema = 'arc-spirits-rev2'
			and table_name = 'origins'
			and column_name = 'is_enabled'
	) then
		insert into "arc-spirits-rev2".disabled_origins (origin_id, reason)
		select id, 'legacy_is_enabled_false'
		from "arc-spirits-rev2".origins
		where is_enabled = false
		on conflict (origin_id) do nothing;
	end if;

	if exists (
		select 1
		from information_schema.columns
		where table_schema = 'arc-spirits-rev2'
			and table_name = 'hex_spirits'
			and column_name = 'is_enabled'
	) then
		insert into "arc-spirits-rev2".disabled_hex_spirits (hex_spirit_id, reason)
		select id, 'legacy_is_enabled_false'
		from "arc-spirits-rev2".hex_spirits
		where is_enabled = false
		on conflict (hex_spirit_id, reason) do nothing;
	end if;
end $$;
