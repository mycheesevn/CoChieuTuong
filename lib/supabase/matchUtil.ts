/**
 * Move-label encode/decode + replay helpers for room matches and
 * correspondence games. Moves are stored as jsonb arrays of move LABELS,
 * exactly as engine.moveLabel produces: "L 1,4 → 1,3", "T 3,5 × 2,4".
 */
import {
  applyMove,
  posToState,
  type CctState,
  type Move,
  type Side,
} from "@/lib/cct/engine";

export interface ParsedLabel {
  from: number;
  to: number;
  capture: boolean;
}

/** Parse "L 1,4 → 1,3" / "T 3,5 × 2,4" back into squares. */
export function parseMoveLabel(label: string): ParsedLabel | null {
  const m = /^([TL]) (\d),(\d) (→|×) (\d),(\d)$/.exec(
    (label ?? "").trim()
  );
  if (!m) return null;
  const fc = Number(m[2]);
  const fr = Number(m[3]);
  const tc = Number(m[5]);
  const tr = Number(m[6]);
  if (
    fc < 1 || fc > 5 || fr < 1 || fr > 5 ||
    tc < 1 || tc > 5 || tr < 1 || tr > 5
  ) {
    return null;
  }
  return {
    from: (fr - 1) * 5 + (fc - 1),
    to: (tr - 1) * 5 + (tc - 1),
    capture: m[4] === "×",
  };
}

/**
 * Replay a label array from the start position. Unparseable labels are
 * skipped defensively; the turn always starts at 'r' (room matches and
 * correspondence games always start red-to-move).
 */
export function replayMatch(
  startPos: string,
  labels: string[]
): { states: CctState[]; moves: Move[]; cur: CctState } {
  const st0 = posToState(startPos, "r");
  if (!st0) throw new Error("Invalid start_pos");
  const states: CctState[] = [st0];
  const moves: Move[] = [];
  for (const label of labels) {
    const p = parseMoveLabel(label);
    if (!p) continue; // defensive: skip junk, keep the rest
    const mv: Move = { from: p.from, to: p.to, capture: p.capture };
    const next = applyMove(states[states.length - 1], mv);
    moves.push(mv);
    states.push(next);
  }
  return { states, moves, cur: states[states.length - 1] };
}

/** Which side the user plays in a match ('r'|'g'), or null when watching. */
export function mySideInMatch(
  userId: string | null,
  redId: string | null,
  greenId: string | null
): Side | null {
  if (!userId) return null;
  if (redId && userId === redId) return "r";
  if (greenId && userId === greenId) return "g";
  return null;
}
