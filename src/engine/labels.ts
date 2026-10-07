/**
 * labels.ts — which names fit on a lane, and where.
 *
 * Greedy and deterministic: the most-known first (more Wikipedias), each placed on the first
 * row where it overlaps nothing. A name that fits nowhere is simply not written; its dot stays,
 * and hovering it still says what it is. Two runs on the same input give the same answer, so a
 * name never jumps from row to row while the view is still.
 */

export interface LabelCandidate {
  id: string;
  /** Left edge of the dot, px. The label starts just after it. */
  x: number;
  width: number;
  /** Higher first. */
  prio: number;
}

export interface Placed { id: string; x: number; row: number }

export function placeLabels(items: readonly LabelCandidate[], rows: number, laneWidth: number, gap = 6): Placed[] {
  const order = [...items].sort((a, b) => b.prio - a.prio || a.x - b.x || (a.id < b.id ? -1 : 1));
  const taken: Array<Array<[number, number]>> = Array.from({ length: rows }, () => []);
  const out: Placed[] = [];
  for (const it of order) {
    const a = it.x;
    const b = it.x + it.width;
    if (a < 0 || b > laneWidth) continue;
    for (let r = 0; r < rows; r++) {
      const row = taken[r]!;
      if (row.some(([s, e]) => a < e + gap && b + gap > s)) continue;
      row.push([a, b]);
      out.push({ id: it.id, x: it.x, row: r });
      break;
    }
  }
  return out;
}

/** A stable small number from an id: spreads dots of one lane on a few rows without moving them between frames. */
export function rowOf(id: string, rows: number): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % Math.max(1, rows);
}
