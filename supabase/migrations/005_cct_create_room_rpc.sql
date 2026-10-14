-- 005_cct_create_room_rpc.sql
-- THE BUG: creating a PRIVATE room from the client (INSERT into
-- cct_rooms + .select() read-back) is invisible to its own creator
-- under the "cct_rooms member read" policy — the leader's member row
-- is only inserted AFTER the read-back, and the room is not public.
-- PostgREST .single() on zero visible rows throws, so friend
-- challenges (private 2-player rooms) and private-room creation
-- silently failed in production; the caller's catch swallowed it and
-- the user saw NOTHING happen. (Same trap Chess fixed in its 015.)
--
-- THE FIX (Chess 015 pattern):
--  (a) cct_create_room() SECURITY DEFINER RPC — inserts the room AND
--      the leader's member row atomically and returns the room.
--  (b) leader clause in the rooms SELECT policy, so a leader can
--      always read their own rooms even without a member row.

create or replace function public.cct_gen_room_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.cct_rooms r where r.code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function public.cct_gen_room_code() from public;
revoke all on function public.cct_gen_room_code() from anon;
revoke all on function public.cct_gen_room_code() from authenticated;

create or replace function public.cct_create_room(
  p_name text,
  p_is_public boolean,
  p_max_players int default 8
)
returns public.cct_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.cct_rooms;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  insert into public.cct_rooms (code, name, leader_id, is_public, max_players, turn_order)
  values (
    public.cct_gen_room_code(),
    left(coalesce(nullif(trim(p_name), ''), 'Phòng chơi'), 60),
    uid,
    coalesce(p_is_public, false),
    least(20, greatest(2, coalesce(p_max_players, 8))),
    array[uid]
  )
  returning * into r;
  insert into public.cct_room_members (room_id, user_id, role)
  values (r.id, uid, 'player');
  return r;
end;
$$;
revoke all on function public.cct_create_room(text, boolean, int) from public;
revoke all on function public.cct_create_room(text, boolean, int) from anon;
grant execute on function public.cct_create_room(text, boolean, int) to authenticated;

-- (b) leaders can always read their own rooms.
drop policy if exists "cct_rooms member read" on cct_rooms;
create policy "cct_rooms member read" on cct_rooms
  for select using (
    is_cct_room_member(id) or is_public or leader_id = auth.uid()
  );
