-- Separate the live 2D game engine from the (now-frozen) TTS stats archive by moving
-- the play tables to their own schema `arc_spirits_2d`. The TTS/stats data stays in
-- arc_spirits_game. Future ranked/rating tables for the 2D game will live here too.
--
-- Safe move: verified no function body or cross-schema FK references these tables by
-- name, so SET SCHEMA carries data + indexes + triggers + RLS + intra-group FKs intact.
-- (The play trigger functions stay in arc_spirits_game; triggers reference them by OID
-- and their bodies don't name the moved tables, so they keep firing correctly.)
--
-- COORDINATED CUTOVER: after this, `arc_spirits_2d` must be added to the project's
-- "Exposed schemas" (Settings → API) and spectate redeployed with PLAY_SCHEMA pointing
-- here, or the play engine (service role via PostgREST) can't reach these tables.

create schema if not exists arc_spirits_2d;

alter table arc_spirits_game.play_game_sessions       set schema arc_spirits_2d;
alter table arc_spirits_game.play_session_members     set schema arc_spirits_2d;
alter table arc_spirits_game.play_game_session_events set schema arc_spirits_2d;
