"use client";

import { createClient } from "./client";

/**
 * Record a finished vs-computer game for the logged-in player.
 * Writes the cct_games history row and updates cct_stats (XP + counters)
 * inside the cct_record_game_result() RPC. Returns the XP awarded.
 * Mirrors chess's recordGameResult (lib/supabase/engagement.ts).
 */
export async function recordCctGameResult(
  result: "win" | "loss" | "draw",
  reason: string,
  level: number,
  plies: number,
  startPos: string,
  moves: string[]
): Promise<number> {
  const sb = createClient();
  const { data, error } = await sb.rpc("cct_record_game_result", {
    p_result: result,
    p_reason: reason,
    p_level: level,
    p_plies: plies,
    p_start_pos: startPos,
    p_moves: moves,
  });
  if (error) throw error;
  return data as number;
}
