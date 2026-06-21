begin;

alter table "arc-spirits-rev2".hex_spirit_art_raw_variants
	add column if not exists game_print_no_icons_path text,
	add column if not exists game_print_image_path text,
	add column if not exists back_side_base_path text,
	add column if not exists back_side_export_path text,
	add column if not exists tts_combined_image_path text,
	add column if not exists is_variation_selected boolean not null default false,
	add column if not exists pipeline_status text,
	add column if not exists pipeline_error text;

create unique index if not exists hex_spirit_art_raw_variants_one_selected_per_spirit
	on "arc-spirits-rev2".hex_spirit_art_raw_variants(hex_spirit_id)
	where is_variation_selected;

comment on column "arc-spirits-rev2".hex_spirit_art_raw_variants.game_print_no_icons_path is
	'Variation-specific front source / no-icons game print path.';
comment on column "arc-spirits-rev2".hex_spirit_art_raw_variants.game_print_image_path is
	'Variation-specific final front game print path.';
comment on column "arc-spirits-rev2".hex_spirit_art_raw_variants.back_side_base_path is
	'Variation-specific back-side base image path.';
comment on column "arc-spirits-rev2".hex_spirit_art_raw_variants.back_side_export_path is
	'Variation-specific final back-side export path.';
comment on column "arc-spirits-rev2".hex_spirit_art_raw_variants.tts_combined_image_path is
	'Variation-specific combined front/back TTS texture path.';
comment on column "arc-spirits-rev2".hex_spirit_art_raw_variants.is_variation_selected is
	'Whether this variant is the selected variation source for its parent spirit.';
comment on column "arc-spirits-rev2".hex_spirit_art_raw_variants.pipeline_status is
	'Last variation pipeline status for this variant.';
comment on column "arc-spirits-rev2".hex_spirit_art_raw_variants.pipeline_error is
	'Last variation pipeline error message, if any.';

commit;
