/**
 * Cờ Chiếu Tướng AI — negamax + alpha-beta + transposition table +
 * iterative deepening, time-capped. Plays GREEN (the computer side).
 *
 * 12 levels: L1 blunders (depth 1 + heavy jitter) up to L12
 * (depth 12, 8s). All randomness lives here (Math.random); the engine
 * stays pure/deterministic.
 */
import {
  applyMove,
  countSoldiers,
  gameStatus,
  generalCapturesFrom,
  generalSquare,
  isGeneralThreatened,
  legalMoves,
  other,
  pseudoMoves,
  type CctState,
  type Move,
  type Side,
} from "./engine";

export interface LevelConfig {
  depth: number;
  timeMs: number;
  /** random score jitter at the root (0 = deterministic best) */
  jitter: number;
}

export const LEVELS: LevelConfig[] = [
  { depth: 0, timeMs: 0, jitter: 0 }, // placeholder so index === level
  { depth: 1, timeMs: 120, jitter: 130 }, // L1
  { depth: 1, timeMs: 150, jitter: 85 }, // L2
  { depth: 2, timeMs: 200, jitter: 60 }, // L3
  { depth: 2, timeMs: 300, jitter: 40 }, // L4
  { depth: 3, timeMs: 400, jitter: 28 }, // L5
  { depth: 3, timeMs: 600, jitter: 18 }, // L6
  { depth: 4, timeMs: 800, jitter: 10 }, // L7
  { depth: 5, timeMs: 1200, jitter: 5 }, // L8
  { depth: 6, timeMs: 2000, jitter: 0 }, // L9
  { depth: 7, timeMs: 3000, jitter: 0 }, // L10
  { depth: 9, timeMs: 4000, jitter: 0 }, // L11
  { depth: 12, timeMs: 8000, jitter: 0 }, // L12
];

export function levelConfig(level: number): LevelConfig {
  const l = Math.max(1, Math.min(12, Math.round(level)));
  return LEVELS[l];
}

const MATE = 100000;
const INF = 1e9;

class TimeUp extends Error {}

/** Static eval, from the perspective of the side to move. */
function evaluate(s: CctState): number {
  const me = s.turn;
  const op = other(me);
  let score = 0;

  // material: soldiers only (generals are never captured in legal play)
  score += (countSoldiers(s, me) - countSoldiers(s, op)) * 100;

  // mobility: pseudo-legal move counts per side (cheap, no legality filter)
  const myMob = pseudoMoves(s).length;
  const opMob = pseudoMoves({ cells: s.cells, turn: op, plies: s.plies }).length;
  score += (myMob - opMob) * 2;

  // being in check is bad (we must spend the reply escaping)
  if (isGeneralThreatened(s, me)) score -= 150;

  // attack potential: our general's available jump-captures
  try {
    const g = generalSquare(s, me);
    score += generalCapturesFrom(s.cells, g, me).length * 25;
  } catch {
    /* no general — shouldn't happen in legal play */
  }

  // advancement + central even-point control (diagonal mobility)
  for (let i = 0; i < 25; i++) {
    const p = s.cells[i];
    if (p === 0 || p > 4) continue;
    const r = Math.floor(i / 5);
    const c = i % 5;
    const mine = (me === "r" && (p === 1 || p === 2)) || (me === "g" && (p === 3 || p === 4));
    const v =
      (p === 1 ? (4 - r) * 3 : p === 3 ? r * 3 : 0) + ((c + r) % 2 === 0 ? 2 : 0);
    score += mine ? v : -v;
  }

  return score;
}

interface TTEntry {
  depth: number;
  score: number;
  flag: 0 | 1 | 2; // 0 exact, 1 lower, 2 upper
  best: Move | null;
}

export interface SearchResult {
  move: Move | null;
  depthReached: number;
  nodes: number;
}

export function findBestMove(state: CctState, level: number): SearchResult {
  const cfg = levelConfig(level);
  const tt = new Map<string, TTEntry>();
  const deadline = Date.now() + cfg.timeMs;
  let nodes = 0;

  const keyOf = (s: CctState): string =>
    s.turn + ":" + s.cells.join(",");

  function ordered(moves: Move[], ttBest: Move | null): Move[] {
    return moves
      .map((m) => {
        let v = 0;
        if (ttBest && m.from === ttBest.from && m.to === ttBest.to) v += 10000;
        if (m.capture) v += 5000;
        // centralising steps slightly preferred
        const tc = m.to % 5;
        const tr = Math.floor(m.to / 5);
        v += 8 - (Math.abs(tc - 2) + Math.abs(tr - 2));
        return { m, v };
      })
      .sort((a, b) => b.v - a.v)
      .map((x) => x.m);
  }

  function negamax(
    s: CctState,
    depth: number,
    alpha: number,
    beta: number,
    ply: number
  ): number {
    if ((nodes & 2047) === 0 && Date.now() > deadline) throw new TimeUp();
    nodes++;

    // terminal positions via gameStatus (covers mate, stalemate-loss,
    // no-screens draw, and degenerate general-less states)
    const st = gameStatus(s);
    if (st.outcome === "draw") return 0;
    if (st.outcome === "win") {
      // loss for side to move — prefer slower losses / faster wins
      return st.winner === s.turn ? MATE - ply : -MATE + ply;
    }
    if (depth <= 0) return evaluate(s);

    const moves = legalMoves(s);

    const key = keyOf(s);
    const ttHit = tt.get(key);
    let ttBest: Move | null = null;
    if (ttHit && ttHit.depth >= depth) {
      if (ttHit.flag === 0) return ttHit.score;
      if (ttHit.flag === 1 && ttHit.score > alpha) alpha = ttHit.score;
      if (ttHit.flag === 2 && ttHit.score < beta) beta = ttHit.score;
      if (alpha >= beta) return ttHit.score;
      ttBest = ttHit.best;
    }

    let best = -INF;
    let bestMove: Move | null = null;
    const alphaOrig = alpha;
    for (const m of ordered(moves, ttBest)) {
      const v = -negamax(applyMove(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (v > best) {
        best = v;
        bestMove = m;
      }
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }

    if (tt.size < 250000) {
      const flag: 0 | 1 | 2 =
        best <= alphaOrig ? 2 : best >= beta ? 1 : 0;
      tt.set(key, { depth, score: best, flag, best: bestMove });
    }
    return best;
  }

  const rootMoves = legalMoves(state);
  if (rootMoves.length === 0) return { move: null, depthReached: 0, nodes: 0 };
  if (rootMoves.length === 1 && cfg.jitter === 0)
    return { move: rootMoves[0], depthReached: 0, nodes: 1 };

  let best: Move = rootMoves[0];
  let depthReached = 0;

  try {
    for (let d = 1; d <= cfg.depth; d++) {
      let localBest = best;
      let localScore = -INF;
      let alpha = -INF;
      const beta = INF;
      const ttBest = tt.get(keyOf(state))?.best ?? null;
      for (const m of ordered(rootMoves, ttBest)) {
        let v = -negamax(applyMove(state, m), d - 1, -beta, -alpha, 1);
        if (cfg.jitter > 0) v += (Math.random() * 2 - 1) * cfg.jitter;
        if (v > localScore) {
          localScore = v;
          localBest = m;
        }
        if (v > alpha) alpha = v;
      }
      best = localBest;
      depthReached = d;
      // found forced mate — no need to look deeper
      if (localScore > MATE - 100) break;
    }
  } catch (e) {
    if (!(e instanceof TimeUp)) throw e;
    // keep the best move from the last completed depth
  }
  return { move: best, depthReached, nodes };
}

/** AI (green) replies to a green-to-move state. */
export function aiReply(state: CctState, level: number): Move | null {
  if (state.turn !== "g") return null;
  return findBestMove(state, level).move;
}
