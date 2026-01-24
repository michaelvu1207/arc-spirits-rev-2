-- Expose screenshot uploads (stored in `game_assets/screenshots/*`) via a stable view for exports.
-- This keeps export functions from querying `storage.objects` directly.

CREATE OR REPLACE VIEW "arc-spirits-rev2".screenshots_export AS
SELECT
  name AS path,
  metadata->>'mimetype' AS mimetype,
  metadata->>'size' AS size,
  updated_at
FROM storage.objects
WHERE bucket_id = 'game_assets'
  AND name LIKE 'screenshots/%';

