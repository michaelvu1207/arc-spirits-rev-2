-- Allow monsters to optionally reference an invade location

ALTER TABLE "arc-spirits-rev2".monsters
  ADD COLUMN IF NOT EXISTS invade_location_id uuid NULL
    REFERENCES "arc-spirits-rev2".game_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS monsters_invade_location_id_idx
  ON "arc-spirits-rev2".monsters (invade_location_id);

COMMENT ON COLUMN "arc-spirits-rev2".monsters.invade_location_id IS
  'Optional location where this monster invades (FK to game_locations).';

