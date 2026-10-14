-- 003_cct_growth.sql
--
-- Cờ Chiếu Tướng Phase 2C growth: web-push subscriptions, the
-- notification inbox, and community (UGC) puzzles.
--
-- Tables: cct_push_subscriptions, cct_notifications, cct_puzzles,
-- cct_puzzle_likes. (Library/lesson progress reuses the SHARED
-- `library_progress` table with `cct-`-prefixed lesson ids — no new
-- table. Daily puzzles are a static engine-verified bank in
-- lib/cct/puzzles.ts — no DB rows needed.)
--
-- Rules: `cct_` prefixes; shared `profiles` has NO email column
-- (display-name fallback full_name → username → email prefix via
-- LEFT JOIN auth.users, 'Player' last); every SECURITY DEFINER
-- function revokes PUBLIC and anon explicitly; tables come BEFORE any
-- `language sql` function that references them.
--
-- All statements are idempotent (if not exists / drop policy if exists /
-- create or replace). Run in the Dashboard SQL editor.

-- ================= 1. Push subscriptions =================
create table if not exists cct_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table cct_push_subscriptions enable row level security;
drop policy if exists "cct_push_subscriptions owner all" on cct_push_subscriptions;
create policy "cct_push_subscriptions owner all" on cct_push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================= 2. Notification inbox =================
create table if not exists cct_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null, -- 'challenge' | 'challenge_declined' | 'room_turn' | 'corr_turn' | 'corr_end'
  title text not null,
  body text not null default '',
  url text not null default '/',
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cct_notifications_user_idx
  on cct_notifications (user_id, created_at desc);
alter table cct_notifications enable row level security;
drop policy if exists "cct_notifications select own" on cct_notifications;
create policy "cct_notifications select own" on cct_notifications
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "cct_notifications update own" on cct_notifications;
create policy "cct_notifications update own" on cct_notifications
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Unread count for the avatar badge. AFTER the table: language sql
-- functions resolve relations at creation time.
create or replace function public.cct_unread_notifications()
returns int
language sql security definer stable set search_path = public as $$
  select count(*)::int from cct_notifications
  where user_id = auth.uid() and read_at is null;
$$;
revoke all on function public.cct_unread_notifications() from public;
revoke all on function public.cct_unread_notifications() from anon;
grant execute on function public.cct_unread_notifications() to authenticated;

-- ================= 3. Community puzzles (UGC) =================
create table if not exists cct_puzzles (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  pos text not null, -- 25-char CCT position string
  turn text not null check (turn in ('r', 'g')),
  solution jsonb not null default '[]'::jsonb, -- canonical "c,r-c,r" move labels, solver moves (+ scripted replies for mate-in-2)
  solves int not null default 0,
  created_at timestamptz not null default now()
);
alter table cct_puzzles enable row level security;
drop policy if exists "cct_puzzles public read" on cct_puzzles;
create policy "cct_puzzles public read" on cct_puzzles
  for select to anon, authenticated using (true);
drop policy if exists "cct_puzzles creator insert" on cct_puzzles;
create policy "cct_puzzles creator insert" on cct_puzzles
  for insert to authenticated with check (auth.uid() = creator_id);
drop policy if exists "cct_puzzles creator update" on cct_puzzles;
create policy "cct_puzzles creator update" on cct_puzzles
  for update to authenticated using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);
drop policy if exists "cct_puzzles creator delete" on cct_puzzles;
create policy "cct_puzzles creator delete" on cct_puzzles
  for delete to authenticated using (auth.uid() = creator_id);

create table if not exists cct_puzzle_likes (
  puzzle_id uuid not null references cct_puzzles(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (puzzle_id, user_id)
);
alter table cct_puzzle_likes enable row level security;
drop policy if exists "cct_puzzle_likes public read" on cct_puzzle_likes;
create policy "cct_puzzle_likes public read" on cct_puzzle_likes
  for select to anon, authenticated using (true);
drop policy if exists "cct_puzzle_likes self write" on cct_puzzle_likes;
create policy "cct_puzzle_likes self write" on cct_puzzle_likes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "cct_puzzle_likes self delete" on cct_puzzle_likes;
create policy "cct_puzzle_likes self delete" on cct_puzzle_likes
  for delete to authenticated using (auth.uid() = user_id);

-- Puzzle cards with server-resolved creator names (profiles is never
-- exposed to anon directly; names follow full_name → username →
-- email-prefix → 'Player'). plpgsql — but likes subqueries reference
-- tables created above, which is fine.
create or replace function public.cct_puzzle_cards(
  p_sort text, p_limit int, p_offset int, p_mine boolean
)
returns table (
  id uuid, creator_id uuid, creator_name text, title text,
  pos text, turn text, solution jsonb, solves int,
  likes bigint, created_at timestamptz, liked_by_me boolean
)
language plpgsql security definer stable set search_path = public as $$
begin
  return query
  select pz.id, pz.creator_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''),
             split_part(u.email, '@', 1), 'Player') as creator_name,
    pz.title, pz.pos, pz.turn, pz.solution, pz.solves,
    (select count(*) from cct_puzzle_likes l where l.puzzle_id = pz.id) as likes,
    pz.created_at,
    exists (select 1 from cct_puzzle_likes l
            where l.puzzle_id = pz.id and l.user_id = auth.uid()) as liked_by_me
  from cct_puzzles pz
  join profiles p on p.id = pz.creator_id
  left join auth.users u on u.id = p.id
  where (not p_mine) or pz.creator_id = auth.uid()
  order by
    case when p_sort = 'popular' then (select count(*) from cct_puzzle_likes l where l.puzzle_id = pz.id) end desc,
    pz.created_at desc
  limit least(coalesce(p_limit, 10), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.cct_puzzle_cards(text, int, int, boolean) from public;
revoke all on function public.cct_puzzle_cards(text, int, int, boolean) from anon;
grant execute on function public.cct_puzzle_cards(text, int, int, boolean) to anon, authenticated;

-- Toggle like (idempotent).
create or replace function public.cct_toggle_puzzle_like(p_puzzle_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from cct_puzzle_likes
             where puzzle_id = p_puzzle_id and user_id = v_uid) then
    delete from cct_puzzle_likes
      where puzzle_id = p_puzzle_id and user_id = v_uid;
    return false;
  end if;
  insert into cct_puzzle_likes (puzzle_id, user_id)
  values (p_puzzle_id, v_uid);
  return true;
end $$;
revoke all on function public.cct_toggle_puzzle_like(uuid) from public;
revoke all on function public.cct_toggle_puzzle_like(uuid) from anon;
grant execute on function public.cct_toggle_puzzle_like(uuid) to authenticated;

-- Record a solve (increments the counter).
create or replace function public.cct_record_puzzle_solve(p_puzzle_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update cct_puzzles set solves = solves + 1 where id = p_puzzle_id;
end $$;
revoke all on function public.cct_record_puzzle_solve(uuid) from public;
revoke all on function public.cct_record_puzzle_solve(uuid) from anon;
grant execute on function public.cct_record_puzzle_solve(uuid) to authenticated;
