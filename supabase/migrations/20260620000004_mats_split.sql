-- Separate runes / relics / spirit augments at the data layer.
--
-- The single `runes` table held three distinct concepts, told apart only by which
-- FK was set (class_id => augment, else origin_id => rune, else relic). We make the
-- catalog explicit:
--   * rename runes -> mat_items
--   * add an explicit `kind` column ('rune' | 'relic') instead of inferring it
--   * spirit augments are no longer catalog rows — they are derived from the 6 augment
--     CLASSES (see spectate src/lib/play/augments.ts), so every class-linked row is
--     removed and the now-unused class_id column is dropped.
--
-- Verified before writing: none of the class-linked (augment) row ids are referenced
-- by hex_spirits.awaken_condition or game_location_rows.config.

alter table "arc-spirits-rev2".runes rename to mat_items;

alter table "arc-spirits-rev2".mat_items add column kind text;

-- Relics: the no-FK token rows (Fairy Rune, Firecracker, Flower, Magnet, Teapot) and
-- the "Any Relic" wildcard (which has origin_id = Lost but is conceptually a relic —
-- this also fixes the latent mis-classification of that wildcard as a rune).
update "arc-spirits-rev2".mat_items
   set kind = 'relic'
 where (origin_id is null and class_id is null)
    or name = 'Any Relic';

-- Everything else remaining is a rune (origin runes + the "Any Rune" wildcard).
update "arc-spirits-rev2".mat_items
   set kind = 'rune'
 where kind is null and class_id is null;

-- Drop the class-linked (augment) rows — augments are now class-derived.
delete from "arc-spirits-rev2".mat_items where class_id is not null;

alter table "arc-spirits-rev2".mat_items alter column kind set not null;
alter table "arc-spirits-rev2".mat_items add constraint mat_items_kind_check
  check (kind in ('rune', 'relic'));

-- class_id is no longer meaningful for the mat catalog.
alter table "arc-spirits-rev2".mat_items drop column class_id;
