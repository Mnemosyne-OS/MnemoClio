/**
 * lanes.ts — the vertical layout: one lane per shown country, plus the world and the periods.
 *
 * The heights depend on the zoom level (a density bar needs less room than named dots), so
 * zooming in visibly opens the lanes: the layout is part of the motion, and it is computed,
 * never stored, so it cannot disagree with what is drawn.
 */
import type { Level } from './view';

export interface LaneSpec {
  key: string;
  kind: 'periods' | 'world' | 'country';
  /** Rows needed by overlapping regimes (or periods), 0 when none. */
  bandRows: number;
  /** Rows of leaders: 0, 1 (head of state or of government) or 2 (both). */
  leaderRows?: number;
  hasWars: boolean;
  hasEvents: boolean;
}

export interface Lane extends LaneSpec {
  y: number;
  h: number;
  /** Top of the regimes / periods bands. */
  bandY: number;
  /** Top of the first leaders row. */
  leaderY: number;
  /** Centre line of the wars row. */
  warY: number;
  /** Top and height of the events area. */
  evY: number;
  evH: number;
  /** How many rows the events area is split into (dots spread over them, names placed on them). */
  evRows: number;
}

export const BAND_H = 16;
export const HEADER_H = 20;
export const WAR_H = 16;
export const LEADER_H = 13;

export function eventRows(level: Level): number {
  // more rows than at first: with ~50 000 events a busy country (the United States) saturated 4 rows
  return level === 'density' ? 1 : level === 'dots' ? 5 : 6;
}
export function eventAreaHeight(level: Level): number {
  return level === 'density' ? 26 : level === 'dots' ? 52 : 96;
}

export function layoutLanes(specs: readonly LaneSpec[], level: Level, gap = 8): { lanes: Lane[]; height: number } {
  const lanes: Lane[] = [];
  let y = 0;
  for (const s of specs) {
    const bandY = y + HEADER_H;
    const bandsH = s.bandRows * (BAND_H + 2);
    const leaderY = bandY + bandsH;
    const leadersH = (s.leaderRows ?? 0) * (LEADER_H + 2);
    const warY = leaderY + leadersH + (s.hasWars ? WAR_H / 2 : 0);
    const evY = leaderY + leadersH + (s.hasWars ? WAR_H : 0) + 2;
    const evH = s.hasEvents ? eventAreaHeight(level) : 0;
    const h = Math.max(HEADER_H + 14, evY - y + evH + 4);
    lanes.push({ ...s, y, h, bandY, leaderY, warY, evY, evH, evRows: eventRows(level) });
    y += h + gap;
  }
  return { lanes, height: Math.max(0, y - gap) };
}

/** Greedy interval packing: each band gets the first row free at its start. Returns the row count. */
export function packRows<T extends { s: number; e: number }>(items: readonly T[], rowOf: Map<T, number>): number {
  const ends: number[] = [];
  for (const it of [...items].sort((a, b) => a.s - b.s || a.e - b.e)) {
    let r = ends.findIndex((end) => end <= it.s);
    if (r < 0) { r = ends.length; ends.push(it.e); } else ends[r] = it.e;
    rowOf.set(it, r);
  }
  return ends.length;
}
