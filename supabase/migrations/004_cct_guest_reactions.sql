-- 004_cct_guest_reactions.sql
-- Guests (anon) may READ match reactions in PUBLIC rooms, so spectators
-- see the emoji floaters over the board like everyone else (PacClone
-- pattern). Members keep full access via "cct_reactions member";
-- writes stay member-only (this policy is SELECT-only, anon role only).

drop policy if exists "cct_reactions guest read" on cct_match_reactions;
create policy "cct_reactions guest read" on cct_match_reactions
  for select to anon
  using (
    exists (
      select 1 from cct_rooms r
      where r.id = cct_match_reactions.room_id
        and r.is_public
    )
  );
