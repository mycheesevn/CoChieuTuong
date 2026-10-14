/**
 * Cờ Chiếu Tướng — rules engine. Pure, deterministic, no DOM.
 *
 * Board: 5x5 intersection points, index = r*5+c (0-indexed), col c and
 * row r in 0..4. User-facing coordinates are 1-indexed (col,row).
 * Lines: all orthogonal adjacencies + diagonal adjacencies only where
 * (c+r) is even (0-indexed), i.e. (col+row) even 1-indexed.
 *
 * Cells: 0 empty, 1 red soldier, 2 red general, 3 green soldier, 4 green general.
 * Red (human) moves first. AI plays green.
 *
 * Moves:
 *  - any piece steps 1 point along a drawn line to an adjacent EMPTY point;
 *  - soldiers NEVER capture;
 *  - only the general captures: on a straight ray (orthogonal or
 *    diagonal) the general jumps over ONE of its OWN soldiers (the
 *    screen/"quân đệm") standing on the adjacent point, and lands on the
 *    enemy piece (soldier or general) on the point immediately beyond
 *    the screen. The three pieces stand on consecutive points — no
 *    empty point anywhere in the span (user-confirmed 2026-10-13).
 * Legality (chess-style): a move is legal only if afterwards the mover's
 * own general is NOT under enemy jump-threat.
 * End: side to move with no legal moves LOSES — checkmate if its general
 * is under threat, stalemate-loss otherwise. DRAW the moment BOTH sides
 * have zero soldiers (no screens left → nobody can ever capture).
 */

export type Side = "r" | "g";

export const EMPTY = 0;
export const R_SOLDIER = 1;
export const R_GENERAL = 2;
export const G_SOLDIER = 3;
export const G_GENERAL = 4;

export type Cell = 0 | 1 | 2 | 3 | 4;

export interface CctState {
  cells: Cell[];
  turn: Side;
  plies: number;
}

export interface Move {
  from: number;
  to: number;
  /** true when the general jump-captures (the only capture in the game) */
  capture: boolean;
}

export type GameResult =
  | { outcome: "ongoing" }
  // reason "checkmate" also covers the degenerate case where a general was
  // actually captured (unreachable in legal play — see below).
  | { outcome: "win"; winner: Side; reason: "checkmate" | "stalemate" | "resign" }
  | { outcome: "draw"; reason: "no-screens" | "agreement" };

export const other = (s: Side): Side => (s === "r" ? "g" : "r");

const isRed = (c: Cell): boolean => c === R_SOLDIER || c === R_GENERAL;
const isGreen = (c: Cell): boolean => c === G_SOLDIER || c === G_GENERAL;
const isSoldier = (c: Cell): boolean => c === R_SOLDIER || c === G_SOLDIER;
const isGeneral = (c: Cell): boolean => c === R_GENERAL || c === G_GENERAL;
const belongsTo = (c: Cell, s: Side): boolean =>
  s === "r" ? isRed(c) : isGreen(c);

export const colOf = (i: number): number => i % 5;
export const rowOf = (i: number): number => Math.floor(i / 5);
/** 1-indexed user coordinates */
export const coordOf = (i: number): [number, number] => [colOf(i) + 1, rowOf(i) + 1];
const idx = (c: number, r: number): number => r * 5 + c;
const inBoard = (c: number, r: number): boolean =>
  c >= 0 && c < 5 && r >= 0 && r < 5;

/* ---------------- precomputed geometry ---------------- */

const DIRS_ORTH: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIRS_DIAG: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Step neighbours (movement graph): orthogonal always, diagonals only
 *  from even squares (each diagonal segment links two even squares). */
export const NEIGHBORS: number[][] = (() => {
  const n: number[][] = [];
  for (let i = 0; i < 25; i++) {
    const c = colOf(i);
    const r = rowOf(i);
    const list: number[] = [];
    for (const [dc, dr] of DIRS_ORTH) {
      if (inBoard(c + dc, r + dr)) list.push(idx(c + dc, r + dr));
    }
    if ((c + r) % 2 === 0) {
      for (const [dc, dr] of DIRS_DIAG) {
        if (inBoard(c + dc, r + dr)) list.push(idx(c + dc, r + dr));
      }
    }
    n.push(list);
  }
  return n;
})();

/** Cannon rays from every square: 4 orthogonal always; 4 diagonal rays
 *  only when the origin square itself has diagonal lines (even square).
 *  Diagonal rays continue through consecutive even squares. */
export const RAYS: number[][][] = (() => {
  const rays: number[][][] = [];
  for (let i = 0; i < 25; i++) {
    const c = colOf(i);
    const r = rowOf(i);
    const from: number[][] = [];
    const dirs: ReadonlyArray<readonly [number, number]> =
      (c + r) % 2 === 0
        ? [...DIRS_ORTH, ...DIRS_DIAG]
        : [...DIRS_ORTH];
    for (const [dc, dr] of dirs) {
      const ray: number[] = [];
      let cc = c + dc;
      let rr = r + dr;
      while (inBoard(cc, rr)) {
        ray.push(idx(cc, rr));
        cc += dc;
        rr += dr;
      }
      from.push(ray);
    }
    rays.push(from);
  }
  return rays;
})();

/* ---------------- state ---------------- */

export function initialState(): CctState {
  const cells: Cell[] = new Array(25).fill(EMPTY);
  // Green (top, rows 0-1)
  for (let c = 0; c < 5; c++) {
    cells[idx(c, 1)] = G_SOLDIER;
    if (c !== 2) cells[idx(c, 0)] = G_SOLDIER;
  }
  cells[idx(2, 0)] = G_GENERAL;
  // Red (bottom, rows 3-4)
  for (let c = 0; c < 5; c++) {
    cells[idx(c, 3)] = R_SOLDIER;
    if (c !== 2) cells[idx(c, 4)] = R_SOLDIER;
  }
  cells[idx(2, 4)] = R_GENERAL;
  return { cells, turn: "r", plies: 0 };
}

export function cloneState(s: CctState): CctState {
  return { cells: s.cells.slice(), turn: s.turn, plies: s.plies };
}

export function countSoldiers(s: CctState, side: Side): number {
  const target = side === "r" ? R_SOLDIER : G_SOLDIER;
  let n = 0;
  for (const c of s.cells) if (c === target) n++;
  return n;
}

/* ---------------- position serialization ---------------- */

/**
 * Position string: 25 chars, one per cell in index order, each '0'..'4'
 * (the Cell value). Used for game records (start_pos), the setup editor,
 * and (later) deep links. The side to move is NOT part of the string —
 * it is carried separately wherever the string is stored/parsed.
 */
export function stateToPos(cells: Cell[]): string {
  return cells.map((c) => String(c)).join("");
}

export function initialPos(): string {
  return stateToPos(initialState().cells);
}

/**
 * Validate a state as an editable position. Returns null when legal,
 * otherwise an error key:
 * - 'generals': not exactly 1 general per side;
 * - 'soldiers': more than 9 soldiers on a side;
 * - 'check': the side NOT to move is already under jump-threat
 *   (the previous mover cannot have left them in check).
 */
export function validatePos(
  st: CctState
): "generals" | "soldiers" | "check" | null {
  let rg = 0,
    gg = 0,
    rs = 0,
    gs = 0;
  for (const c of st.cells) {
    if (c === R_GENERAL) rg++;
    else if (c === G_GENERAL) gg++;
    else if (c === R_SOLDIER) rs++;
    else if (c === G_SOLDIER) gs++;
  }
  if (rg !== 1 || gg !== 1) return "generals";
  if (rs > 9 || gs > 9) return "soldiers";
  if (isGeneralThreatened(st, other(st.turn))) return "check";
  return null;
}

/** Parse a position string + side to move into a state, or null when
 *  the string is malformed or the position fails validatePos(). */
export function posToState(pos: string, turn: Side): CctState | null {
  if (!/^[0-4]{25}$/.test(pos)) return null;
  const cells = pos.split("").map((ch) => Number(ch) as Cell);
  const st: CctState = { cells, turn, plies: 0 };
  return validatePos(st) === null ? st : null;
}

export function generalSquare(s: CctState, side: Side): number {
  const target = side === "r" ? R_GENERAL : G_GENERAL;
  const i = s.cells.indexOf(target);
  if (i < 0) throw new Error(`general of side ${side} missing`);
  return i;
}

/** A general can never be captured in legal play (chess-style legality:
 *  a side in check must escape or loses immediately, so the capturing
 *  move never gets played). Crafted positions / search may still produce
 *  a general-less state — these helpers stay total so nothing crashes. */
export function hasGeneral(s: CctState, side: Side): boolean {
  const target = side === "r" ? R_GENERAL : G_GENERAL;
  return s.cells.indexOf(target) >= 0;
}

/* ---------------- captures ---------------- */

/**
 * Jump-capture targets of the general on square `g` (side `me`):
 * the capture span contains ONLY the screen — general, own soldier and
 * enemy target stand on three CONSECUTIVE points of a ray, with no
 * empty point anywhere in between (user-confirmed rule 2026-10-13).
 */
export function generalCapturesFrom(
  cells: Cell[],
  g: number,
  me: Side
): number[] {
  const targets: number[] = [];
  const ownSoldier = me === "r" ? R_SOLDIER : G_SOLDIER;
  for (const ray of RAYS[g]) {
    if (ray.length < 2) continue;
    if (cells[ray[0]] !== ownSoldier) continue; // adjacent point must be the own-soldier screen
    const t = cells[ray[1]];
    if (belongsTo(t, other(me))) targets.push(ray[1]); // point right beyond the screen must be enemy
  }
  return targets;
}

/** Is `side`'s general currently under enemy jump-threat?
 *  Total: false when either general is absent (game already decided). */
export function isGeneralThreatened(s: CctState, side: Side): boolean {
  if (!hasGeneral(s, side) || !hasGeneral(s, other(side))) return false;
  const enemy = other(side);
  const gSq = generalSquare(s, side);
  const egSq = generalSquare(s, enemy);
  return generalCapturesFrom(s.cells, egSq, enemy).includes(gSq);
}

/* ---------------- moves ---------------- */

/** Pseudo-legal moves for `s.turn` (step moves + general captures),
 *  BEFORE the own-general-safety filter. */
export function pseudoMoves(s: CctState): Move[] {
  const moves: Move[] = [];
  const me = s.turn;
  for (let i = 0; i < 25; i++) {
    const p = s.cells[i];
    if (!belongsTo(p, me)) continue;
    for (const j of NEIGHBORS[i]) {
      if (s.cells[j] === EMPTY) moves.push({ from: i, to: j, capture: false });
    }
    if (isGeneral(p)) {
      for (const t of generalCapturesFrom(s.cells, i, me)) {
        moves.push({ from: i, to: t, capture: true });
      }
    }
  }
  return moves;
}

export function applyMove(s: CctState, m: Move): CctState {
  const cells = s.cells.slice();
  const piece = cells[m.from];
  cells[m.from] = EMPTY;
  cells[m.to] = piece;
  return { cells, turn: other(s.turn), plies: s.plies + 1 };
}

/** Fully legal moves: pseudo moves that do not leave the mover's own
 *  general under enemy jump-threat. */
export function legalMoves(s: CctState): Move[] {
  const me = s.turn;
  const out: Move[] = [];
  for (const m of pseudoMoves(s)) {
    const after = applyMove(s, m);
    if (!isGeneralThreatened(after, me)) out.push(m);
  }
  return out;
}

/* ---------------- status ---------------- */

export function gameStatus(s: CctState): GameResult {
  // A captured general ends the game at once (only reachable in crafted
  // positions — legal play ends by checkmate first).
  if (!hasGeneral(s, "r")) return { outcome: "win", winner: "g", reason: "checkmate" };
  if (!hasGeneral(s, "g")) return { outcome: "win", winner: "r", reason: "checkmate" };
  // Draw first: no screens left on either side → nobody can ever capture.
  if (countSoldiers(s, "r") === 0 && countSoldiers(s, "g") === 0) {
    return { outcome: "draw", reason: "no-screens" };
  }
  const moves = legalMoves(s);
  if (moves.length === 0) {
    const threatened = isGeneralThreatened(s, s.turn);
    return {
      outcome: "win",
      winner: other(s.turn),
      reason: threatened ? "checkmate" : "stalemate",
    };
  }
  return { outcome: "ongoing" };
}

export function perft(s: CctState, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const m of legalMoves(s)) nodes += perft(applyMove(s, m), depth - 1);
  return nodes;
}

/* ---------------- presentation helpers ---------------- */

/** `T 3,5 × 2,4` / `L 1,4 → 1,3` — needs the PRE-move state. */
export function moveLabel(s: CctState, m: Move): string {
  const [fc, fr] = coordOf(m.from);
  const [tc, tr] = coordOf(m.to);
  const kind = isGeneral(s.cells[m.from]) ? "T" : "L";
  const arrow = m.capture ? "×" : "→";
  return `${kind} ${fc},${fr} ${arrow} ${tc},${tr}`;
}

export function sideName(s: Side, lang: "vi" | "en"): string {
  if (lang === "vi") return s === "r" ? "Đỏ" : "Xanh";
  return s === "r" ? "Red" : "Green";
}
