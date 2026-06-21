-- Grant the standard Supabase API-role privileges on the new arc_spirits_2d schema.
-- A schema created via SQL (vs the dashboard "Exposed schemas" flow) gets no role grants,
-- so PostgREST returned "permission denied for schema arc_spirits_2d". Mirror the grant
-- pattern used by arc_spirits_game: anon/authenticated SELECT, service_role full. RLS on
-- the play tables (enabled, no policy) remains the real gate, so they stay service-role-only.

grant usage on schema arc_spirits_2d to anon, authenticated, service_role;

grant select on all tables in schema arc_spirits_2d to anon, authenticated;
grant all    on all tables in schema arc_spirits_2d to service_role;

-- Future tables in this schema (e.g. ranked/matchmaking) inherit the same pattern.
alter default privileges in schema arc_spirits_2d grant select on tables to anon, authenticated;
alter default privileges in schema arc_spirits_2d grant all    on tables to service_role;
