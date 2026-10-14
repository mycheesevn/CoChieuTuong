-- 001_cct_foundation.sql
--
-- Cờ Chiếu Tướng (CCT) foundation on the SHARED Supabase project (shared
-- with the xiangqi/PacClone and chess apps). All CCT objects use the
-- `cct_` prefix to avoid collisions. The `profiles` table is shared and
-- is NEVER created here.
--
-- Contents:
--   1. cct_stats              — per-player XP / record
--   2. cct_games              — vs-computer game history
--   3. cct_record_game_result — record RPC + XP rule
--   4. cct_game_events + record_cct_game_event — append-only site stats events
--   5. cct_site_stats         — aggregate stats RPC (member surface)
--   6. cct_daily_checkins + cct_claim_checkin + cct_checkin_history
--   7. cct_leaderboard        — public leaderboard RPC
--
-- All statements are idempotent (if not exists / drop policy if exists /
-- create or replace function). Run in the Dashboard SQL editor.

-- ================= 1. CCT STATS =================
create table if not exists cct_stats (
  user_id uuid primary key references profiles(id) on delete cascade,
  xp int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  games_played int not null default 0,
  updated_at timestamptz not null default now()
);
alter table cct_stats enable row level security;
drop policy if exists "cct_stats self" on cct_stats;
create policy "cct_stats self" on cct_stats
  for all using (auth.uid() = user_id);
drop policy if exists "cct_stats leaderboard" on cct_stats;
create policy "cct_stats leaderboard" on cct_stats
  for select using (true);

-- ================= 2. VS-COMPUTER GAME HISTORY =================
create table if not exists cct_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  result text not null check (result in ('win','loss','draw')),
  reason text,
  level int,
  plies int not null default 0,
  start_pos text not null,
  moves jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table cct_games enable row level security;
drop policy if exists "cct_games self" on cct_games;
create policy "cct_games self" on cct_games
  for all using (auth.uid() = user_id);

-- ================= 3. RECORD GAME RESULT + XP =================
-- XP rule (mirrors chess): win = 10 + 2 * level, draw = 5, loss = 3.
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
begin
  xp := case p_result
    when 'win' then 10 + 2 * p_level
    when 'draw' then 5
    else 3 end;
  insert into cct_games (user_id, result, reason, level, plies, start_pos, moves)
  values (auth.uid(), p_result, p_reason, p_level, p_plies, p_start_pos, coalesce(p_moves, '[]'::jsonb));
  insert into cct_stats (user_id, xp, games_played, wins, losses, draws)
  values (
    auth.uid(),
    xp,
    1,
    case when p_result = 'win' then 1 else 0 end,
    case when p_result = 'loss' then 1 else 0 end,
    case when p_result = 'draw' then 1 else 0 end
  )
  on conflict (user_id) do update set
    xp = cct_stats.xp + excluded.xp,
    games_played = cct_stats.games_played + 1,
    wins = cct_stats.wins + excluded.wins,
    losses = cct_stats.losses + excluded.losses,
    draws = cct_stats.draws + excluded.draws,
    updated_at = now();
  return xp;
end;
$function$;
revoke all on function public.cct_record_game_result(text, text, int, int, text, jsonb) from public;
revoke all on function public.cct_record_game_result(text, text, int, int, text, jsonb) from anon;
grant execute on function public.cct_record_game_result(text, text, int, int, text, jsonb) to authenticated;

-- ================= 4. GAME EVENTS (append-only site stats) =================
create table if not exists cct_game_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  event text not null check (event in ('start','finish','abandon')),
  result text check (result in ('win','loss','draw')),
  level int,
  created_at timestamptz not null default now()
);
create index if not exists cct_game_events_created_idx on cct_game_events (created_at desc);
create index if not exists cct_game_events_event_idx on cct_game_events (event);
alter table cct_game_events enable row level security;
drop policy if exists "Anyone can record cct game events" on cct_game_events;
create policy "Anyone can record cct game events" on cct_game_events
  for insert to anon, authenticated with check (true);

-- Write path: SECURITY DEFINER, server stamps auth.uid() (guests NULL).
create or replace function public.record_cct_game_event(
  p_event text,
  p_result text default null,
  p_level int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if p_event not in ('start', 'finish', 'abandon') then
    raise exception 'invalid event';
  end if;
  insert into cct_game_events (user_id, event, result, level)
  values (auth.uid(), p_event, p_result, p_level);
end;
$function$;
revoke all on function public.record_cct_game_event(text, text, int) from public;
revoke all on function public.record_cct_game_event(text, text, int) from anon;
grant execute on function public.record_cct_game_event(text, text, int) to anon, authenticated;

-- ================= 5. SITE STATS RPC =================
-- Aggregates. Authenticated only (guests recording is fine; viewing is
-- a member surface). Buckets: {d: bucket-start date, c: count}.
create or replace function public.cct_site_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  r jsonb;
begin
  select jsonb_build_object(
    'plays_total',   (select count(*) from cct_game_events where event = 'start'),
    'plays_member',  (select count(*) from cct_game_events where event = 'start' and user_id is not null),
    'plays_guest',   (select count(*) from cct_game_events where event = 'start' and user_id is null),
    'finished',      (select count(*) from cct_game_events where event = 'finish'),
    'abandoned',     (select count(*) from cct_game_events where event = 'abandon'),
    'members_total', (select count(*) from profiles),
    'members_today', (select count(*) from profiles where created_at >= date_trunc('day', now())),
    'members_week',  (select count(*) from profiles where created_at >= date_trunc('week', now())),
    'members_month', (select count(*) from profiles where created_at >= date_trunc('month', now())),
    'plays_daily', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'c', c) order by d), '[]'::jsonb)
      from (select date_trunc('day', created_at)::date as d, count(*) as c
            from cct_game_events where event = 'start' and created_at >= date_trunc('day', now()) - interval '29 days'
            group by 1) t),
    'plays_weekly', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'c', c) order by d), '[]'::jsonb)
      from (select date_trunc('week', created_at)::date as d, count(*) as c
            from cct_game_events where event = 'start' and created_at >= date_trunc('week', now()) - interval '11 weeks'
            group by 1) t),
    'plays_monthly', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'c', c) order by d), '[]'::jsonb)
      from (select date_trunc('month', created_at)::date as d, count(*) as c
            from cct_game_events where event = 'start' and created_at >= date_trunc('month', now()) - interval '11 months'
            group by 1) t),
    'plays_yearly', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'c', c) order by d), '[]'::jsonb)
      from (select date_trunc('year', created_at)::date as d, count(*) as c
            from cct_game_events where event = 'start'
            group by 1) t),
    'members_daily', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'c', c) order by d), '[]'::jsonb)
      from (select date_trunc('day', created_at)::date as d, count(*) as c
            from profiles where created_at >= date_trunc('day', now()) - interval '29 days'
            group by 1) t),
    'members_weekly', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'c', c) order by d), '[]'::jsonb)
      from (select date_trunc('week', created_at)::date as d, count(*) as c
            from profiles where created_at >= date_trunc('week', now()) - interval '11 weeks'
            group by 1) t),
    'members_monthly', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'c', c) order by d), '[]'::jsonb)
      from (select date_trunc('month', created_at)::date as d, count(*) as c
            from profiles where created_at >= date_trunc('month', now()) - interval '11 months'
            group by 1) t),
    'members_yearly', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'c', c) order by d), '[]'::jsonb)
      from (select date_trunc('year', created_at)::date as d, count(*) as c
            from profiles
            group by 1) t)
  ) into r;
  return r;
end;
$function$;
revoke all on function public.cct_site_stats() from public;
revoke all on function public.cct_site_stats() from anon;
grant execute on function public.cct_site_stats() to authenticated;

-- ================= 6. DAILY CHECK-IN =================
create table if not exists cct_daily_checkins (
  user_id uuid not null references profiles(id) on delete cascade,
  checkin_date date not null,
  streak int not null default 1,
  created_at timestamptz not null default now(),
  primary key (user_id, checkin_date)
);
alter table cct_daily_checkins enable row level security;
drop policy if exists "Users can view own cct checkins" on cct_daily_checkins;
create policy "Users can view own cct checkins"
  on cct_daily_checkins for select to authenticated
  using (user_id = auth.uid());

-- Claim today's check-in (PacClone claim_checkin() semantics exactly):
-- day boundary in Asia/Ho_Chi_Minh; streak = yesterday's streak + 1 else 1;
-- XP = least(10 + 5 * (streak - 1), 40); idempotent on same day;
-- XP lands in cct_stats.
create or replace function public.cct_claim_checkin()
returns table (streak int, xp_awarded int, already_claimed boolean)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_yesterday date := v_today - 1;
  v_prev_streak int;
  v_streak int;
  v_xp int;
  v_existed boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select exists(
    select 1 from cct_daily_checkins
    where user_id = v_uid and checkin_date = v_today
  ) into v_existed;

  if v_existed then
    select c.streak into v_streak from cct_daily_checkins c
     where c.user_id = v_uid and c.checkin_date = v_today;
    return query select v_streak, 0, true;
    return;
  end if;

  -- Consecutive streak: yesterday's streak + 1, else restart at 1.
  select c.streak into v_prev_streak from cct_daily_checkins c
   where c.user_id = v_uid and c.checkin_date = v_yesterday;
  v_streak := coalesce(v_prev_streak, 0) + 1;

  -- XP: 10 base + 5 per consecutive day, capped at 40.
  v_xp := least(10 + 5 * (v_streak - 1), 40);

  insert into cct_daily_checkins (user_id, checkin_date, streak)
  values (v_uid, v_today, v_streak);

  insert into cct_stats (user_id, xp) values (v_uid, v_xp)
    on conflict (user_id) do update set xp = cct_stats.xp + excluded.xp, updated_at = now();

  return query select v_streak, v_xp, false;
end;
$function$;
revoke all on function public.cct_claim_checkin() from public;
revoke all on function public.cct_claim_checkin() from anon;
grant execute on function public.cct_claim_checkin() to authenticated;

-- Recent check-in history for the calendar view (last 7 rows).
create or replace function public.cct_checkin_history()
returns table (checkin_date date, streak int)
language sql
security definer
stable
set search_path = public
as $function$
  select c.checkin_date, c.streak
  from cct_daily_checkins c
  where c.user_id = auth.uid()
  order by c.checkin_date desc
  limit 7;
$function$;
revoke all on function public.cct_checkin_history() from public;
revoke all on function public.cct_checkin_history() from anon;
grant execute on function public.cct_checkin_history() to authenticated;

-- ================= 7. LEADERBOARD =================
-- Guests can view; the site-stats tab RPC stays member-only.
create or replace function public.cct_leaderboard(p_limit int)
returns table (rank bigint, user_id uuid, display_name text, xp int, wins int, games_played int)
language sql
security definer
stable
set search_path = public
as $function$
  select
    row_number() over (order by s.xp desc, s.games_played desc) as rank,
    s.user_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), split_part(coalesce(u.email, ''), '@', 1)) as display_name,
    s.xp,
    s.wins,
    s.games_played
  from cct_stats s
  join profiles p on p.id = s.user_id
  left join auth.users u on u.id = s.user_id
  order by s.xp desc, s.games_played desc
  limit least(coalesce(p_limit, 100), 200);
$function$;
revoke all on function public.cct_leaderboard(int) from public;
revoke all on function public.cct_leaderboard(int) from anon;
grant execute on function public.cct_leaderboard(int) to anon, authenticated;
