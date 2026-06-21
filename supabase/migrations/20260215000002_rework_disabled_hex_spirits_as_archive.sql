-- Convert disabled_hex_spirits from marker rows into a full spirit archive table.
-- Enabled spirits live in hex_spirits; disabled spirits live in disabled_hex_spirits.

do $$
begin
	if exists (
		select 1
		from information_schema.tables
		where table_schema = 'arc-spirits-rev2'
			and table_name = 'disabled_hex_spirits'
	)
	and exists (
		select 1
		from information_schema.columns
		where table_schema = 'arc-spirits-rev2'
			and table_name = 'disabled_hex_spirits'
			and column_name = 'hex_spirit_id'
	)
	and not exists (
		select 1
		from information_schema.tables
		where table_schema = 'arc-spirits-rev2'
			and table_name = 'disabled_hex_spirits_legacy_markers'
	) then
		alter table "arc-spirits-rev2".disabled_hex_spirits
			rename to disabled_hex_spirits_legacy_markers;
	end if;
end $$;

create table if not exists "arc-spirits-rev2".disabled_hex_spirits (
	like "arc-spirits-rev2".hex_spirits including defaults including constraints including generated including identity
);

do $$
begin
	if not exists (
		select 1
		from pg_constraint c
		join pg_class t on t.oid = c.conrelid
		join pg_namespace n on n.oid = t.relnamespace
		where n.nspname = 'arc-spirits-rev2'
			and t.relname = 'disabled_hex_spirits'
			and c.contype = 'p'
	) then
		alter table "arc-spirits-rev2".disabled_hex_spirits
			add constraint disabled_hex_spirits_archive_pkey primary key (id);
	end if;
end $$;

alter table "arc-spirits-rev2".disabled_hex_spirits
	add column if not exists disabled_at timestamptz not null default now();

alter table "arc-spirits-rev2".disabled_hex_spirits
	add column if not exists disabled_origin_id uuid null
		references "arc-spirits-rev2".origins(id) on delete set null;

create index if not exists disabled_hex_spirits_disabled_origin_id_idx
	on "arc-spirits-rev2".disabled_hex_spirits (disabled_origin_id)
	where disabled_origin_id is not null;

do $$
begin
	if exists (
		select 1
		from information_schema.tables
		where table_schema = 'arc-spirits-rev2'
			and table_name = 'disabled_hex_spirits_legacy_markers'
	) then
		create temporary table if not exists _latest_disabled_hex_spirit_markers (
			hex_spirit_id uuid primary key,
			disabled_at timestamptz,
			disabled_origin_id uuid
		) on commit drop;

		truncate table _latest_disabled_hex_spirit_markers;

		insert into _latest_disabled_hex_spirit_markers (hex_spirit_id, disabled_at, disabled_origin_id)
		select distinct on (m.hex_spirit_id)
			m.hex_spirit_id,
			m.disabled_at,
			case
				when coalesce(m.reason, '') ~* '^origin:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
					then substring(m.reason from 8)::uuid
				else null
			end as disabled_origin_id
		from "arc-spirits-rev2".disabled_hex_spirits_legacy_markers m
		order by m.hex_spirit_id, m.disabled_at desc nulls last;

		insert into "arc-spirits-rev2".disabled_hex_spirits
		select
			hs.*,
			coalesce(lm.disabled_at, now()) as disabled_at,
			lm.disabled_origin_id
		from "arc-spirits-rev2".hex_spirits hs
		join _latest_disabled_hex_spirit_markers lm on lm.hex_spirit_id = hs.id
		where not exists (
			select 1
			from "arc-spirits-rev2".disabled_hex_spirits d
			where d.id = hs.id
		);

		update "arc-spirits-rev2".disabled_hex_spirits d
		set
			disabled_at = coalesce(lm.disabled_at, d.disabled_at, now()),
			disabled_origin_id = lm.disabled_origin_id
		from _latest_disabled_hex_spirit_markers lm
		where d.id = lm.hex_spirit_id;

		delete from "arc-spirits-rev2".hex_spirits hs
		where hs.id in (select hex_spirit_id from _latest_disabled_hex_spirit_markers);
	end if;
end $$;
