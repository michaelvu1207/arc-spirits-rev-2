-- Add base game print path for monster cards
-- This mirrors the hex spirits workflow (base print vs generated print).
-- Date: 2026-01-30

alter table "arc-spirits-rev2".monsters
  add column if not exists card_base_image_path text;

comment on column "arc-spirits-rev2".monsters.card_base_image_path is
  'Uploaded base monster card game print (no overlays). Used as input for the layout placer generator.';

