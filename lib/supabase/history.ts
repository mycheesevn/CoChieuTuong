"use client";

import { createClient } from "./client";

export interface CctGameRow {
  id: string;
  result: "win" | "loss" | "draw";
  reason: string | null;
  level: number;
  plies: number;
  start_pos: string;
  moves: string[];
  created_at: string;
}

/** The player's vs-computer games, newest first, paged server-side. */
export async function fetchCctGames(
  userId: string,
  page: number,
  pageSize: number
): Promise<{ rows: CctGameRow[]; total: number }> {
  const from = page * pageSize;
  try {
    const sb = createClient();
    const { data, error, count } = await sb
      .from("cct_games")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error || !data) return { rows: [], total: 0 };
    const rows: CctGameRow[] = (data as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      result: r.result as CctGameRow["result"],
      reason: (r.reason as string | null) ?? null,
      level: Number(r.level) || 1,
      plies: Number(r.plies) || 0,
      start_pos: String(r.start_pos ?? ""),
      moves: Array.isArray(r.moves)
        ? (r.moves as unknown[]).map((m) => String(m))
        : [],
      created_at: String(r.created_at),
    }));
    return { rows, total: count ?? 0 };
  } catch {
    return { rows: [], total: 0 };
  }
}
