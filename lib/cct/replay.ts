// Replay helpers: decode a recorded game (start_pos + move labels) into
// steppable states for the replay viewer and video export.
//
// STORED FORMAT: games and room matches persist moves as human labels
// exactly as engine.moveLabel produces them ("L 1,4 → 1,3",
// "T 3,5 × 2,4") — parsed by parseMoveLabel (the same parser live room
// sync uses). Canon "c,r-c,r" strings are also accepted for safety.
// This once used ONLY the canon parser, which matched nothing real:
// every replay silently decoded to 0 plies (dead viewer, no export).
import {
  applyMove,
  gameStatus,
  initialPos,
  isGeneralThreatened,
  legalMoves,
  posToState,
  type CctState,
  type Move,
  type Side,
} from "./engine";
import { parseCanonMove } from "./canon";
import { parseMoveLabel } from "@/lib/supabase/matchUtil";

export interface ReplayGame {
  /** Move labels as stored: human labels ("L 1,4 → 1,3") or canon. */
  labels: string[];
  /** 25-char start position (omit = standard initial). */
  startPos?: string;
  /** Side to move at start (omit = "r"). */
  startTurn?: Side;
  title: string;
  subtitle: string;
}

export interface ReplayPly {
  move: Move;
  label: string;
  capture: boolean;
  check: boolean;
  mate: boolean;
}

/** Build the state sequence: states[0] = start, states[i] = after ply i. */
export function buildReplayStates(g: ReplayGame): {
  states: CctState[];
  plies: ReplayPly[];
} {
  let s0: CctState | null = null;
  if (g.startPos && g.startPos.length === 25) {
    s0 = posToState(g.startPos, g.startTurn ?? "r");
  }
  if (!s0) s0 = posToState(initialPos(), "r");
  if (!s0) throw new Error("invalid_start_pos");
  const states: CctState[] = [s0];
  const plies: ReplayPly[] = [];
  for (const lab of g.labels) {
    const parsed = parseCanonMove(lab) ?? parseMoveLabel(lab);
    const st = states[states.length - 1];
    if (!parsed) break;
    const found = legalMoves(st).find(
      (m) => m.from === parsed.from && m.to === parsed.to
    );
    if (!found) break; // corrupted record — stop rather than fabricate
    const captured = st.cells[found.to] !== 0;
    const after = applyMove(st, found);
    const gs = gameStatus(after);
    plies.push({
      move: found,
      label: lab,
      capture: captured,
      check:
        gs.outcome === "ongoing" && isGeneralThreatened(after, after.turn),
      mate: gs.outcome === "win",
    });
    states.push(after);
  }
  return { states, plies };
}
