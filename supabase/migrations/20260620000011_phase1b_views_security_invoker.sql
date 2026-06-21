-- Phase 1b — stop the Arc-Spirits analytics views from bypassing RLS.
--
-- These views were SECURITY DEFINER (ran as owner, ignoring RLS). The public
-- stats/leaderboard pages read them with the ANON key, so to switch them to
-- security_invoker (respecting the caller's RLS) the anon role must be able to read
-- their feeder tables. Leaderboard/stats data is public-but-read-only, so we grant
-- anon SELECT on the two feeder tables that lacked it (writes stay service-role-only).
-- All other feeders (game_state_snapshots, verified_*, player_ratings) already allow
-- public read.

-- Public read for the two feeder tables that had RLS on with no policy.
grant select on "arc-spirits-game-history".game_metadata           to anon, authenticated;
grant select on "arc-spirits-game-history".player_composition_tags to anon, authenticated;
create policy "game_metadata_public_read"
  on "arc-spirits-game-history".game_metadata for select to public using (true);
create policy "player_composition_tags_public_read"
  on "arc-spirits-game-history".player_composition_tags for select to public using (true);

-- Flip every view in both Arc-Spirits schemas to security_invoker.
do $$
declare r record;
begin
  for r in
    select n.nspname, c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'v'
      and n.nspname in ('arc-spirits-rev2','arc-spirits-game-history')
  loop
    execute format('alter view %I.%I set (security_invoker = on)', r.nspname, r.relname);
  end loop;
end $$;
