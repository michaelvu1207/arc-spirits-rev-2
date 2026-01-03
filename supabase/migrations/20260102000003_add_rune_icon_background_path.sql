-- Add optional per-rune background image path used for rune icon generation.
alter table if exists "arc-spirits-rev2".runes
add column if not exists icon_background_path text;

comment on column "arc-spirits-rev2".runes.icon_background_path is
  'Optional background image path in game_assets used when generating rune icons.';
