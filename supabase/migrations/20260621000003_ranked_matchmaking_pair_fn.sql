-- Ranked matchmaking pairing function (race-safe). Selects + atomically claims a full
-- lobby of queued players whose conservative-rating (ordinal) spread fits a window that
-- widens with wait time. Serialized via a transaction-level advisory lock so concurrent
-- queue polls never double-match. Returns the claimed match_queue rows.
-- (Originally applied via the Supabase API during the ranked build; captured here for history.)

create or replace function arc_spirits_2d.try_form_ranked_match(
  p_lobby_size integer,
  p_base_window double precision,
  p_widen_per_sec double precision,
  p_max_window double precision
)
returns setof arc_spirits_2d.match_queue
language plpgsql
as $function$
declare
	v_rows arc_spirits_2d.match_queue[];
	v_n integer;
	v_i integer;
	v_group arc_spirits_2d.match_queue[];
	v_min double precision;
	v_max double precision;
	v_oldest timestamptz;
	v_window double precision;
	v_age double precision;
	v_ids uuid[];
begin
	-- Serialize all pairing attempts (released automatically at txn end).
	perform pg_advisory_xact_lock(hashtext('arc_spirits_2d.ranked_matchmaking'));

	select array_agg(q order by q.ordinal desc, q.queued_at asc)
	  into v_rows
	  from arc_spirits_2d.match_queue q
	 where q.status = 'queued';

	v_n := coalesce(array_length(v_rows, 1), 0);
	if v_n < p_lobby_size then
		return;
	end if;

	for v_i in 1 .. (v_n - p_lobby_size + 1) loop
		v_group := v_rows[v_i : v_i + p_lobby_size - 1];

		select min(g.ordinal), max(g.ordinal), min(g.queued_at)
		  into v_min, v_max, v_oldest
		  from unnest(v_group) as g;

		v_age := greatest(0, extract(epoch from (now() - v_oldest)));
		v_window := least(p_base_window + v_age * p_widen_per_sec, p_max_window);

		if (v_max - v_min) <= v_window then
			select array_agg(g.user_id) into v_ids from unnest(v_group) as g;
			return query
				update arc_spirits_2d.match_queue mq
				   set status = 'matched', updated_at = now()
				 where mq.user_id = any(v_ids)
				   and mq.status = 'queued'
				returning mq.*;
			return;
		end if;
	end loop;

	return;
end;
$function$;
