"use client";

import { useMemo } from "react";
import {
  colOf,
  rowOf,
  type CctState,
  type Move,
  type Side,
  initialState,
  R_GENERAL,
  G_GENERAL,
  R_SOLDIER,
} from "@/lib/cct/engine";

/* Board geometry mirrors ~/workspace/cct-board-mockup.svg (user-approved):
   viewBox 1080, points at 220 + k*170, wood panel 140..980. */
export const VB = 1080;
const P0 = 220;
const STEP = 170;

export function pointXY(i: number, flipped: boolean): [number, number] {
  const x = P0 + colOf(i) * STEP;
  const y = P0 + rowOf(i) * STEP;
  return flipped ? [VB - x, VB - y] : [x, y];
}

/** Stable piece identities across moves so the CSS transform transition
 *  animates steps and jump-captures. Replayed from the move list. */
export function usePieceInstances(moves: Move[]): Map<number, number> {
  return useMemo(() => {
    const s = initialState();
    const sqToId = new Map<number, number>();
    let nextId = 0;
    for (let i = 0; i < 25; i++) {
      if (s.cells[i] !== 0) sqToId.set(i, nextId++);
    }
    for (const m of moves) {
      const id = sqToId.get(m.from);
      if (id === undefined) continue;
      sqToId.delete(m.from);
      sqToId.delete(m.to); // captured piece's identity is retired
      sqToId.set(m.to, id);
    }
    return sqToId;
  }, [moves]);
}

/** The 16 diagonal segments (even-parity points only). */
const DIAGONALS: Array<[number, number]> = [
  [0, 6],
  [2, 6],
  [2, 8],
  [4, 8],
  [6, 10],
  [6, 12],
  [8, 12],
  [8, 14],
  [10, 16],
  [12, 16],
  [12, 18],
  [14, 18],
  [16, 20],
  [16, 22],
  [18, 22],
  [18, 24],
];

const ACCENT = "#e0a32e";
const DANGER = "#e03131";

export interface BoardProps {
  state: CctState;
  interactive: boolean;
  flipped?: boolean;
  sel: number | null;
  targets: Move[];
  lastMove: Move | null;
  /** side whose general is currently threatened (for the red glow) */
  threatened: Side | null;
  captureFlash: { sq: number; key: number } | null;
  instances: Map<number, number>;
  onPoint: (i: number) => void;
}

export default function Board(props: BoardProps) {
  const {
    state,
    interactive,
    flipped = false,
    sel,
    targets,
    lastMove,
    threatened,
    captureFlash,
    instances,
    onPoint,
  } = props;
  const P = (i: number) => pointXY(i, flipped);

  const threatenedSq =
    threatened === "r"
      ? state.cells.indexOf(R_GENERAL)
      : threatened === "g"
        ? state.cells.indexOf(G_GENERAL)
        : -1;

  return (
    <svg
      className="cct-board-svg"
      viewBox={`0 0 ${VB} ${VB}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Cờ Chiếu Tướng board"
    >
      <defs>
        <linearGradient id="cctWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C79A63" />
          <stop offset="1" stopColor="#B0824C" />
        </linearGradient>
        <radialGradient id="cctGreenDisc" cx="0.38" cy="0.34" r="0.95">
          <stop offset="0" stopColor="#1C6B4C" />
          <stop offset="1" stopColor="#0C4230" />
        </radialGradient>
        <radialGradient id="cctRedDisc" cx="0.38" cy="0.34" r="0.95">
          <stop offset="0" stopColor="#B3242F" />
          <stop offset="1" stopColor="#7E1019" />
        </radialGradient>
      </defs>

      {/* wood panel */}
      <rect x={140} y={140} width={840} height={840} rx={16} fill="url(#cctWood)" />
      <rect
        x={140}
        y={140}
        width={840}
        height={840}
        rx={16}
        fill="none"
        stroke="#8A5A24"
        strokeWidth={4}
      />

      {/* coordinate labels */}
      <g
        fontFamily="DejaVu Sans, sans-serif"
        fontWeight={700}
        fontSize={46}
        fill="#1F3A5F"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {[0, 1, 2, 3, 4].map((k) => {
          // P() already mirrors positions when flipped, so the label at a
          // visual position always shows that point's original coordinate.
          const [x] = P(k);
          const [, y] = P(k * 5);
          const col = k + 1;
          const row = k + 1;
          return (
            <g key={k}>
              <text x={x} y={86}>
                {col}
              </text>
              <text x={66} y={y}>
                {row}
              </text>
            </g>
          );
        })}
      </g>

      {/* line web */}
      <g stroke="#2E2A26" strokeWidth={4} strokeLinecap="round">
        {[0, 1, 2, 3, 4].map((k) => {
          const [hx0, hy] = P(k * 5);
          const [hx1] = P(k * 5 + 4);
          const [vx, vy0] = P(k);
          const [, vy1] = P(20 + k);
          return (
            <g key={k}>
              <line x1={hx0} y1={hy} x2={hx1} y2={hy} />
              <line x1={vx} y1={vy0} x2={vx} y2={vy1} />
            </g>
          );
        })}
        {DIAGONALS.map(([a, b]) => {
          const [x1, y1] = P(a);
          const [x2, y2] = P(b);
          return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>

      {/* hollow markers on empty middle-row points (board furniture) */}
      <g fill="#C79A63" stroke="#2E2A26" strokeWidth={4}>
        {[10, 11, 12, 13, 14].map(
          (i) =>
            state.cells[i] === 0 && (
              <circle key={i} cx={P(i)[0]} cy={P(i)[1]} r={11} />
            )
        )}
      </g>

      {/* last-move highlight */}
      {lastMove &&
        [lastMove.from, lastMove.to].map((i) => {
          const [x, y] = P(i);
          return (
            <circle
              key={`lm-${i}`}
              cx={x}
              cy={y}
              r={22}
              fill="none"
              stroke={ACCENT}
              strokeOpacity={0.45}
              strokeWidth={4}
            />
          );
        })}

      {/* pieces */}
      <g>
        {[...instances.entries()].map(([sq, id]) => {
          const cell = state.cells[sq];
          if (cell === 0) return null;
          const [x, y] = P(sq);
          const isGen = cell === R_GENERAL || cell === G_GENERAL;
          const r = isGen ? 68 : 44;
          const ring = isGen ? 55 : 34;
          const grad =
            cell === R_GENERAL || cell === R_SOLDIER ? "cctRedDisc" : "cctGreenDisc";
          const ringOp = cell === R_GENERAL || cell === R_SOLDIER ? 0.3 : 0.35;
          return (
            <g
              key={id}
              className="cct-piece"
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              <circle cx={0} cy={r * 0.09} r={r} fill="rgba(0,0,0,0.22)" />
              <circle cx={0} cy={0} r={r} fill={`url(#${grad})`} />
              <circle
                cx={0}
                cy={0}
                r={ring}
                fill="none"
                stroke={`rgba(255,255,255,${ringOp})`}
                strokeWidth={isGen ? 3.5 : 3}
              />
              {sel === sq && (
                <circle
                  cx={0}
                  cy={0}
                  r={r + 10}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={5}
                />
              )}
            </g>
          );
        })}
      </g>

      {/* threatened-general glow */}
      {threatenedSq >= 0 &&
        (() => {
          const [x, y] = P(threatenedSq);
          return (
            <circle
              cx={x}
              cy={y}
              r={82}
              fill="none"
              stroke={DANGER}
              className="cct-threat-ring"
            />
          );
        })()}

      {/* legal-target dots */}
      <g>
        {targets.map((m) => {
          const [x, y] = P(m.to);
          return m.capture ? (
            <circle
              key={`t-${m.to}`}
              cx={x}
              cy={y}
              r={34}
              fill="none"
              stroke={DANGER}
              strokeWidth={5}
              strokeDasharray="10 7"
              className="cct-target-dot"
            />
          ) : (
            <circle
              key={`t-${m.to}`}
              cx={x}
              cy={y}
              r={15}
              fill={ACCENT}
              className="cct-target-dot"
            />
          );
        })}
      </g>

      {/* capture flash */}
      {captureFlash &&
        (() => {
          const [x, y] = P(captureFlash.sq);
          return (
            <circle
              key={captureFlash.key}
              cx={x}
              cy={y}
              r={44}
              fill="#ffd43b"
              className="cct-capture-flash"
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
          );
        })()}

      {/* hit areas */}
      <g>
        {Array.from({ length: 25 }, (_, i) => {
          const [x, y] = P(i);
          return (
            <circle
              key={`h-${i}`}
              cx={x}
              cy={y}
              r={64}
              fill="transparent"
              style={{ cursor: interactive ? "pointer" : "default" }}
              onClick={interactive ? () => onPoint(i) : undefined}
            />
          );
        })}
      </g>
    </svg>
  );
}
