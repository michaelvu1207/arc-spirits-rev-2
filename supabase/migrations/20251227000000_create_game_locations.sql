-- Create game_locations table
-- Locations can optionally be associated with an origin and have reward rows
-- Reward rows store icon_pool IDs in the shape: [{ "icon_ids": ["uuid", ...] }, ...]

CREATE TABLE IF NOT EXISTS "arc-spirits-rev2".game_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  origin_id uuid NULL REFERENCES "arc-spirits-rev2".origins(id) ON DELETE SET NULL,
  reward_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_locations_name_idx
  ON "arc-spirits-rev2".game_locations (name);

CREATE INDEX IF NOT EXISTS game_locations_origin_id_idx
  ON "arc-spirits-rev2".game_locations (origin_id);

-- Auto-update updated_at trigger (matching existing pattern)
DROP TRIGGER IF EXISTS update_game_locations_updated_at
  ON "arc-spirits-rev2".game_locations;

CREATE TRIGGER update_game_locations_updated_at
BEFORE UPDATE ON "arc-spirits-rev2".game_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE "arc-spirits-rev2".game_locations IS
  'Game locations with optional origin association and icon-based reward rows';
COMMENT ON COLUMN "arc-spirits-rev2".game_locations.reward_rows IS
  'JSON array of reward rows, each with icon_ids referencing icon_pool IDs';
