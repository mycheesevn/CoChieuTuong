// Canvas share card for Vietnamese General Check.
// Renders the 5x5 board (grid + Alquerque diagonals + plain discs) +
// result headline to a PNG for sharing.

import { colOf, rowOf, type CctState } from "./engine";

const SIZE = 1080;
const HEAD = 230;
const FOOT = 120;
const BOARD_SIZE = SIZE - HEAD - FOOT;
const MARGIN = 90; // within board area
const P0 = MARGIN;
const STEP = (BOARD_SIZE - MARGIN * 2) / 4;

/** Alquerque diagonal segments as pairs of cell indices (geometry-free). */
export const DIAGONALS: Array<[number, number]> = [
  [0, 6], [2, 6], [2, 8], [4, 8], [6, 10], [6, 12], [8, 12], [8, 14],
  [10, 16], [12, 16], [12, 18], [14, 18], [16, 20], [16, 22], [18, 22], [18, 24],
];

export interface ShareCardOpts {
  /** Final board state; null = no board (streak/puzzle card). */
  state: CctState | null;
  headline: string;
  subline: string;
  appName: string;
  appUrl: string;
}

const xy = (i: number): [number, number] => [
  P0 + colOf(i) * STEP,
  HEAD + P0 + rowOf(i) * STEP,
];

export function renderShareCard(opts: ShareCardOpts): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      const cx = SIZE / 2;

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, SIZE);
      bg.addColorStop(0, "#1c150e");
      bg.addColorStop(1, "#100c08");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Headline
      ctx.fillStyle = "#f5eeda";
      ctx.font = "bold 62px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(opts.headline, cx, 100);
      ctx.fillStyle = "#b9a98a";
      ctx.font = "38px system-ui, sans-serif";
      ctx.fillText(opts.subline, cx, 158);

      if (opts.state) {
        const s = opts.state;
        // Wood panel
        const panel = ctx.createLinearGradient(0, HEAD, 0, HEAD + BOARD_SIZE);
        panel.addColorStop(0, "#C79A63");
        panel.addColorStop(1, "#B0824C");
        ctx.fillStyle = panel;
        const px = P0 - 60;
        const py = HEAD + P0 - 60;
        const pw = BOARD_SIZE - P0 * 2 + 120;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, pw, 28);
        ctx.fill();

        // Grid lines
        ctx.strokeStyle = "#4a3220";
        ctx.lineWidth = 5;
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.moveTo(P0, HEAD + P0 + k * STEP);
          ctx.lineTo(P0 + 4 * STEP, HEAD + P0 + k * STEP);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(P0 + k * STEP, HEAD + P0);
          ctx.lineTo(P0 + k * STEP, HEAD + P0 + 4 * STEP);
          ctx.stroke();
        }
        for (const [a, b] of DIAGONALS) {
          const [x1, y1] = xy(a);
          const [x2, y2] = xy(b);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Pieces: plain discs (red / green), generals bigger.
        const R = STEP * 0.36;
        const RG = STEP * 0.52;
        for (let i = 0; i < 25; i++) {
          const cell = s.cells[i];
          if (!cell) continue;
          const [x, y] = xy(i);
          const isGen = cell === 2 || cell === 4;
          const r = isGen ? RG : R;
          const red = cell <= 2;
          const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.2, x, y, r);
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
          ctx.lineWidth = isGen ? 7 : 5;
          ctx.stroke();
          if (isGen) {
            ctx.strokeStyle = "rgba(255,255,255,0.55)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y, r * 0.68, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      } else {
        // Centered emblem: two discs + general ring.
        const y = HEAD + (BOARD_SIZE - 120) / 2;
        ctx.fillStyle = "#a02018";
        ctx.beginPath();
        ctx.arc(cx - 90, y, 64, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1f7a2c";
        ctx.beginPath();
        ctx.arc(cx + 90, y, 64, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx - 90, y, 44, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 90, y, 44, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Footer
      ctx.fillStyle = "#8a7a5f";
      ctx.font = "34px system-ui, sans-serif";
      ctx.fillText(`${opts.appName} · ${opts.appUrl}`, cx, SIZE - 48);

      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render_failed"))), "image/png");
    } catch (e) {
      reject(e);
    }
  });
}

/** Share a PNG blob: Web Share API with files, else download. */
export async function sharePng(blob: Blob, title: string, text: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], "vietnamese-general-check.png", { type: "image/png" });
  try {
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title: string; text: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title, text });
      return "shared";
    }
  } catch {
    /* fall through to download */
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vietnamese-general-check.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
