-- Remove the deprecated Artifacts feature.
--
-- Artifacts were cards that cost runes/relics to activate — a mechanic that is no
-- longer part of the game. This drops the artifact schema entirely. Relics, runes,
-- guardians, classes, origins, spirit augments, and reward-row tags are SEPARATE,
-- current concepts and are intentionally left untouched.
--
-- FK note: the only foreign keys involving these tables are OUTGOING
-- (artifacts.guardian_id -> guardians, artifacts.template_id -> artifact_templates).
-- No other table references them, so CASCADE only removes each table's own
-- constraints/policies — nothing outside the artifact feature.
--
-- Storage: the ~463 artifact card image files under the game_assets bucket are NOT
-- deleted here (uploaded assets); they become orphaned and can be purged separately.

drop table if exists "arc-spirits-rev2".artifacts cascade;
drop table if exists "arc-spirits-rev2".artifact_templates cascade;
drop table if exists "arc-spirits-rev2".artifact_tags cascade;
