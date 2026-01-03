-- Allow monsters to have 0 damage and 0 barrier
-- Drop existing check constraints and recreate with >= 0

-- Drop the damage check constraint if it exists
ALTER TABLE "arc-spirits-rev2".monsters
  DROP CONSTRAINT IF EXISTS monsters_damage_check;

-- Re-add with explicit >= 0 (allows zero)
ALTER TABLE "arc-spirits-rev2".monsters
  ADD CONSTRAINT monsters_damage_check CHECK (damage >= 0);
