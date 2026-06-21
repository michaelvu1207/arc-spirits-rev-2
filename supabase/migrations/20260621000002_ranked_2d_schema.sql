-- Ranked 2D foundation (lives in arc_spirits_2d, the live-game schema).
-- Adds: session mode (casual|ranked), canonical match results, OpenSkill ratings keyed
-- on authenticated user_id, rating history, and the matchmaking queue. Ratings are a
-- NEW, user_id-keyed system for the 2D game (separate from the frozen TTS username-keyed
-- ratings in arc_spirits_game). Writes are service-role only (RLS gate); leaderboard/
-- results are public-read; the queue is server-only.

-- 1) Casual vs ranked on a session.
alter table arc_spirits_2d.play_game_sessions
  add column if not exists mode text not null default 'casual';
alter table arc_spirits_2d.play_game_sessions
  drop constraint if exists play_game_sessions_mode_check;
alter table arc_spirits_2d.play_game_sessions
  add constraint play_game_sessions_mode_check check (mode in ('casual', 'ranked'));

-- 2) One row per finished game (canonical 2D result).
create table if not exists arc_spirits_2d.match_results (
  session_id        uuid primary key references arc_spirits_2d.play_game_sessions(id) on delete cascade,
  game_id           text,
  mode              text not null,
  ranked            boolean not null default false,
  rated             boolean not null default false,
  winner_seat       text,
  player_count      integer not null,
  navigation_count  integer not null default 0,
  started_at        timestamptz,
  ended_at          timestamptz not null,
  rating_version    integer not null default 1,
  created_at        timestamptz not null default now()
);

-- 3) Per-seat final standings (humans + bots; user_id null for guests/bots).
create table if not exists arc_spirits_2d.match_result_players (
  session_id      uuid not null references arc_spirits_2d.match_results(session_id) on delete cascade,
  seat_color      text not null,
  member_id       uuid,
  user_id         uuid,
  display_name    text,
  is_bot          boolean not null default false,
  victory_points  integer not null default 0,
  placement       integer not null,
  created_at      timestamptz not null default now(),
  primary key (session_id, seat_color)
);

-- 4) Live 2D ratings, keyed on authenticated user_id (OpenSkill mu/sigma).
create table if not exists arc_spirits_2d.player_ratings (
  user_id         uuid primary key,
  display_name    text,
  mu              double precision not null,
  sigma           double precision not null,
  games_played    integer not null default 0,
  last_session_id uuid,
  last_game_at    timestamptz,
  rating_version  integer not null default 1,
  updated_at      timestamptz not null default now()
);

-- 5) Rating change history (audit / recompute).
create table if not exists arc_spirits_2d.player_rating_events (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null,
  user_id       uuid not null,
  placement     integer not null,
  mu_before     double precision not null,
  sigma_before  double precision not null,
  mu_after      double precision not null,
  sigma_after   double precision not null,
  rating_version integer not null default 1,
  created_at    timestamptz not null default now()
);

-- 6) Matchmaking queue (server-only).
create table if not exists arc_spirits_2d.match_queue (
  user_id            uuid primary key,
  display_name       text,
  mu                 double precision not null,
  sigma              double precision not null,
  ordinal            double precision not null,   -- conservative rating (mu - k*sigma) for pairing
  party_size         integer not null default 1,
  status             text not null default 'queued',  -- queued|matched|cancelled
  claimed_session_id uuid,
  queued_at          timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists match_result_players_user_idx on arc_spirits_2d.match_result_players (user_id);
create index if not exists player_rating_events_user_idx on arc_spirits_2d.player_rating_events (user_id, created_at);
create index if not exists match_queue_status_ordinal_idx on arc_spirits_2d.match_queue (status, ordinal);
create index if not exists player_ratings_mu_idx on arc_spirits_2d.player_ratings (mu desc);

-- RLS: enable on all; service role bypasses (does the writes). Leaderboard/results are
-- public game features -> anon read. Queue has NO anon policy (server-mediated only).
alter table arc_spirits_2d.match_results          enable row level security;
alter table arc_spirits_2d.match_result_players   enable row level security;
alter table arc_spirits_2d.player_ratings         enable row level security;
alter table arc_spirits_2d.player_rating_events   enable row level security;
alter table arc_spirits_2d.match_queue            enable row level security;

create policy "match_results_public_read"        on arc_spirits_2d.match_results        for select to anon, authenticated using (true);
create policy "match_result_players_public_read" on arc_spirits_2d.match_result_players for select to anon, authenticated using (true);
create policy "player_ratings_public_read"       on arc_spirits_2d.player_ratings       for select to anon, authenticated using (true);
create policy "player_rating_events_public_read" on arc_spirits_2d.player_rating_events for select to anon, authenticated using (true);
