// Engine tests for Cờ Chiếu Tướng. Compiles lib/cct/engine.ts with the
// project's tsc (ESM output) and runs assertions in plain node.
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = mkdtempSync(join(tmpdir(), "cct-eng-"));
execSync(
  `npx tsc lib/cct/engine.ts --outDir ${OUT} --module es2022 --target es2022 ` +
    `--moduleResolution bundler --declaration false --sourceMap false --strict false`,
  { cwd: ROOT, stdio: "inherit" }
);
const E = await import(join(OUT, "engine.js"));

let pass = 0;
function ok(cond, name, extra = "") {
  if (!cond) {
    console.error(`FAIL: ${name} ${extra}`);
    process.exitCode = 1;
  } else {
    pass++;
    console.log(`ok: ${name}${extra ? " — " + extra : ""}`);
  }
}

/** Build a state from a list of [idx, cell] placements + turn. */
function mkState(placements, turn = "r") {
  const cells = new Array(25).fill(E.EMPTY);
  for (const [i, c] of placements) cells[i] = c;
  return { cells, turn, plies: 0 };
}
const has = (moves, from, to, capture) =>
  moves.some(
    (m) =>
      m.from === from &&
      m.to === to &&
      (capture === undefined || m.capture === capture)
  );

// ---- 1. perft from start ----
{
  const s0 = E.initialState();
  const p1 = E.perft(s0, 1);
  // 9 soldier steps, no captures: the capture span must be three
  // CONSECUTIVE points (general–own soldier–enemy, no empty point, no
  // second screen — user-confirmed 2026-10-13), and the opening center
  // file has an empty point beyond the screen, so nothing is capturable.
  ok(p1 === 9, "perft(start,1) === 9", `got ${p1}`);
  ok(
    E.legalMoves(s0).every((m) => !m.capture),
    "start: no capture moves available"
  );
  const p2 = E.perft(s0, 2);
  const p3 = E.perft(s0, 3);
  console.log(`info: perft(start) d1=${p1} d2=${p2} d3=${p3}`);
  ok(p2 > 0 && p3 > 0, "perft d2/d3 positive");
  ok(E.gameStatus(s0).outcome === "ongoing", "start status ongoing");
}

// ---- 2. jump captures (consecutive triple: general–screen–enemy) ----
// A: screen + enemy beyond → capture generated
{
  const s = mkState([
    [12, E.R_GENERAL], // (3,3)
    [17, E.R_SOLDIER], // (3,4) screen
    [22, E.G_SOLDIER], // (3,5) target
    [0, E.G_GENERAL],
  ]);
  const pm = E.pseudoMoves(s);
  ok(has(pm, 12, 22, true), "A: jump capture generated (screen + enemy)");
  const lm = E.legalMoves(s);
  ok(has(lm, 12, 22, true), "A: jump capture is legal");
}
// B: enemy piece FIRST on the ray → no capture
{
  const s = mkState([
    [12, E.R_GENERAL],
    [17, E.G_SOLDIER], // enemy first — no screen
    [22, E.R_SOLDIER],
    [0, E.G_GENERAL],
  ]);
  ok(!has(E.pseudoMoves(s), 12, 22, true), "B: enemy first on ray → no capture");
  ok(!has(E.pseudoMoves(s), 12, 17, true), "B: no capture of the first piece either");
}
// C: second own piece beyond the screen → no capture
{
  const s = mkState([
    [12, E.R_GENERAL],
    [17, E.R_SOLDIER], // screen
    [22, E.R_SOLDIER], // own beyond
    [0, E.G_GENERAL],
  ]);
  ok(!has(E.pseudoMoves(s), 12, 22, true), "C: own piece beyond screen → no capture");
}
// D: diagonal-ray capture at an even point
{
  const s = mkState([
    [10, E.R_GENERAL], // (1,3) even
    [16, E.R_SOLDIER], // (2,4) screen on the diagonal
    [22, E.G_SOLDIER], // (3,5) diagonal target
    [4, E.G_GENERAL],
  ]);
  ok(has(E.pseudoMoves(s), 10, 22, true), "D: diagonal jump capture generated");
  ok(has(E.legalMoves(s), 10, 22, true), "D: diagonal jump capture legal");
}
// E: adjacent enemy is NOT capturable without a screen
{
  const s = mkState([
    [12, E.R_GENERAL],
    [13, E.G_SOLDIER], // adjacent enemy, no screen anywhere
    [0, E.G_GENERAL],
  ]);
  ok(!has(E.pseudoMoves(s), 12, 13), "E: general cannot capture adjacent piece");
}
// F: soldier never captures (jump rays are general-only)
{
  const s = mkState([
    [12, E.R_SOLDIER],
    [17, E.R_SOLDIER], // would-be screen
    [22, E.G_SOLDIER],
    [0, E.G_GENERAL],
    [20, E.R_GENERAL],
  ]);
  const soldierCaptures = E.pseudoMoves({ ...s, turn: "r" }).filter(
    (m) => m.from === 12 && m.capture
  );
  ok(soldierCaptures.length === 0, "F: soldier generates no captures");
}

// G: empty point between screen and target → no capture (no gaps allowed)
{
  const s = mkState([
    [2, E.R_GENERAL], // (3,1)
    [7, E.R_SOLDIER], // (3,2) screen
    // (3,3)=12 EMPTY — gap
    [17, E.G_SOLDIER], // (3,4) would-be target across the gap
    [24, E.G_GENERAL],
  ]);
  ok(!has(E.pseudoMoves(s), 2, 17, true), "G: gap beyond screen → no capture");
}
// H: empty point between general and screen → no capture
{
  const s = mkState([
    [12, E.R_GENERAL], // (3,3)
    // (3,4)=17 EMPTY — gap before the screen
    [22, E.R_SOLDIER], // (3,5) would-be screen
    [20, E.G_GENERAL],
    [24, E.G_SOLDIER],
  ]);
  ok(
    E.generalCapturesFrom(s.cells, 12, "r").length === 0,
    "H: gap before screen → no captures at all"
  );
}
// I: TWO own soldiers in a row then enemy → no capture (only 1 screen allowed)
{
  const s = mkState([
    [2, E.R_GENERAL], // (3,1)
    [7, E.R_SOLDIER], // (3,2) screen 1
    [12, E.R_SOLDIER], // (3,3) screen 2
    [17, E.G_SOLDIER], // (3,4) enemy behind two screens
    [24, E.G_GENERAL],
  ]);
  ok(!has(E.pseudoMoves(s), 2, 17, true), "I: two screens in the span → no capture");
}

// ---- 3. check: only resolving moves are legal ----
// green general (1,3)=10, green screen (2,4)=16, red general (3,5)=22 → red in check.
// red soldier at (1,4)=15 has a pseudo-move 15→20 that does NOT resolve.
{
  const s2 = mkState([
    [10, E.G_GENERAL],
    [16, E.G_SOLDIER],
    [22, E.R_GENERAL],
    [15, E.R_SOLDIER],
    [0, E.R_SOLDIER],
  ]);
  ok(E.isGeneralThreatened(s2, "r"), "check: red general is threatened");
  const lm = E.legalMoves(s2);
  // (3,5) escapes to (4,5),(1,5),(3,4),(4,4); the (1,4)→(1,5) soldier
  // move does not resolve the check and must be excluded.
  const tos = lm.map((m) => m.to).sort((a, b) => a - b);
  ok(
    lm.length === 4 &&
      lm.every((m) => m.from === 22) &&
      JSON.stringify(tos) === JSON.stringify([17, 18, 21, 23]),
    "check: only the 4 general escapes survive",
    `got [${lm.map((m) => `${m.from}→${m.to}`).join(", ")}]`
  );
  ok(!has(lm, 15, 20), "check: non-resolving soldier move excluded");
  for (const m of lm) {
    const after = E.applyMove(s2, m);
    ok(!E.isGeneralThreatened(after, "r"), `check: move ${m.from}→${m.to} resolves`);
  }
}

// ---- 4a. checkmate ----
{
  const s = mkState([
    [22, E.R_GENERAL],
    [17, E.R_SOLDIER],
    [21, E.R_SOLDIER],
    [23, E.R_SOLDIER],
    [18, E.R_SOLDIER],
    [10, E.G_GENERAL],
    [16, E.G_SOLDIER],
  ]);
  ok(E.isGeneralThreatened(s, "r"), "mate: red in check");
  ok(E.legalMoves(s).length === 0, "mate: no legal moves");
  const st = E.gameStatus(s);
  ok(
    st.outcome === "win" && st.winner === "g" && st.reason === "checkmate",
    "mate: status = green wins by checkmate",
    JSON.stringify(st)
  );
}

// ---- 4b. stalemate (no moves, not in check → loss) ----
// Red: lone general on (3,3), all 8 neighbours held by green soldiers
// (no red soldiers → the general has no screen → no captures possible).
// Green general on (2,1): not aligned with (3,3) on any ray → no check.
{
  const s = mkState([
    [12, E.R_GENERAL],
    [6, E.G_SOLDIER],
    [7, E.G_SOLDIER],
    [8, E.G_SOLDIER],
    [11, E.G_SOLDIER],
    [13, E.G_SOLDIER],
    [16, E.G_SOLDIER],
    [17, E.G_SOLDIER],
    [18, E.G_SOLDIER],
    [5, E.G_GENERAL],
  ]);
  ok(!E.isGeneralThreatened(s, "r"), "stale: red NOT in check");
  ok(E.legalMoves(s).length === 0, "stale: no legal moves");
  const st = E.gameStatus(s);
  ok(
    st.outcome === "win" && st.winner === "g" && st.reason === "stalemate",
    "stale: status = green wins by stalemate",
    JSON.stringify(st)
  );
}

// ---- 5. draw: both sides out of soldiers ----
{
  const s = mkState([
    [0, E.R_GENERAL],
    [24, E.G_GENERAL],
  ]);
  const st = E.gameStatus(s);
  ok(
    st.outcome === "draw" && st.reason === "no-screens",
    "draw: lone generals → draw",
    JSON.stringify(st)
  );
  // one side still has a soldier → NOT a draw
  const s2 = mkState([
    [0, E.R_GENERAL],
    [24, E.G_GENERAL],
    [12, E.G_SOLDIER],
  ]);
  ok(E.gameStatus(s2).outcome === "ongoing", "no draw while a soldier remains");
}

// ---- 6. fuzz: 100 random games ----
{
  let seed = 0xC0FFEE;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const dist = { redWin: 0, greenWin: 0, draw: 0, timeout: 0 };
  for (let g = 0; g < 100; g++) {
    let s = E.initialState();
    let plies = 0;
    for (;;) {
      const st = E.gameStatus(s);
      if (st.outcome !== "ongoing") {
        if (st.outcome === "win") dist[st.winner === "r" ? "redWin" : "greenWin"]++;
        else dist.draw++;
        break;
      }
      if (plies >= 600) {
        dist.timeout++;
        break;
      }
      const moves = E.legalMoves(s);
      if (moves.length === 0) throw new Error(`game ${g}: ongoing but no moves`);
      const m = moves[Math.floor(rnd() * moves.length)];
      s = E.applyMove(s, m);
      plies++;
    }
    // generals are never captured in legal play
    const gens = s.cells.filter((c) => c === E.R_GENERAL || c === E.G_GENERAL);
    if (gens.length !== 2) throw new Error(`game ${g}: general missing`);
  }
  console.log(`info: fuzz 100 games → ${JSON.stringify(dist)}`);
  ok(dist.redWin + dist.greenWin + dist.draw + dist.timeout === 100, "fuzz: 100 games completed");
}

// ---- 8. degenerate: general actually captured (crafted en-prise) ----
// Unreachable in legal play (mate ends it first), but the engine must
// stay total: the capture is legal and ends the game immediately.
{
  const s = mkState([
    [10, E.G_GENERAL],
    [16, E.G_SOLDIER], // screen
    [22, E.R_GENERAL], // en-prise target
    [0, E.R_SOLDIER],
    [4, E.R_SOLDIER],
  ]);
  s.turn = "g";
  const lm = E.legalMoves(s);
  ok(has(lm, 10, 22, true), "degenerate: general-vs-general capture is legal");
  const after = E.applyMove(
    s,
    lm.find((m) => m.from === 10 && m.to === 22)
  );
  ok(!E.hasGeneral(after, "r"), "degenerate: red general gone after capture");
  const st = E.gameStatus(after);
  ok(
    st.outcome === "win" && st.winner === "g",
    "degenerate: capturing the general wins at once",
    JSON.stringify(st)
  );
  ok(E.isGeneralThreatened(after, "g") === false, "degenerate: threat check total");
}

// ---- 9. labels ----
{
  const s0 = E.initialState();
  const m = E.legalMoves(s0).find((x) => x.from === 15); // (1,4) → (1,3)
  ok(!!m && E.moveLabel(s0, m) === "L 1,4 → 1,3", "label: soldier step");
  const cap = mkState([
    [12, E.R_GENERAL],
    [17, E.R_SOLDIER],
    [22, E.G_SOLDIER],
    [0, E.G_GENERAL],
  ]);
  const cm = E.legalMoves(cap).find((x) => x.capture);
  ok(!!cm && E.moveLabel(cap, cm) === "T 3,3 × 3,5", "label: general capture");
}

console.log(`\n${pass} assertions passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
