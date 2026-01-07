-- Add effect_type column to special_effects table
-- Types: before_combat, during_combat, after_combat, combat_type

ALTER TABLE "arc-spirits-rev2".special_effects
ADD COLUMN IF NOT EXISTS effect_type text NOT NULL DEFAULT 'during_combat'
CHECK (effect_type IN ('before_combat', 'during_combat', 'after_combat', 'combat_type'));

COMMENT ON COLUMN "arc-spirits-rev2".special_effects.effect_type IS
  'When the effect applies: before_combat, during_combat, after_combat, or combat_type';
