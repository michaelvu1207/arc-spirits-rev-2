-- Retire the legacy monsters system. monsters_v2 is the canonical monster table
-- (the only one the game reads). The old `monsters` table, its satellite
-- `monster_special_effects`, and the /arcane-abyss editor are removed.
--
-- NOTE: this is intentional, confirmed data loss. The old `monsters` table held
-- the only real named monster content (incl. the Arcane Synthesizer boss) and was
-- referenced by scenario_deck_entries. monsters_v2 currently holds placeholder
-- rows; per the owner's decision the game stays on v2 and the old content is dropped.

-- Clear the now-orphaned monster references from scenario decks.
delete from "arc-spirits-rev2".scenario_deck_entries where monster_id is not null;

-- Drop the legacy tables.
drop table if exists "arc-spirits-rev2".monster_special_effects cascade;
drop table if exists "arc-spirits-rev2".monsters cascade;
