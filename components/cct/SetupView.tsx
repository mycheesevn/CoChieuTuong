"use client";

import { useMemo, useState } from "react";
import Board from "./Board";
import {
  EMPTY,
  G_GENERAL,
  G_SOLDIER,
  R_GENERAL,
  R_SOLDIER,
  initialState,
  stateToPos,
  validatePos,
  type Cell,
  type Side,
} from "@/lib/cct/engine";
import { STR, levelName, type Lang } from "@/lib/cct/i18n";

interface Props {
  lang: Lang;
  /** The app's shared play-config difficulty (AppShell state) — the setup
   *  form edits it directly, so the custom game starts at this level. */
  level: number;
  onLevelChange: (n: number) => void;
  onPlayCustom: (pos: string, turn: Side) => void;
}

type Tool =
  | { kind: "move" }
  | { kind: "erase" }
  | { kind: "place"; cell: Cell };

const PALETTE: Cell[] = [R_SOLDIER, R_GENERAL, G_SOLDIER, G_GENERAL];

function Disc({ cell }: { cell: Cell }) {
  const red = cell === R_SOLDIER || cell === R_GENERAL;
  const gen = cell === R_GENERAL || cell === G_GENERAL;
  const fill = red ? "#A52330" : "#156147";
  const ring = red ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.35)";
  const r = gen ? 16 : 13;
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <circle
        cx={18}
        cy={18}
        r={r}
        fill={fill}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={1.5}
      />
      <circle
        cx={18}
        cy={18}
        r={r - 3.5}
        fill="none"
        stroke={ring}
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function SetupView({ lang, level, onLevelChange, onPlayCustom }: Props) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [tab, setTab] = useState<"editor" | "play">("editor");
  const [cells, setCells] = useState<Cell[]>(() => initialState().cells.slice());
  const [tool, setTool] = useState<Tool>({ kind: "move" });
  const [lifted, setLifted] = useState<number | null>(null);
  const [turn, setTurn] = useState<Side>("r");
  const [error, setError] = useState<string | null>(null);

  /** Stable identities per square for the setup editor (positions are
   *  edited, not replayed — square index is a fine id here). */
  const instances = useMemo(() => {
    const m = new Map<number, number>();
    cells.forEach((c, i) => {
      if (c !== EMPTY) m.set(i, i);
    });
    return m;
  }, [cells]);

  const onPoint = (i: number) => {
    setError(null);
    if (tool.kind === "place") {
      const cell = tool.cell;
      setCells((prev) => {
        const next = prev.slice() as Cell[];
        next[i] = cell;
        return next;
      });
      setLifted(null);
      return;
    }
    if (tool.kind === "erase") {
      setCells((prev) => {
        const next = prev.slice() as Cell[];
        next[i] = EMPTY;
        return next;
      });
      setLifted(null);
      return;
    }
    // Move tool: tap a piece to lift, tap a target to drop (replaces any
    // piece already there), tap the same square to cancel.
    if (lifted !== null) {
      if (lifted === i) {
        setLifted(null);
        return;
      }
      const from = lifted;
      setCells((prev) => {
        const next = prev.slice() as Cell[];
        next[i] = prev[from];
        next[from] = EMPTY;
        return next;
      });
      setLifted(null);
    } else if (cells[i] !== EMPTY) {
      setLifted(i);
    }
  };

  const toolActive = (candidate: Tool) =>
    tool.kind === candidate.kind &&
    (candidate.kind !== "place" ||
      (tool.kind === "place" && tool.cell === candidate.cell));

  const chooseTool = (next: Tool) => {
    setTool(next);
    setLifted(null);
    setError(null);
  };

  const pieceName = (cell: Cell) =>
    cell === R_SOLDIER || cell === G_SOLDIER
      ? String(s.soldier)
      : String(s.general);
  const sideName = (cell: Cell) =>
    cell === R_SOLDIER || cell === R_GENERAL
      ? String(s.red)
      : String(s.green);

  const hint =
    tool.kind === "move"
      ? String(s.setupHintMove)
      : tool.kind === "erase"
        ? String(s.setupHintErase)
        : String(s.setupHintPlace);

  const reset = () => {
    setCells(initialState().cells.slice());
    setLifted(null);
    setError(null);
  };

  const clear = () => {
    setCells(new Array(25).fill(EMPTY) as Cell[]);
    setLifted(null);
    setError(null);
  };

  const start = () => {
    const err = validatePos({ cells, turn, plies: 0 });
    if (err === "generals") {
      setError(String(s.setupErrGenerals));
      return;
    }
    if (err === "soldiers") {
      setError(String(s.setupErrSoldiers));
      return;
    }
    if (err === "check") {
      setError(String(s.setupErrCheck));
      return;
    }
    setError(null);
    onPlayCustom(stateToPos(cells), turn);
  };

  return (
    <div className="cct-layout">
        <div className="cct-board-area">
          <div className="cct-board-fit">
            <Board
              state={{ cells, turn, plies: 0 }}
              interactive
              flipped={false}
              sel={lifted}
              targets={[]}
              lastMove={null}
              threatened={null}
              captureFlash={null}
              instances={instances}
              onPoint={onPoint}
            />
          </div>
        </div>

        <aside className="cct-panel cct-setup-panel">
          <div className="cct-lb-tabs">
            <button
              type="button"
              className={tab === "editor" ? "active" : ""}
              onClick={() => setTab("editor")}
            >
              🧩 {String(s.setupEditor)}
            </button>
            <button
              type="button"
              className={tab === "play" ? "active" : ""}
              onClick={() => setTab("play")}
            >
              ▶ {String(s.setupPlay)}
            </button>
          </div>

          {tab === "editor" ? (
            <>
              <div>
                <h2 className="cct-setup-title">🧩 {String(s.setup)}</h2>
                <p className="cct-hint">{hint}</p>
              </div>

              <section>
                <h3>{String(s.setupTools)}</h3>
                <div className="cct-palette">
                  <button
                    type="button"
                    className={`cct-palbtn cct-palbtn-tool${
                      tool.kind === "move" ? " active" : ""
                    }`}
                    onClick={() => chooseTool({ kind: "move" })}
                    aria-pressed={tool.kind === "move"}
                    title={String(s.setupMove)}
                  >
                    ✥ <span>{String(s.setupMove)}</span>
                  </button>
                  <button
                    type="button"
                    className={`cct-palbtn cct-palbtn-tool${
                      tool.kind === "erase" ? " active" : ""
                    }`}
                    onClick={() => chooseTool({ kind: "erase" })}
                    aria-pressed={tool.kind === "erase"}
                    title={String(s.setupErase)}
                  >
                    🧽 <span>{String(s.setupErase)}</span>
                  </button>
                </div>
                <div className="cct-palette" aria-label={String(s.setupPlace)}>
                  {PALETTE.map((cell) => {
                    const candidate: Tool = { kind: "place", cell };
                    const active = toolActive(candidate);
                    return (
                      <button
                        key={cell}
                        type="button"
                        className={`cct-palbtn${active ? " active" : ""}`}
                        onClick={() => chooseTool(candidate)}
                        aria-pressed={active}
                        title={`${sideName(cell)} · ${pieceName(cell)}`}
                      >
                        <Disc cell={cell} />
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="cct-setup-actions">
                <button type="button" className="cct-btn" onClick={reset}>
                  {String(s.setupReset)}
                </button>
                <button type="button" className="cct-btn" onClick={clear}>
                  {String(s.setupClear)}
                </button>
              </div>
            </>
          ) : (
            <section>
              <div className="cct-setup-form">
                <label className="cct-field">
                  <span>{String(s.level)}</span>
                  <select
                    className="cct-select"
                    value={level}
                    onChange={(e) => onLevelChange(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((l) => (
                      <option key={l} value={l}>
                        {levelName(lang, l)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cct-field">
                  <span>{String(s.setupTurn)}</span>
                  <select
                    className="cct-select"
                    value={turn}
                    onChange={(e) => setTurn(e.target.value as Side)}
                  >
                    <option value="r">{String(s.setupFirstRed)}</option>
                    <option value="g">{String(s.setupFirstGreen)}</option>
                  </select>
                </label>
              </div>

              {error && (
                <p className="cct-error cct-setup-error" role="alert">
                  {error}
                </p>
              )}

              <div className="cct-setup-actions">
                <button
                  type="button"
                  className="cct-btn cct-btn-primary"
                  onClick={start}
                >
                  ▶ {String(s.setupStart)}
                </button>
              </div>
            </section>
          )}
        </aside>
    </div>
  );
}
