-- Phase 2 — de-hyphenate the schema names:
--   arc-spirits-rev2          -> arc_spirits_assets
--   arc-spirits-game-history  -> arc_spirits_game
--
-- IMPORTANT cutover notes (this migration is one part of a coordinated release):
--   * Postgres does NOT rewrite function bodies or their SET search_path values on
--     ALTER SCHEMA RENAME, so every function that hardcodes the old schema names would
--     break. The DO block below recreates each such function with the new names (bodies
--     + search_path), discovered dynamically so none are missed. CREATE OR REPLACE
--     preserves ownership and grants.
--   * Views, RLS policies, triggers, FKs, defaults are OID-based and survive the rename.
--   * After applying this, the PostgREST "Exposed schemas" project setting must be updated
--     to the new names, and the apps + edge functions redeployed with the new names.

alter schema "arc-spirits-rev2"         rename to arc_spirits_assets;
alter schema "arc-spirits-game-history" rename to arc_spirits_game;

-- Rewrite every function still referencing the old schema names (body and/or search_path).
do $$
declare
  r record;
  newdef text;
begin
  for r in
    select p.oid
    from pg_proc p
    where p.prokind = 'f'
      and (
        pg_get_functiondef(p.oid) ~ 'arc-spirits-rev2|arc-spirits-game-history'
        or array_to_string(coalesce(p.proconfig, '{}'), ',') ~ 'arc-spirits-rev2|arc-spirits-game-history'
      )
  loop
    newdef := pg_get_functiondef(r.oid);
    newdef := replace(newdef, 'arc-spirits-game-history', 'arc_spirits_game');
    newdef := replace(newdef, 'arc-spirits-rev2', 'arc_spirits_assets');
    execute newdef;
  end loop;
end $$;
