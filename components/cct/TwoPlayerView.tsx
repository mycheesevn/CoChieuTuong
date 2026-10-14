"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Board, { usePieceInstances } from "./Board";
import { CapturedRow, MoveLog, reasonText, type ViewActions } from "./PlayView";
import {
  applyMove,
  gameStatus,
  isGeneralThreatened,
  legalMoves,
  initialState,
  type CctState,
  type GameResult,
  type Move,
  type Side,
} from "@/lib/cct/engine";
import {
  playCapture,
  playCheck,
  playLose,
  playMove,
  playSelect,
  playWin,
} from "@/lib/cct/sound";
import { STR, type Lang } from "@/lib/cct/i18n";

interface HistEntry {
  state: CctState;
  move: Move | null;
}

const freshHist = (): HistEntry[] => [{ state: initialState(), move: null }];

const belongsTo = (cell: number, side: Side): boolean =>
  side === "r" ? cell === 1 || cell === 2 : cell === 3 || cell === 4;

interface TwoPlayerViewProps {
  lang: Lang;
  bannerOn: boolean;
  actionsRef: React.MutableRefObject<ViewActions | null>;
  notifyActions: () => void;
}

export default function TwoPlayerView({ lang, bannerOn, actionsRef, notifyActions }: TwoPlayerViewProps) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [hist, setHist] = useState<HistEntry[]>(freshHist);
  const [sel, setSel] = useState<number | null>(null);
  const [flipEachTurn, setFlipEachTurn] = useState(false);
  const [resignWinner, setResignWinner] = useState<Side | null>(null);
  const [resignArmed, setResignArmed] = useState(false);

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
  const moveSeq = useMemo(() => hist.slice(1).map((h) => h.move as Move), [hist]);
  const instances = usePieceInstances(moveSeq);
  const flipped = flipEachTurn && cur.turn === "g";

  const doMove = (move: Move) => {
    const after = applyMove(cur, move);
    setHist((h) => [...h, { state: after, move }]);
    setSel(null);
    if (move.capture) playCapture();
    else playMove();
    const st = gameStatus(after);
    if (st.outcome === "ongoing" && isGeneralThreatened(after, after.turn)) {
      playCheck();
    }
  };

  const onPoint = (i: number) => {
    if (!playing) return;
    if (sel !== null) {
      const m = moves.find((x) => x.from === sel && x.to === i);
      if (m) {
        doMove(m);
        return;
      }
    }
    if (belongsTo(cur.cells[i], cur.turn)) {
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
    setResignWinner(null);
    setResignArmed(false);
  };

  const undo = () => {
    setHist((h) => (h.length > 1 ? h.slice(0, h.length - 1) : h));
    setSel(null);
    setResignWinner(null);
    setResignArmed(false);
  };

  useEffect(() => {
    actionsRef.current = {
      undo,
      newGame,
      canUndo: hist.length > 1,
      canNewGame: true,
    };
    notifyActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist.length]);

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

  useEffect(() => {
    if (!resignArmed) return;
    const t = setTimeout(() => setResignArmed(false), 3500);
    return () => clearTimeout(t);
  }, [resignArmed]);

  return (
    <div className="cct-layout">
      <div className="cct-board-area">
        <div className="cct-board-fit">
          <Board
            state={cur}
            interactive={playing}
            flipped={flipped}
            sel={sel}
            targets={targets}
            lastMove={lastMove}
            threatened={threatened}
            captureFlash={null}
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
            {playing
              ? `${String(s.sideToMove)}: ${cur.turn === "r" ? String(s.red) : String(s.green)}${threatened ? ` • ${String(s.check)}` : ""}`
              : ""}
          </span>
        </div>
        <label className="cct-flip-row cct-check-toggle">
          <input
            type="checkbox"
            checked={flipEachTurn}
            onChange={(e) => setFlipEachTurn(e.target.checked)}
          />
          {String(s.flipBoard)}
        </label>
        <CapturedRow s={s} cur={cur} />
        <MoveLog s={s} hist={hist} />
        {playing && (
          <div className="cct-actions">
            <button
              className={`cct-btn${resignArmed ? " cct-btn-danger" : ""}`}
              onClick={() => {
                if (resignArmed) {
                  setResignWinner(cur.turn === "r" ? "g" : "r");
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
