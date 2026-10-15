-- 007_cct_rls_helper_grants.sql
-- THE BUG (rooms "empty" for every signed-in user in production):
-- migration 002 revoked EXECUTE on the two RLS helper functions
-- is_cct_room_member / is_cct_room_leader from `authenticated`.
-- Every RLS policy on cct_rooms / cct_room_members / cct_room_matches /
-- cct_room_comments calls one of these helpers, and policy expressions
-- are evaluated with the CALLER's privileges — so each of those queries
-- fails with 42501 (permission denied) for signed-in users, PostgREST
-- returns an error, the client gets null data, and every room screen
-- renders empty: no room in "Phòng của tôi", RoomDetail stuck blank
-- after accepting a challenge, for BOTH players. SECURITY DEFINER
-- RPCs (create/join/start) were unaffected because they run as the
-- owner, which is why challenges could be created and notifications
-- sent while no room was ever visible. Chess's identical helper was
-- never revoked (kept the default PUBLIC execute) — which is why
-- Chess rooms work.
--
-- THE FIX: these helpers only answer "is the CALLER a member/leader
-- of this room" about the caller's own auth.uid() — they expose no
-- other user's data — so execute is safe to grant. Granting anon as
-- well keeps the permissive policies (which include these helpers)
-- from erroring on anonymous reads of public rooms.

grant execute on function public.is_cct_room_member(uuid) to authenticated;
grant execute on function public.is_cct_room_member(uuid) to anon;
grant execute on function public.is_cct_room_leader(uuid) to authenticated;
grant execute on function public.is_cct_room_leader(uuid) to anon;
