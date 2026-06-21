begin;

alter table "arc-spirits-rev2".hex_spirits
	add column if not exists description text,
	add column if not exists description_translations jsonb not null default '{}'::jsonb;

comment on column "arc-spirits-rev2".hex_spirits.description is
	'Optional editor-facing description/personality notes for the spirit.';

comment on column "arc-spirits-rev2".hex_spirits.description_translations is
	'Optional localized descriptions keyed by language tag (e.g. "es", "fr-CA"). Primary value remains description.';

create table if not exists "arc-spirits-rev2".hex_spirit_art_raw_variants (
	id uuid primary key default gen_random_uuid(),
	hex_spirit_id uuid not null references "arc-spirits-rev2".hex_spirits(id) on delete cascade,
	label text not null,
	description text,
	storage_path text not null,
	source text not null default 'uploaded',
	prompt text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint hex_spirit_art_raw_variants_source_check
		check (source in ('original', 'uploaded', 'generated')),
	constraint hex_spirit_art_raw_variants_storage_path_check
		check (storage_path ~ '^hex_spirits/.+/art_raw'),
	constraint hex_spirit_art_raw_variants_label_not_empty
		check (length(btrim(label)) > 0),
	constraint hex_spirit_art_raw_variants_unique_path
		unique (hex_spirit_id, storage_path)
);

create index if not exists hex_spirit_art_raw_variants_spirit_idx
	on "arc-spirits-rev2".hex_spirit_art_raw_variants(hex_spirit_id, created_at);

comment on table "arc-spirits-rev2".hex_spirit_art_raw_variants is
	'Alternative raw art assets for hex spirits. The active raw art remains hex_spirits.art_raw_image_path.';

insert into "arc-spirits-rev2".hex_spirit_art_raw_variants (
	hex_spirit_id,
	label,
	description,
	storage_path,
	source
)
select
	id,
	'Original art raw',
	'Current art raw before variations were introduced.',
	art_raw_image_path,
	'original'
from "arc-spirits-rev2".hex_spirits
where art_raw_image_path is not null
on conflict (hex_spirit_id, storage_path) do nothing;

commit;
