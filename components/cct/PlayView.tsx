"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Board, { usePieceInstances } from "./Board";
import {
  applyMove,
  countSoldiers,
  gameStatus,
  isGeneralThreatened,
  legalMoves,
  moveLabel,
  initialState,
  type CctState,
  type GameResult,
  type Move,
  type Side,
} from "@/lib/cct/engine";
import { aiReply } from "@/lib/cct/ai";
import {
  playCapture,
  playCheck,
  playLose,
  playMove,
  playSelect,
  playWin,
} from "@/lib/cct/sound";
import { STR, type Lang } from "@/lib/cct/i18n";

export interface ViewActions {
  undo: () => void;
  newGame: () => void;
  canUndo: boolean;
  canNewGame: boolean;
}

interface HistEntry {
  state: CctState;
  move: Move | null;
}

const freshHist = (): HistEntry[] => [{ state: initialState(), move: null }];

export function reasonText(s: Record<string, string | string[]>, r: GameResult): string {
  if (r.outcome === "win") {
    if (r.reason === "checkmate") return String(s.reasonCheckmate);
    if (r.reason === "stalemate") return String(s.reasonStalemate);
    return String(s.reasonResign);
  }
  if (r.outcome === "draw") return String(s.reasonNoScreens);
  return "";
}

export function CapturedRow({
  s,
  cur,
}: {
  s: Record<string, string | string[]>;
  cur: CctState;
}) {
  const redLost = 9 - countSoldiers(cur, "r");
  const greenLost = 9 - countSoldiers(cur, "g");
  const dots = (n: number, color: string) =>
    Array.from({ length: Math.max(0, n) }, (_, i) => (
      <span
        key={i}
        className="cct-mini-disc"
        style={{ background: color }}
      />
    ));
  return (
    <div className="cct-captured">
      <div className="cct-captured-row">
        <span>{s.capturedByRed}:</span>
        {dots(greenLost, "#1C6B4C")}
      </div>
      <div className="cct-captured-row">
        <span>{s.capturedByGreen}:</span>
        {dots(redLost, "#B3242F")}
      </div>
    </div>
  );
}

export function MoveLog({
  s,
  hist,
}: {
  s: Record<string, string | string[]>;
  hist: HistEntry[];
}) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hist.length]);
  const rows = hist.slice(1).map((h, i) => ({
    n: i + 1,
    label: moveLabel(hist[i].state, h.move as Move),
    capture: (h.move as Move).capture,
  }));
  const pairs: typeof rows[] = [];
  for (let i = 0; i < rows.length; i += 2) pairs.push(rows.slice(i, i + 2));
  return (
    <div className="cct-moves">
      <h3>{String(s.moveList)}</h3>
      <div className="cct-log" ref={logRef}>
        {pairs.length === 0 && (
          <div className="cct-log-empty">{String(s.noMoves)}</div>
        )}
        {pairs.map((p, pi) => (
          <div className="cct-log-row" key={pi}>
            <span className="cct-log-num">{p[0].n}.</span>
            <span className={`cct-log-move${p[0].capture ? " capture" : ""}`}>
              {p[0].label}
            </span>
            {p[1] && (
              <>
                <span className="cct-log-num">{p[1].n}.</span>
                <span
                  className={`cct-log-move${p[1].capture ? " capture" : ""}`}
                >
                  {p[1].label}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PlayViewProps {
  lang: Lang;
  level: number;
  bannerOn: boolean;
  actionsRef: React.MutableRefObject<ViewActions | null>;
  notifyActions: () => void;
}

export default function PlayView({ lang, level, bannerOn, actionsRef, notifyActions }: PlayViewProps) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [hist, setHist] = useState<HistEntry[]>(freshHist);
  const [sel, setSel] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [resignWinner, setResignWinner] = useState<Side | null>(null);
  const [resignArmed, setResignArmed] = useState(false);
  const [flash, setFlash] = useState<{ sq: number; key: number } | null>(null);
  const flashKey = useRef(0);

  const cur = hist[hist.length - 1].state;
  const gs = useMemo(() => gameStatus(cur), [cur]);
  const final: GameResult = resignWinner
    ? { outcome: "win", winner: resignWinner, reason: "resign" }
    : gs;
  const playing = final.outcome === "ongoing";
  const moves = useMemo(
    () => (playing ? legalMoves(cur) : []),
    [cur, playing]
  );
  const threatened: Side | null =
    playing && isGeneralThreatened(cur, cur.turn) ? cur.turn : null;
  const targets = useMemo(
    () => (sel === null ? [] : moves.filter((m) => m.from === sel)),
    [moves, sel]
  );
  const lastMove = hist.length > 1 ? (hist[hist.length - 1].move as Move) : null;
  const moveSeq = useMemo(
    () => hist.slice(1).map((h) => h.move as Move),
    [hist]
  );
  const instances = usePieceInstances(moveSeq);

  const doMove = (move: Move) => {
    const after = applyMove(cur, move);
    setHist((h) => [...h, { state: after, move }]);
    setSel(null);
    if (move.capture) {
      flashKey.current += 1;
      setFlash({ sq: move.to, key: flashKey.current });
      playCapture();
    } else {
      playMove();
    }
    const st = gameStatus(after);
    if (st.outcome === "ongoing" && isGeneralThreatened(after, after.turn)) {
      playCheck();
    }
  };

  const onPoint = (i: number) => {
    if (!playing || thinking) return;
    if (sel !== null) {
      const m = moves.find((x) => x.from === sel && x.to === i);
      if (m) {
        doMove(m);
        return;
      }
    }
    const cell = cur.cells[i];
    const mine = cell === 1 || cell === 2; // red to move (human)
    if (mine && cur.turn === "r") {
      if (sel === i) setSel(null);
      else {
        setSel(i);
        playSelect();
      }
    } else {
      setSel(null);
    }
  };

  const newGame = () => {
    setHist(freshHist());
    setSel(null);
    setThinking(false);
    setResignWinner(null);
    setResignArmed(false);
    setFlash(null);
  };

  const undo = () => {
    if (thinking) return;
    setHist((h) => {
      if (h.length <= 1) return h;
      let nh = h.slice(0, h.length - 1);
      if (nh.length > 1 && nh[nh.length - 1].state.turn === "g") {
        nh = nh.slice(0, nh.length - 1);
      }
      return nh;
    });
    setSel(null);
    setResignWinner(null);
    setResignArmed(false);
  };

  useEffect(() => {
    actionsRef.current = {
      undo,
      newGame,
      canUndo: hist.length > 1 && !thinking,
      canNewGame: true,
    };
    notifyActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist.length, thinking]);

  // AI reply
  useEffect(() => {
    if (!playing || cur.turn !== "g") return;
    setThinking(true);
    const t = setTimeout(
      () => {
        const m = aiReply(cur, level);
        setThinking(false);
        if (m) doMove(m);
      },
      380 + Math.random() * 260
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist, level, playing]);

  // game-over sounds (fire once)
  const prevOutcome = useRef(final.outcome);
  useEffect(() => {
    if (prevOutcome.current === "ongoing" && final.outcome !== "ongoing") {
      if (final.outcome === "win") {
        if (final.winner === "r") playWin();
        else playLose();
      } else {
        playCheck();
      }
    }
    prevOutcome.current = final.outcome;
  }, [final]);

  // resign arm timeout
  useEffect(() => {
    if (!resignArmed) return;
    const t = setTimeout(() => setResignArmed(false), 3500);
    return () => clearTimeout(t);
  }, [resignArmed]);

  const statusText = !playing
    ? ""
    : cur.turn === "r"
      ? String(s.yourTurnRed)
      : thinking
        ? String(s.aiThinking)
        : String(s.yourTurnGreen);

  return (
    <div className="cct-layout">
      <div className="cct-board-area">
        <div className="cct-board-fit">
          <Board
            state={cur}
            interactive={playing && !thinking && cur.turn === "r"}
            sel={sel}
            targets={targets}
            lastMove={lastMove}
            threatened={threatened}
            captureFlash={flash}
            instances={instances}
            onPoint={onPoint}
          />
          {bannerOn && threatened && playing && (
            <div className="cct-check-banner" key={cur.plies}>
              <span>{String(s.checkBanner)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="cct-panel">
        {!playing && (
          <div className="cct-gameover">
            <div className="cct-result">
              {final.outcome === "draw"
                ? String(s.draw)
                : final.outcome === "win" && final.winner === "r"
                  ? String(s.redWins)
                  : String(s.greenWins)}
            </div>
            <div className="cct-reason">{reasonText(s, final)}</div>
            <button className="cct-btn cct-btn-primary" onClick={newGame}>
              {String(s.playAgain)}
            </button>
          </div>
        )}
        <div className={`cct-status${threatened ? " check" : ""}`}>
          <span
            className="cct-turn-dot"
            style={{
              background: !playing
                ? "transparent"
                : cur.turn === "r"
                  ? "#B3242F"
                  : "#1C6B4C",
            }}
          />
          <span>
            {statusText}
            {threatened && playing ? ` • ${String(s.check)}` : ""}
          </span>
          {thinking && <span className="cct-thinking">⏳</span>}
        </div>
        <CapturedRow s={s} cur={cur} />
        <MoveLog s={s} hist={hist} />
        {playing && (
          <div className="cct-actions">
            <button
              className={`cct-btn${resignArmed ? " cct-btn-danger" : ""}`}
              onClick={() => {
                if (resignArmed) {
                  setResignWinner("g");
                  setResignArmed(false);
                } else {
                  setResignArmed(true);
                }
              }}
            >
              {resignArmed ? String(s.resignConfirm) : String(s.resign)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
