"use client";

import { useMemo, useState } from "react";
import Board from "./Board";
import { STR, type Lang } from "@/lib/cct/i18n";
import { PUZZLES, puzzleForDate, type CctPuzzle } from "@/lib/cct/puzzles";
import { parseCanonMove } from "@/lib/cct/canon";
import {
  applyMove,
  gameStatus,
  isGeneralThreatened,
  legalMoves,
  posToState,
  type CctState,
  type Move,
  type Side,
} from "@/lib/cct/engine";
import { playCapture, playCheck, playMove, playSelect, playWin } from "@/lib/cct/sound";
import { renderShareCard, sharePng } from "@/lib/cct/shareCard";

const STREAK_KEY = "cct-puzzle-streak";

interface Streak {
  date: string; // YYYY-MM-DD (local)
  streak: number;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function loadStreak(): Streak {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) {
      const j = JSON.parse(raw) as Streak;
      if (typeof j.streak === "number" && typeof j.date === "string") return j;
    }
  } catch {
    /* ignore */
  }
  return { date: "", streak: 0 };
}

/** Record today's solve; returns the updated streak. */
export function recordDailySolve(today: string): Streak {
  const prev = loadStreak();
  let streak = 1;
  if (prev.date === today) {
    streak = prev.streak; // already solved today
  } else {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    streak = prev.date === dayKey(y) ? prev.streak + 1 : 1;
  }
  const next = { date: today, streak };
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

const belongsTo = (cell: number, side: Side): boolean =>
  side === "r" ? cell === 1 || cell === 2 : cell === 3 || cell === 4;

export function PuzzleView({ lang }: { lang: Lang }) {
  const s = STR[lang] as Record<string, string | string[]>;
  const puzzle = useMemo(() => puzzleForDate(new Date()), []);
  const [state, setState] = useState<CctState>(() => {
    const st = posToState(puzzle.pos, puzzle.turn);
    if (!st) throw new Error(`invalid puzzle pos ${puzzle.id}`);
    return st;
  });
  const [sel, setSel] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<"bad" | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [streak, setStreak] = useState<Streak>(() => loadStreak());
  const [sharing, setSharing] = useState(false);

  const solver = puzzle.turn;

  const moves = useMemo(() => (solved ? [] : legalMoves(state)), [state, solved]);
  const threatened: Side | null =
    !solved && isGeneralThreatened(state, state.turn) ? state.turn : null;
  const targets = useMemo(
    () => (sel === null ? [] : moves.filter((m) => m.from === sel)),
    [moves, sel]
  );
  const instances = useMemo(() => {
    const m = new Map<number, number>();
    for (let i = 0; i < 25; i++) if (state.cells[i] !== 0) m.set(i, i);
    return m;
  }, [state]);

  const solMoves = useMemo(
    () => puzzle.solution.map(parseCanonMove),
    [puzzle]
  );
  // Number of solver moves played so far (scripted replies auto-played).
  const [pliesDone, setPliesDone] = useState(0);

  const finish = (after: CctState) => {
    setState(after);
    setSolved(true);
    playWin();
    const st = recordDailySolve(dayKey(new Date()));
    setStreak(st);
  };

  const doMove = (move: Move) => {
    const after = applyMove(state, move);
    if (move.capture) playCapture();
    else playMove();
    const gs = gameStatus(after);
    if (gs.outcome === "ongoing" && isGeneralThreatened(after, after.turn)) {
      playCheck();
    }
    if (puzzle.mateIn === 1) {
      // Any checkmating move counts.
      if (gs.outcome === "win" && gs.winner === solver) {
        finish(after);
      } else {
        setState(after);
        setFeedback("bad");
        // Revert the wrong attempt after a beat (puzzle position restores).
        setTimeout(() => {
          const st = posToState(puzzle.pos, puzzle.turn);
          if (st) setState(st);
          setSel(null);
          setFeedback(null);
        }, 700);
      }
      return;
    }
    // mate-in-2: guided line — solver moves must match the solution.
    const expected = solMoves[pliesDone];
    if (
      expected &&
      move.from === expected.from &&
      move.to === expected.to
    ) {
      const nextPlies = pliesDone + 1;
      if (nextPlies >= solMoves.length) {
        // Last solver move must checkmate.
        if (gs.outcome === "win" && gs.winner === solver) finish(after);
        else setState(after);
        return;
      }
      setState(after);
      setPliesDone(nextPlies);
      setSel(null);
      // Auto-play the scripted opponent reply.
      const reply = solMoves[nextPlies];
      if (reply) {
        setTimeout(() => {
          const legal = legalMoves(after);
          const rm = legal.find((x) => x.from === reply.from && x.to === reply.to);
          if (rm) {
            const afterReply = applyMove(after, rm);
            setState(afterReply);
            setPliesDone(nextPlies + 1);
            if (rm.capture) playCapture();
            else playMove();
          }
        }, 600);
      }
    } else {
      setFeedback("bad");
      playSelect();
      setTimeout(() => setFeedback(null), 900);
    }
  };

  const onPoint = (i: number) => {
    if (solved) return;
    if (state.turn !== solver) return; // scripted reply is automatic
    if (sel !== null) {
      const m = moves.find((x) => x.from === sel && x.to === i);
      if (m) {
        doMove(m);
        return;
      }
    }
    if (belongsTo(state.cells[i], state.turn)) {
      setSel(sel === i ? null : i);
      playSelect();
      setFeedback(null);
    } else {
      setSel(null);
    }
  };

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await renderShareCard({
        state,
        headline: `🧩 ${String(s.puzzleSolved).replace("🎉 ", "")}`,
        subline: `${String(s.puzzleStreak)} ${streak.streak} ${String(s.puzzleDays)}`,
        appName: lang === "vi" ? "Cờ Chiếu Tướng" : "Vietnamese General Check",
        appUrl: "cochieutuong-my-cheese-vn.vercel.app",
      });
      await sharePng(blob, String(s.puzzleShare), String(s.puzzleShareText));
    } catch {
      /* best-effort */
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="cct-scroll-area">
      <div className="cct-view">
        <h2>{String(s.puzzle)}</h2>
        <div className="cct-puzzle-streak">
          <span>
            🔥 {String(s.puzzleStreak)}: <strong>{streak.streak}</strong>{" "}
            {String(s.puzzleDays)}
          </span>
          <span className="cct-hint">
            {puzzle.title[lang]} ·{" "}
            {puzzle.mateIn === 1 ? String(s.puzzleMateIn1) : String(s.puzzleMateIn2)}
          </span>
        </div>
        <div className="cct-board-area">
          <div className="cct-board-fit">
            <Board
              state={state}
              interactive={!solved && state.turn === solver}
              sel={sel}
              targets={targets}
              lastMove={null}
              threatened={threatened}
              captureFlash={null}
              instances={instances}
              onPoint={onPoint}
            />
          </div>
        </div>
        <div className="cct-panel" style={{ marginTop: 8 }}>
          {!solved && (
            <>
              <p style={{ fontWeight: 600 }}>{String(s.puzzleSolvePrompt)}</p>
              {feedback === "bad" && (
                <p className="cct-lib-feedback bad">✗ {String(s.puzzleWrong)}</p>
              )}
              {!showSolution ? (
                <button
                  type="button"
                  className="cct-btn small"
                  onClick={() => setShowSolution(true)}
                >
                  {String(s.puzzleShowSolution)}
                </button>
              ) : (
                <p className="cct-hint">
                  {String(s.puzzleSolution)}:{" "}
                  {puzzle.solution
                    .filter((_, i) => i % 2 === 0 || puzzle.mateIn === 1)
                    .join(" · ")}
                </p>
              )}
            </>
          )}
          {solved && (
            <>
              <p style={{ fontWeight: 700 }}>{String(s.puzzleSolved)}</p>
              <p className="cct-hint">
                🔥 {String(s.puzzleStreak)}: {streak.streak} {String(s.puzzleDays)}
              </p>
              <button
                type="button"
                className="cct-btn"
                disabled={sharing}
                onClick={share}
              >
                {String(s.puzzleShare)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
