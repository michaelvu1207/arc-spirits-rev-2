-- Per-location compositing rows for Location Placer
-- Stores icon positions on a row, a rendered row PNG path, and row placement on the location background.

CREATE TABLE IF NOT EXISTS "arc-spirits-rev2".game_location_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES "arc-spirits-rev2".game_locations(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  type text NOT NULL CHECK (type IN ('gain', 'trade')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_image_path text NULL,
  pos_x numeric NOT NULL DEFAULT 0,
  pos_y numeric NOT NULL DEFAULT 0,
  scale numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, row_index)
);

CREATE INDEX IF NOT EXISTS game_location_rows_location_id_idx
  ON "arc-spirits-rev2".game_location_rows (location_id);

CREATE INDEX IF NOT EXISTS game_location_rows_location_id_row_index_idx
  ON "arc-spirits-rev2".game_location_rows (location_id, row_index);

-- Auto-update updated_at trigger (matching existing pattern)
DROP TRIGGER IF EXISTS update_game_location_rows_updated_at
  ON "arc-spirits-rev2".game_location_rows;

CREATE TRIGGER update_game_location_rows_updated_at
BEFORE UPDATE ON "arc-spirits-rev2".game_location_rows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Allow all operations for this data-management app
ALTER TABLE "arc-spirits-rev2".game_location_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on game_location_rows" ON "arc-spirits-rev2".game_location_rows;
CREATE POLICY "Allow all operations on game_location_rows"
ON "arc-spirits-rev2".game_location_rows
FOR ALL
USING (true)
WITH CHECK (true);

COMMENT ON TABLE "arc-spirits-rev2".game_location_rows IS
  'Per-location row compositions (icons placed onto a row background), plus row placement on the location image.';
COMMENT ON COLUMN "arc-spirits-rev2".game_location_rows.config IS
  'Row composition config (icon ids + positions).';
COMMENT ON COLUMN "arc-spirits-rev2".game_location_rows.row_image_path IS
  'Generated row image (PNG) stored in game_assets bucket.';
COMMENT ON COLUMN "arc-spirits-rev2".game_location_rows.pos_x IS
  'X position of the row image on the location background (in source pixel space).';
COMMENT ON COLUMN "arc-spirits-rev2".game_location_rows.pos_y IS
  'Y position of the row image on the location background (in source pixel space).';
COMMENT ON COLUMN "arc-spirits-rev2".game_location_rows.scale IS
  'Scale multiplier for the row image when compositing onto the location background.';

