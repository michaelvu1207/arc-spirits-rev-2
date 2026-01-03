-- Allow text-only location rows (in addition to gain/trade).

ALTER TABLE "arc-spirits-rev2".game_location_rows
  DROP CONSTRAINT IF EXISTS game_location_rows_type_check;

ALTER TABLE "arc-spirits-rev2".game_location_rows
  ADD CONSTRAINT game_location_rows_type_check CHECK (type IN ('gain', 'trade', 'text'));

