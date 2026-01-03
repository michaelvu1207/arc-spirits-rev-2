-- Store global configuration for the Spirit World Map Placer (background + location placements + exported image path)

CREATE TABLE IF NOT EXISTS "arc-spirits-rev2".spirit_world_map_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spirit_world_map_configs_name_idx
  ON "arc-spirits-rev2".spirit_world_map_configs (name);

-- Auto-update updated_at trigger (matching existing pattern)
DROP TRIGGER IF EXISTS update_spirit_world_map_configs_updated_at
  ON "arc-spirits-rev2".spirit_world_map_configs;

CREATE TRIGGER update_spirit_world_map_configs_updated_at
BEFORE UPDATE ON "arc-spirits-rev2".spirit_world_map_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Allow all operations for this data-management app
ALTER TABLE "arc-spirits-rev2".spirit_world_map_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on spirit_world_map_configs" ON "arc-spirits-rev2".spirit_world_map_configs;
CREATE POLICY "Allow all operations on spirit_world_map_configs"
ON "arc-spirits-rev2".spirit_world_map_configs
FOR ALL
USING (true)
WITH CHECK (true);

-- Ensure a default row exists
INSERT INTO "arc-spirits-rev2".spirit_world_map_configs (name, config)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE "arc-spirits-rev2".spirit_world_map_configs IS
  'Global config for the Spirit World map placer (background + per-location placements + export metadata).';
COMMENT ON COLUMN "arc-spirits-rev2".spirit_world_map_configs.config IS
  'JSON configuration for Spirit World map generation (background image path, placements, generated output path).';

