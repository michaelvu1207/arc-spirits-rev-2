-- Phase 2 cleanup: drop verified-dead legacy tables and leftover artifact analytics.
--
-- Dead public tables (0 code refs; superseded by arc-spirits-game-history.play_* and the
-- rev2 catalog). game_events has an FK to game_sessions, so it is dropped first.
--   * public.game_events / public.game_sessions  — legacy pre-rev2 play tracking
--   * public.player_stats                         — legacy, superseded by *_verified views
--   * public.dice_roll_history                    — empty experiment
--
-- Artifact feature was removed; these two leaf analytics views are its last remnants
-- (nothing depends on them). The game_state_snapshots.guardian_artifacts column is
-- ALSO referenced by 5 non-artifact analytics views, so it is handled in the later
-- analytics-view/security pass, not here.

drop view if exists "arc-spirits-game-history".artifact_occurrences_verified;
drop view if exists "arc-spirits-game-history".artifact_stats_verified;

drop table if exists public.game_events;
drop table if exists public.game_sessions;
drop table if exists public.player_stats;
drop table if exists public.dice_roll_history;
