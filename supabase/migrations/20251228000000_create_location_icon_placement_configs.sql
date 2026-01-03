-- Store global configuration for the Location Icon Placer (row backgrounds + icon slot positions)

CREATE TABLE IF NOT EXISTS "arc-spirits-rev2".location_icon_placement_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_icon_placement_configs_name_idx
  ON "arc-spirits-rev2".location_icon_placement_configs (name);

-- Auto-update updated_at trigger (matching existing pattern)
DROP TRIGGER IF EXISTS update_location_icon_placement_configs_updated_at
  ON "arc-spirits-rev2".location_icon_placement_configs;

CREATE TRIGGER update_location_icon_placement_configs_updated_at
BEFORE UPDATE ON "arc-spirits-rev2".location_icon_placement_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Allow all operations for this data-management app
ALTER TABLE "arc-spirits-rev2".location_icon_placement_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on location_icon_placement_configs" ON "arc-spirits-rev2".location_icon_placement_configs;
CREATE POLICY "Allow all operations on location_icon_placement_configs"
ON "arc-spirits-rev2".location_icon_placement_configs
FOR ALL
USING (true)
WITH CHECK (true);

-- Ensure a default row exists
INSERT INTO "arc-spirits-rev2".location_icon_placement_configs (name, config)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE "arc-spirits-rev2".location_icon_placement_configs IS
  'Global icon placement + row background configuration for the Location Icon Placer generator.';
COMMENT ON COLUMN "arc-spirits-rev2".location_icon_placement_configs.config IS
  'JSON configuration for the location icon placer (rows, icon size, row background paths + placement).';

