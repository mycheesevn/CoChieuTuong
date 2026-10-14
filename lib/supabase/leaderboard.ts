"use client";

import { createClient } from "./client";

export interface CctLeaderRow {
  rank: number;
  user_id: string;
  display_name: string;
  xp: number;
  wins: number;
  games_played: number;
}

/** Top players by XP via the cct_leaderboard(p_limit) RPC.
 *  rank is already global (1-based) — render it directly. */
export async function fetchCctLeaderboard(
  limit: number = 100
): Promise<CctLeaderRow[]> {
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("cct_leaderboard", {
      p_limit: limit,
    });
    if (error || !data || !Array.isArray(data)) return [];
    return data.map((r) => ({
      rank: Number(r.rank) || 0,
      user_id: String(r.user_id),
      display_name: String(r.display_name ?? "Player"),
      xp: Number(r.xp) || 0,
      wins: Number(r.wins) || 0,
      games_played: Number(r.games_played) || 0,
    }));
  } catch {
    return [];
  }
}
