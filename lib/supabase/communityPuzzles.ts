import { getSupabase } from "./client";

export interface CommunityPuzzleCard {
  id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  pos: string;
  turn: "r" | "g";
  solution: string[];
  solves: number;
  likes: number;
  created_at: string;
  liked_by_me: boolean;
}

export type PuzzleSort = "new" | "popular" | "mine";

export async function fetchPuzzleCards(
  sort: PuzzleSort,
  limit: number,
  offset: number
): Promise<CommunityPuzzleCard[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("cct_puzzle_cards", {
    p_sort: sort === "mine" ? "new" : sort,
    p_limit: limit,
    p_offset: offset,
    p_mine: sort === "mine",
  });
  if (error || !data) return [];
  return data as CommunityPuzzleCard[];
}

export interface PublishPuzzleInput {
  title: string;
  pos: string;
  turn: "r" | "g";
  solution: string[];
}

export async function publishPuzzle(input: PublishPuzzleInput): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data, error } = await sb
    .from("cct_puzzles")
    .insert({
      creator_id: user.id,
      title: input.title.slice(0, 60),
      pos: input.pos,
      turn: input.turn,
      solution: input.solution,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function togglePuzzleLike(puzzleId: string): Promise<boolean | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("cct_toggle_puzzle_like", {
    p_puzzle_id: puzzleId,
  });
  if (error) return null;
  return data as boolean;
}

export async function recordPuzzleSolve(puzzleId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    await sb.rpc("cct_record_puzzle_solve", { p_puzzle_id: puzzleId });
  } catch {
    /* best-effort */
  }
}
