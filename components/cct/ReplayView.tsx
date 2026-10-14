"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board";
import { STR, type Lang } from "@/lib/cct/i18n";
import {
  buildReplayStates,
  type ReplayGame,
  type ReplayPly,
} from "@/lib/cct/replay";
import { isGeneralThreatened } from "@/lib/cct/engine";

interface Props {
  lang: Lang;
  game: ReplayGame;
  onBack: () => void;
  /** Called with the replay game to open video export. */
  onExportVideo?: (g: ReplayGame) => void;
}

/** Step through a recorded game: prev/play/next/slider/jump-to-end + move list. */
export function ReplayView({ lang, game, onBack, onExportVideo }: Props) {
  const s = STR[lang] as Record<string, string | string[]>;
  const { states, plies } = useMemo(() => buildReplayStates(game), [game]);
  const total = plies.length;
  const [ply, setPly] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setPly(0);
    setAutoplay(false);
  }, [game]);

  useEffect(() => {
    if (!autoplay) return;
    if (ply >= total) {
      setAutoplay(false);
      return;
    }
    timer.current = window.setTimeout(() => setPly((p) => p + 1), 800);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [autoplay, ply, total]);

  const state = states[Math.min(ply, states.length - 1)];
  const lastPly: ReplayPly | null = ply > 0 ? plies[ply - 1] : null;
  const threatened =
    state && isGeneralThreatened(state, state.turn) ? state.turn : null;

  return (
    <div className="cct-layout">
      <div className="cct-board-area">
        <div className="cct-board-fit">
          <Board
            state={state}
            interactive={false}
            sel={null}
            targets={[]}
            lastMove={lastPly ? lastPly.move : null}
            threatened={threatened}
            captureFlash={null}
            instances={(() => {
              const m = new Map<number, number>();
              for (let i = 0; i < 25; i++)
                if (state.cells[i] !== 0) m.set(i, i);
              return m;
            })()}
            onPoint={() => {}}
          />
        </div>
      </div>

      <aside className="cct-panel">
        <button type="button" className="cct-btn small" onClick={onBack}>
          ← {String(s.history)}
        </button>
        <h2>🎞️ {game.title}</h2>
        <p className="cct-hint">{game.subtitle}</p>

        <div className="cct-replay-controls">
          <button
            type="button"
            className="cct-btn small"
            disabled={ply === 0}
            onClick={() => setPly(0)}
            aria-label="Start"
          >
            ⏮
          </button>
          <button
            type="button"
            className="cct-btn small"
            disabled={ply === 0}
            onClick={() => setPly((p) => Math.max(0, p - 1))}
            aria-label="Previous"
          >
            ◀
          </button>
          <span className="cct-replay-count">
            {ply} / {total}
          </span>
          <button
            type="button"
            className="cct-btn small"
            disabled={ply >= total}
            onClick={() => setPly((p) => Math.min(total, p + 1))}
            aria-label="Next"
          >
            ▶
          </button>
          <button
            type="button"
            className="cct-btn small"
            disabled={ply >= total}
            onClick={() => setPly(total)}
            aria-label="End"
          >
            ⏭
          </button>
          <button
            type="button"
            className="cct-btn small"
            disabled={ply >= total && !autoplay}
            onClick={() => setAutoplay((a) => !a)}
          >
            {autoplay ? String(s.replayPause) : String(s.replayAuto)}
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={total}
          value={ply}
          onChange={(e) => {
            setAutoplay(false);
            setPly(Number(e.target.value));
          }}
          className="cct-replay-slider"
          aria-label={String(s.replayProgress)}
        />

        {plies.length > 0 && (
          <>
            <h3>{String(s.replayMoves)}</h3>
            <ol className="cct-replay-moves">
              {plies.map((p, i) => (
                <li
                  key={i}
                  className={i === ply - 1 ? "active" : ""}
                  onClick={() => {
                    setAutoplay(false);
                    setPly(i + 1);
                  }}
                >
                  <span className="cct-replay-ply-num">{i + 1}.</span>{" "}
                  {p.label}
                  {p.capture ? " ⚔️" : ""}
                  {p.mate ? " #️⃣" : p.check ? " ♯" : ""}
                </li>
              ))}
            </ol>
          </>
        )}

        {onExportVideo && total > 0 && (
          <button
            type="button"
            className="cct-btn"
            onClick={() => onExportVideo(game)}
            style={{ marginTop: 8 }}
          >
            🎬 {String(s.videoExport)}
          </button>
        )}
      </aside>
    </div>
  );
}
