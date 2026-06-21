-- Phase 1a — enable Row Level Security on the Arc-Spirits tables that had it OFF
-- (the critical "RLS disabled / data wide open" advisories). Scoped to Arc Spirits only;
-- the trading-bot and arcwiki tables are intentionally left untouched.
--
-- Model (owner decision = "Option C"):
--   * ASSETS schema (arc-spirits-rev2): RLS on + permissive anon/authenticated read+write
--     policy. The rev-2 editor writes with the anon key and has no login, so writes stay
--     open at the DB level; protection is the rev-2 deployment being private. (Residual
--     risk documented in DB_PRODUCTION_READINESS_PLAN.md — upgradeable to admin-gated later.)
--   * GAME-HISTORY service-only tables: RLS on with NO policy → anon/authenticated are
--     denied; the play server (service role) bypasses RLS, so writes keep working. These
--     are not read by the anon client (server-mediated), so nothing client-facing breaks.

-- Assets: enable RLS + permissive policy on the tables that were unprotected.
do $$
declare t text;
begin
  foreach t in array array[
    'card_layout_configs','classes','custom_dice','dice_sides','dice_templates',
    'disabled_hex_spirits','disabled_origins','edition_scenarios','event_cards',
    'game_locations','guardians','hex_spirit_art_raw_variants','hex_spirit_quantity_rarity',
    'hex_spirits','icon_pool','mat_items','monsters_v2','origins','rarity_traits',
    'scenario_cards','scenario_deck_entries','scenarios','simulation_settings',
    'special_effects','stage_completion_cards','stage_dividers','three_d_models','ui_settings'
  ] loop
    execute format('alter table %I.%I enable row level security', 'arc-spirits-rev2', t);
    execute format('drop policy if exists %I on %I.%I', t || '_anon_all', 'arc-spirits-rev2', t);
    execute format(
      'create policy %I on %I.%I for all to anon, authenticated using (true) with check (true)',
      t || '_anon_all', 'arc-spirits-rev2', t);
  end loop;
end $$;

-- Game-history service-only tables: RLS on, no policy (service role bypasses).
alter table "arc-spirits-game-history".compositions            enable row level security;
alter table "arc-spirits-game-history".game_metadata           enable row level security;
alter table "arc-spirits-game-history".player_composition_tags enable row level security;
alter table "arc-spirits-game-history".replay_codes            enable row level security;
