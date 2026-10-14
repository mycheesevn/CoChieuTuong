// Canonical CCT move notation "c,r-c,r" (1-based cols/rows 1–5),
// e.g. "3,5-3,4". Used by lessons, daily puzzles and community puzzles.
import { colOf, rowOf, type Move } from "./engine";

export function parseCanonMove(s: string): Move | null {
  const m = /^([1-5]),([1-5])-([1-5]),([1-5])$/.exec(s.trim());
  if (!m) return null;
  const from = (Number(m[2]) - 1) * 5 + (Number(m[1]) - 1);
  const to = (Number(m[4]) - 1) * 5 + (Number(m[3]) - 1);
  return { from, to } as Move;
}

export function canonMove(m: Move): string {
  return `${colOf(m.from) + 1},${rowOf(m.from) + 1}-${colOf(m.to) + 1},${rowOf(m.to) + 1}`;
}
