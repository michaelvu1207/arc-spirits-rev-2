-- Add background + generated image paths to game_locations

ALTER TABLE "arc-spirits-rev2".game_locations
  ADD COLUMN IF NOT EXISTS background_image_path text NULL;

ALTER TABLE "arc-spirits-rev2".game_locations
  ADD COLUMN IF NOT EXISTS image_with_icons_path text NULL;

COMMENT ON COLUMN "arc-spirits-rev2".game_locations.background_image_path IS
  'Base/background image for the location (no reward icons). Stored in game_assets bucket.';

COMMENT ON COLUMN "arc-spirits-rev2".game_locations.image_with_icons_path IS
  'Generated location image with reward icons composited on top. Stored in game_assets bucket.';

