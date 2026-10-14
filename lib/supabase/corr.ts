/**
 * Correspondence (async) games — one move whenever, board replayed
 * client-side from move labels. Mirrors the room-match move flow.
 */
import { createClient } from "./client";
import { initialPos } from "@/lib/cct/engine";
import { fireEvent } from "./notify";

export interface CorrGame {
  id: string;
  red_id: string;
  green_id: string;
  status: string;
  moves: string[];
  start_pos: string;
  result: string | null;
  reason: string | null;
  winner_id: string | null;
  created_at: string;
  updated_at: string;
}

function norm(g: CorrGame): CorrGame {
  if (!Array.isArray(g.moves)) g.moves = [];
  return g;
}

/** Create a correspondence game with a friend: creator plays red. */
export async function createCorrGame(friendId: string): Promise<CorrGame> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("cct_corr_games")
    .insert({
      red_id: user.id,
      green_id: friendId,
      start_pos: initialPos(),
      moves: [],
    })
    .select()
    .single();
  if (error) throw error;
  void fireEvent("corr", { to: friendId, game: (data as CorrGame).id });
  return norm(data as CorrGame);
}

export async function fetchMyCorrGames(): Promise<CorrGame[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("cct_corr_games")
    .select("*")
    .or(`red_id.eq.${user.id},green_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CorrGame[]).map(norm);
}

export async function getCorrGame(id: string): Promise<CorrGame | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("cct_corr_games")
    .select("*")
    .eq("id", id)
    .single();
  return data ? norm(data as CorrGame) : null;
}

/** Push the whole label array while the game is active (optimistic
 *  updates: the caller reverts on failure). */
export async function pushCorrMoves(id: string, labels: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cct_corr_games")
    .update({ moves: labels })
    .eq("id", id)
    .eq("status", "active");
  if (error) throw error;
}

/** Finalize via RPC: idempotent, awards play XP (≥10 plies). */
export async function finishCorrGame(
  id: string,
  result: "red" | "green" | "draw",
  reason: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cct_finish_corr_game", {
    p_game_id: id,
    p_result: result,
    p_reason: reason,
  });
  if (error) throw error;
}

/** Live opponent moves for an open correspondence game. */
export function subscribeCorrGame(id: string, onUpdate: (g: CorrGame) => void) {
  const supabase = createClient();
  return supabase
    .channel(`cct-corr:${id}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "cct_corr_games",
        filter: `id=eq.${id}`,
      },
      (payload: { new: CorrGame }) => onUpdate(norm(payload.new as CorrGame))
    )
    .subscribe();
}
