// Replay-to-video export for Cờ Chiếu Tướng: re-render a game on canvas
// with move animations, capture it with canvas.captureStream +
// MediaRecorder, and return a video file. Fully client-side; Safari
// records MP4, Chrome records WebM. Standard design: boardgame-engagement
// skill, references/replay-video.md (ported from the Chess game).

import {
  colOf,
  rowOf,
  gameStatus,
  generalSquare,
  hasGeneral,
  moveLabel,
  type Cell,
  type CctState,
  type Side,
} from "./engine";
import { buildReplayStates, type ReplayPly } from "./replay";
import { DIAGONALS } from "./shareCard";
import { synthCapture, synthCheck, synthMove, synthMoveStart } from "./sound";
import { STR, type Lang } from "./i18n";

export interface CctReplayVideoInput {
  /** Move labels in "c,r-c,r" canon format (1-based). */
  labels: string[];
  /** 25-char start position (omit = standard initial position). */
  startPos?: string;
  startTurn?: Side;
  title: string;
  subtitle: string;
  lang: Lang;
  /** Playback speed multiplier (0.5 = half speed, slower). Defaults to 1. */
  speed?: number;
  micStream?: MediaStream | null;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

const VW = 720;
const VH = 960;
const STEP = 132;
const GRID = STEP * 4;
const P0 = (VW - GRID) / 2; // 96 — board centered horizontally
const BY = 190;

const SOLDIER_R = STEP * 0.36;
const GENERAL_R = STEP * 0.52;

const TITLE_DUR = 2.0;
const END_DUR = 2.5;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x, y, r);
  ctx.closePath();
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const cands = ["video/mp4", "video/webm;codecs=vp9", "video/webm"];
  for (const c of cands) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}

/** Render the game replay to a video file. Rejects on cancel or unsupported. */
export async function exportCctReplayVideo(
  input: CctReplayVideoInput
): Promise<File> {
  const { labels, lang, onProgress, signal } = input;
  const s = STR[lang] as unknown as Record<string, string>;
  const mime = pickMime();
  const canvas = document.createElement("canvas");
  if (!mime || typeof canvas.captureStream !== "function") {
    throw new Error("unsupported");
  }
  canvas.width = VW;
  canvas.height = VH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("unsupported");

  const cx = (i: number): number => P0 + colOf(i) * STEP;
  const cy = (i: number): number => BY + rowOf(i) * STEP;

  // Precompute one state per ply (+ capture/check/mate flags).
  const { states, plies } = buildReplayStates({
    labels,
    startPos: input.startPos,
    startTurn: input.startTurn ?? "r",
    title: "",
    subtitle: "",
  });
  const n = plies.length;
  const finalStatus = gameStatus(states[n]);
  const finalMate =
    n > 0 && finalStatus.outcome === "win" && finalStatus.reason === "checkmate";
  const finalStalemate =
    n > 0 && finalStatus.outcome === "win" && finalStatus.reason === "stalemate";
  const mateText = s.checkBanner; // "CHIẾU TƯỚNG!" / "CHECK!"
  const stalemateText = s.replayStalemate; // "BÍ NƯỚC!" / "STALEMATE!"

  const speed =
    input.speed && input.speed > 0
      ? Math.min(2, Math.max(0.25, input.speed))
      : 1;
  const GLIDE = 0.6 / speed;
  const HOLD = 1.0 / speed;
  const PER = GLIDE + HOLD;
  const total = TITLE_DUR + n * PER + END_DUR;

  const drawDisc = (x: number, y: number, cell: Cell, scale: number) => {
    const isGen = cell === 2 || cell === 4;
    const r = (isGen ? GENERAL_R : SOLDIER_R) * scale;
    const red = cell <= 2;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.16, r * 0.95, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(
      x - r * 0.3, y - r * 0.35, r * 0.2, x, y, r
    );
    if (red) {
      g.addColorStop(0, "#f0564a");
      g.addColorStop(1, "#a02018");
    } else {
      g.addColorStop(0, "#5fbf6a");
      g.addColorStop(1, "#1f7a2c");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = red ? "#7a140d" : "#0f4d1a";
    ctx.lineWidth = (isGen ? 7 : 5) * scale;
    ctx.stroke();
    if (isGen) {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.68, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawBoard = (lastMove: { from: number; to: number } | null) => {
    // Wood panel.
    const panel = ctx.createLinearGradient(0, BY, 0, BY + GRID);
    panel.addColorStop(0, "#C79A63");
    panel.addColorStop(1, "#B0824C");
    ctx.fillStyle = panel;
    const pm = 56;
    rr(ctx, P0 - pm, BY - pm, GRID + pm * 2, GRID + pm * 2, 26);
    ctx.fill();
    ctx.strokeStyle = "#e0a32e";
    ctx.lineWidth = 3;
    rr(ctx, P0 - pm, BY - pm, GRID + pm * 2, GRID + pm * 2, 26);
    ctx.stroke();
    // Grid lines.
    ctx.strokeStyle = "#4a3220";
    ctx.lineWidth = 5;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(P0, BY + k * STEP);
      ctx.lineTo(P0 + GRID, BY + k * STEP);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(P0 + k * STEP, BY);
      ctx.lineTo(P0 + k * STEP, BY + GRID);
      ctx.stroke();
    }
    for (const [a, b] of DIAGONALS) {
      ctx.beginPath();
      ctx.moveTo(cx(a), cy(a));
      ctx.lineTo(cx(b), cy(b));
      ctx.stroke();
    }
    // Last-move highlight (gold halos on from/to points).
    if (lastMove) {
      ctx.fillStyle = "rgba(255, 213, 59, 0.38)";
      for (const i of [lastMove.from, lastMove.to]) {
        ctx.beginPath();
        ctx.arc(cx(i), cy(i), SOLDIER_R * 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const drawPieces = (
    board: CctState,
    skip: number[],
    fadeIdx: number | null,
    fadeAlpha: number,
    movers: Array<{ cell: Cell; x: number; y: number; scale: number }>
  ) => {
    for (let i = 0; i < 25; i++) {
      if (skip.includes(i)) continue;
      const cell = board.cells[i];
      if (!cell) continue;
      if (fadeIdx === i && fadeAlpha <= 0) continue;
      ctx.save();
      if (fadeIdx === i) ctx.globalAlpha = fadeAlpha;
      drawDisc(cx(i), cy(i), cell, 1);
      ctx.restore();
    }
    for (const mv of movers) {
      ctx.save();
      drawDisc(mv.x, mv.y, mv.cell, mv.scale);
      ctx.restore();
    }
  };

  /** General square of the side to move, or null when absent (crafted pos). */
  const threatenedGeneral = (st: CctState): number | null => {
    if (!hasGeneral(st, st.turn)) return null;
    try {
      return generalSquare(st, st.turn);
    } catch {
      return null;
    }
  };

  const drawFrame = (t: number) => {
    // Background.
    const bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, "#1c150e");
    bg.addColorStop(1, "#100c08");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);
    ctx.strokeStyle = "#e0a32e";
    ctx.lineWidth = 5;
    ctx.strokeRect(14, 14, VW - 28, VH - 28);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let board = states[0];
    let caption: string | null = null;
    let anim: { ply: ReplayPly; idx: number; p: number; cell: Cell } | null = null;
    let lastMove: { from: number; to: number } | null = null;
    let trailRemnant: { move: { from: number; to: number }; q: number } | null =
      null;
    let card = false;
    let showMate = false;
    let showStalemate = false;
    let checkSq: number | null = null;

    if (t < TITLE_DUR) {
      card = true;
    } else {
      const mt = t - TITLE_DUR;
      const idx = Math.floor(mt / PER);
      if (idx >= n) {
        board = states[n];
        if (n > 0) {
          lastMove = { from: plies[n - 1].move.from, to: plies[n - 1].move.to };
          if (plies[n - 1].check || plies[n - 1].mate) {
            checkSq = threatenedGeneral(board);
          }
        }
        card = true;
        showMate = finalMate;
        showStalemate = finalStalemate;
      } else {
        const lt = mt - idx * PER;
        const ply = plies[idx];
        const m = ply.move;
        board = states[idx];
        const cell = board.cells[m.from];
        if (lt < GLIDE && cell) {
          anim = { ply, idx, p: easeInOut(lt / GLIDE), cell };
        } else {
          board = states[idx + 1];
          lastMove = { from: m.from, to: m.to };
          const holdT = lt - GLIDE;
          if (holdT < 0.45) trailRemnant = { move: lastMove, q: 1 - holdT / 0.45 };
          if (ply.check || ply.mate) checkSq = threatenedGeneral(board);
        }
        caption = `${idx + 1}/${n} · ${moveLabel(states[idx], m)}`;
        if (ply.mate) {
          showMate = finalMate;
          showStalemate = finalStalemate;
        }
      }
    }

    // Header.
    ctx.fillStyle = "#e8c96a";
    ctx.font = "700 44px Georgia, serif";
    ctx.fillText(
      lang === "vi" ? "♟ CỜ CHIẾU TƯỚNG" : "♟ VIETNAMESE GENERAL CHECK",
      VW / 2,
      64
    );
    if (!card) {
      ctx.fillStyle = "#e8e2d2";
      ctx.font = "400 27px system-ui, sans-serif";
      ctx.fillText(input.title, VW / 2, 116, VW - 80);
    }

    drawBoard(lastMove);

    // General-in-check ring.
    if (checkSq !== null) {
      ctx.save();
      ctx.strokeStyle = "#ff5252";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx(checkSq), cy(checkSq), GENERAL_R * 0.82, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (anim) {
      const { ply, p, cell } = anim;
      const m = ply.move;
      const fade = p < 0.75 ? 1 : (1 - p) / 0.25;
      const x0 = cx(m.from);
      const y0 = cy(m.from);
      const x1 = cx(m.to);
      const y1 = cy(m.to);
      // Turquoise trail.
      ctx.save();
      ctx.strokeStyle = "#40e0d0";
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.85 * fade;
      ctx.lineWidth = 5 + 11 * fade;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.globalAlpha = 0.9 * (1 - p);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x0, y0, 24 + 18 * p, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const x = x0 + (x1 - x0) * p;
      const y = y0 + (y1 - y0) * p;
      ctx.save();
      ctx.globalAlpha = 0.5 * fade;
      ctx.fillStyle = "#40e0d0";
      ctx.beginPath();
      ctx.arc(x, y, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawPieces(
        board,
        [m.from],
        ply.capture ? m.to : null,
        Math.max(0, 1 - p * 2),
        [{ cell, x, y, scale: 1.07 }]
      );
    } else {
      if (trailRemnant) {
        const m = trailRemnant.move;
        ctx.save();
        ctx.strokeStyle = "#40e0d0";
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.7 * trailRemnant.q;
        ctx.lineWidth = 5 + 9 * trailRemnant.q;
        ctx.beginPath();
        ctx.moveTo(cx(m.from), cy(m.from));
        ctx.lineTo(cx(m.to), cy(m.to));
        ctx.stroke();
        ctx.restore();
      }
      drawPieces(board, [], null, 1, []);
    }

    // Bottom caption.
    if (caption && !card) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 30px system-ui, sans-serif";
      ctx.fillText(caption, VW / 2, 880, VW - 80);
    }

    // Win banner — gold on black, like the in-game banner.
    const bannerText = showMate ? mateText : showStalemate ? stalemateText : null;
    if (bannerText) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      const bw = VW - 160;
      const bh = 110;
      const bx = (VW - bw) / 2;
      const by = VH / 2 - bh / 2;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "#ffd43b";
      ctx.lineWidth = 4;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = "#ffd43b";
      ctx.font = "700 54px Georgia, serif";
      ctx.fillText(bannerText, VW / 2, VH / 2, bw - 40);
      ctx.restore();
    }

    // Title / end card overlay.
    if (card) {
      ctx.fillStyle = "rgba(8, 10, 14, 0.66)";
      ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = "#e8c96a";
      ctx.font = "700 62px Georgia, serif";
      ctx.fillText(
        lang === "vi" ? "♟ CỜ CHIẾU TƯỚNG" : "♟ VIETNAMESE GENERAL CHECK",
        VW / 2,
        VH / 2 - 118
      );
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 42px system-ui, sans-serif";
      ctx.fillText(input.title, VW / 2, VH / 2 - 28, VW - 80);
      ctx.fillStyle = "#cfd8e3";
      ctx.font = "400 33px system-ui, sans-serif";
      ctx.fillText(input.subtitle, VW / 2, VH / 2 + 38, VW - 80);
    }
  };

  const stream = canvas.captureStream(30);

  // Recorded soundtrack: synthesized move / capture / check sounds
  // scheduled on the video timeline through a MediaStreamDestination.
  let actx: AudioContext | null = null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    actx = new AC();
    if (actx.state === "suspended") await actx.resume();
    const dest = actx.createMediaStreamDestination();
    const track = dest.stream.getAudioTracks()[0];
    if (track) stream.addTrack(track);
    if (input.micStream) {
      try {
        actx.createMediaStreamSource(input.micStream).connect(dest);
      } catch {
        /* ignore */
      }
    }
    const base = actx.currentTime + 0.15;
    plies.forEach((ply, i) => {
      const t0 = base + TITLE_DUR + i * PER;
      if (ply.capture) synthCapture(dest, t0 + 0.04);
      synthMoveStart(dest, t0);
      synthMove(dest, t0 + GLIDE);
      if (ply.check || ply.mate) synthCheck(dest, t0 + GLIDE + 0.1);
    });
  } catch {
    actx = null; // audio unavailable — keep recording silent
  }

  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 2_500_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
    rec.onerror = () => reject(new Error("record_failed"));
  });

  let raf = 0;
  let lastPct = -1;
  let cancelled = false;
  const onAbort = () => {
    cancelled = true;
  };
  signal?.addEventListener("abort", onAbort);

  try {
    rec.start(250);
    const t0 = performance.now();
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (cancelled || signal?.aborted) {
          reject(new Error("cancelled"));
          return;
        }
        const t = (performance.now() - t0) / 1000;
        if (t >= total) {
          drawFrame(total);
          resolve();
          return;
        }
        drawFrame(t);
        const pct = Math.floor((t / total) * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          onProgress?.(pct / 100);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
  } finally {
    cancelAnimationFrame(raf);
    signal?.removeEventListener("abort", onAbort);
    if (rec.state !== "inactive") rec.stop();
    if (actx) {
      try {
        await actx.close();
      } catch {
        /* ignore */
      }
    }
  }

  const blob = await finished;
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  return new File([blob], `co-chieu-tuong-replay.${ext}`, { type: mime });
}
