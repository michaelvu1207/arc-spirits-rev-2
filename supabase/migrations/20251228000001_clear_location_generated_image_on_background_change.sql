-- Clear generated location image when the base background changes.
-- This prevents stale `image_with_icons_path` values from showing old renders after a background replacement.

CREATE OR REPLACE FUNCTION "arc-spirits-rev2".clear_location_generated_image_on_background_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.background_image_path IS DISTINCT FROM OLD.background_image_path THEN
    NEW.image_with_icons_path := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_location_generated_image_on_background_change
  ON "arc-spirits-rev2".game_locations;

CREATE TRIGGER clear_location_generated_image_on_background_change
BEFORE UPDATE OF background_image_path ON "arc-spirits-rev2".game_locations
FOR EACH ROW
EXECUTE FUNCTION "arc-spirits-rev2".clear_location_generated_image_on_background_change();

