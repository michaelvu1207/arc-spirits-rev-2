-- Add event_type column to events table
-- Types: opening, stage_1, stage_2, stage_3, stage_4, finale

ALTER TABLE "arc-spirits-rev2".events
ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'stage_1'
CHECK (event_type IN ('opening', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'finale'));

COMMENT ON COLUMN "arc-spirits-rev2".events.event_type IS
  'Narrative stage for the event: opening, stage_1..stage_4, or finale';

