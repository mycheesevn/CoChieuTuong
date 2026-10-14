-- 006_cct_rating.sql
-- Rating (Elo) for CCT — PacClone's model exactly (lib/xiangqi/rating.ts):
-- start 800, AI pseudo-ratings by level (300…2400), expected score
-- 1/(1+10^((opp-me)/400)), K = 40 under 20 recorded games else 24,
-- floor 100, peak tracked alongside. PacClone computes this on the
-- client; CCT records results server-side (cct_record_game_result),
-- so the same math lives in the RPC. Like PacClone, rating moves on
-- vs-COMPUTER results only — room matches keep awarding XP only.
-- (Side discovery: Chess's chess_stats.rating is never updated by its
-- record RPC — it sits at 800 forever. CCT does it properly here.)

alter table cct_stats add column if not exists rating int not null default 800;
alter table cct_stats add column if not exists peak_rating int not null default 800;

-- AI pseudo-rating by level (PacClone AI_RATINGS).
create or replace function public.cct_ai_rating(p_level int)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_level
    when 1 then 300
    when 2 then 500
    when 3 then 700
    when 4 then 900
    when 5 then 1100
    when 6 then 1300
    when 7 then 1500
    when 8 then 1700
    when 9 then 1900
    when 10 then 2100
    when 11 then 2250
    else 2400
  end;
$$;
revoke all on function public.cct_ai_rating(int) from public;
revoke all on function public.cct_ai_rating(int) from anon;
revoke all on function public.cct_ai_rating(int) from authenticated;

-- Record RPC v2: identical XP/history behavior + the Elo update.
-- Delta rounding uses floor(x + 0.5) to match JS Math.round exactly
-- (PG round() rounds half away from zero, Math.round half up).
create or replace function public.cct_record_game_result(
  p_result text,
  p_reason text,
  p_level int,
  p_plies int,
  p_start_pos text,
  p_moves jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $function$
declare
  xp int;
  v_uid uuid := auth.uid();
  v_rating int;
  v_games int;
  v_score numeric;
  v_expected numeric;
  v_k int;
  v_new int;
begin
  xp := case p_result
    when 'win' then 10 + 2 * p_level
    when 'draw' then 5
    else 3 end;

  select rating, games_played into v_rating, v_games
    from cct_stats where user_id = v_uid;
  v_rating := coalesce(v_rating, 800);
  v_games := coalesce(v_games, 0);
  v_score := case p_result when 'win' then 1 when 'draw' then 0.5 else 0 end;
  v_expected := 1.0 / (1.0 + power(10.0, (public.cct_ai_rating(p_level) - v_rating) / 400.0));
  v_k := case when v_games < 20 then 40 else 24 end;
  v_new := greatest(100, v_rating + floor(v_k * (v_score - v_expected) + 0.5)::int);

  insert into cct_games (user_id, result, reason, level, plies, start_pos, moves)
  values (v_uid, p_result, p_reason, p_level, p_plies, p_start_pos, coalesce(p_moves, '[]'::jsonb));
  insert into cct_stats (user_id, xp, games_played, wins, losses, draws, rating, peak_rating)
  values (
    v_uid,
    xp,
    1,
    case when p_result = 'win' then 1 else 0 end,
    case when p_result = 'loss' then 1 else 0 end,
    case when p_result = 'draw' then 1 else 0 end,
    v_new,
    greatest(800, v_new)
  )
  on conflict (user_id) do update set
    xp = cct_stats.xp + excluded.xp,
    games_played = cct_stats.games_played + 1,
    wins = cct_stats.wins + excluded.wins,
    losses = cct_stats.losses + excluded.losses,
    draws = cct_stats.draws + excluded.draws,
    rating = v_new,
    peak_rating = greatest(cct_stats.peak_rating, v_new),
    updated_at = now();
  return xp;
end;
$function$;
revoke all on function public.cct_record_game_result(text, text, int, int, text, jsonb) from public;
revoke all on function public.cct_record_game_result(text, text, int, int, text, jsonb) from anon;
grant execute on function public.cct_record_game_result(text, text, int, int, text, jsonb) to authenticated;

-- Leaderboard v2: sort by rating (XP breaks ties), return the rating
-- columns. Return-type change requires a drop first.
drop function if exists public.cct_leaderboard(int);
create or replace function public.cct_leaderboard(p_limit int)
returns table (rank bigint, user_id uuid, display_name text, xp int, wins int, games_played int, rating int, peak_rating int)
language sql
security definer
stable
set search_path = public
as $function$
  select
    row_number() over (order by s.rating desc, s.xp desc) as rank,
    s.user_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), split_part(coalesce(u.email, ''), '@', 1)) as display_name,
    s.xp,
    s.wins,
    s.games_played,
    s.rating,
    s.peak_rating
  from cct_stats s
  join profiles p on p.id = s.user_id
  left join auth.users u on u.id = s.user_id
  order by s.rating desc, s.xp desc
  limit least(coalesce(p_limit, 100), 200);
$function$;
revoke all on function public.cct_leaderboard(int) from public;
revoke all on function public.cct_leaderboard(int) from anon;
grant execute on function public.cct_leaderboard(int) to anon, authenticated;
