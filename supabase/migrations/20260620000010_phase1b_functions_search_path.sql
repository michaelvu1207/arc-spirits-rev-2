-- Phase 1b — pin search_path on Arc-Spirits functions (clears "Function Search Path
-- Mutable" advisories) and drop two orphaned functions left by removed features.
-- Trading-bot / arcwiki / system functions are out of scope and untouched.

-- Orphaned: artifacts feature + the dropped rev2 game_state_snapshots table.
drop function if exists "arc-spirits-rev2".validate_artifact_tags();
drop function if exists "arc-spirits-rev2".update_game_state_snapshots_updated_at();

-- SECURITY DEFINER, body is fully schema-qualified → safe to lock to empty search_path.
alter function "arc-spirits-game-history".upsert_game_notes(text, text, text, jsonb)
  set search_path = '';

-- Trigger / utility functions: pin to own schema + public (non-breaking; satisfies the
-- immutable-search_path lint). These run as the caller (not SECURITY DEFINER).
alter function "arc-spirits-rev2".clear_location_generated_image_on_background_change()
  set search_path = "arc-spirits-rev2", public;
alter function "arc-spirits-rev2".events_set_name_to_id()        set search_path = "arc-spirits-rev2", public;
alter function "arc-spirits-rev2".get_icon_pool_id(text)         set search_path = "arc-spirits-rev2", public;
alter function "arc-spirits-rev2".set_updated_at()               set search_path = "arc-spirits-rev2", public;
alter function "arc-spirits-rev2".simulation_settings_set_updated_at() set search_path = "arc-spirits-rev2", public;
alter function "arc-spirits-rev2".sync_class_icon()              set search_path = "arc-spirits-rev2", public;
alter function "arc-spirits-rev2".sync_dice_side_icon()          set search_path = "arc-spirits-rev2", public;
alter function "arc-spirits-rev2".sync_origin_icon()             set search_path = "arc-spirits-rev2", public;
alter function "arc-spirits-rev2".sync_uploaded_icon()           set search_path = "arc-spirits-rev2", public;
alter function "arc-spirits-rev2".sync_uploaded_icon_to_pool()   set search_path = "arc-spirits-rev2", public;

alter function "arc-spirits-game-history".compositions_set_updated_at() set search_path = "arc-spirits-game-history", public;
alter function "arc-spirits-game-history".normalize_tts_username(text)  set search_path = "arc-spirits-game-history", public;
alter function "arc-spirits-game-history".play_touch_updated_at()       set search_path = "arc-spirits-game-history", public;
