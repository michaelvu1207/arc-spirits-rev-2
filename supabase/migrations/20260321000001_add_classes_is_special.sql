-- Add is_special boolean column to classes
ALTER TABLE "arc-spirits-rev2".classes
  ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false;

-- Set all classes to special EXCEPT the listed ones
UPDATE "arc-spirits-rev2".classes
  SET is_special = true
  WHERE lower(name) NOT IN (
    'defender',
    'healer',
    'father',
    'elementalist',
    'soul weaver',
    'her spirit',
    'wild beast'
  );
