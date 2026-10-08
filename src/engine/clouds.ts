/**
 * clouds.ts — where a war is felt, year by year: a cloud over its dated battles.
 *
 * Field, 07/10: "clouds of colour, of influence… like the world wars, there were spreads". The
 * cloud is MEASURED, never drawn by hand: each battle Wikidata dates and places adds a soft blob
 * where it was fought, at its year, and the blob fades as the cursor moves on (a war is still
 * felt where it was fought a few years ago, never where it will be fought). Played, the cloud
 * spreads with the front. ⚠️ It is the density of the battles Wikidata knows, not the land a
 * side held: a quiet occupation has no cloud.
 *
 * A front is filed as a war of its own (the Eastern Front, the Winter War); a period that lists
 * it as a part (World War II) gathers it, so the world war is one colour and one name.
 */
import type { Period, War } from '../data/types';

export interface Blob { lon: number; lat: number; w: number }
export interface Cloud {
  /** The war, or the period that gathers it with its fronts. */
  id: string;
  /** Hue of the cloud, the same for the same id every time. */
  hue: number;
  blobs: Blob[];
  /** Sum of the blob weights: how strongly the war is felt this year. */
  weight: number;
  /** Where it is felt most (the densest 10° square), where its name is written: a weighted
   * centre of Europe and the Pacific would write World War II over Iraq. */
  lon: number;
  lat: number;
}

/** How long a battle is still felt after it was fought, in years, at this window. */
export const fadeFor = (windowYears: number): number => Math.max(1, windowYears / 3);
/** Past this many fades, a battle is no longer drawn (its weight is under 5 %). */
const HORIZON = 3;
/** At most this many blobs a frame: the most recent are kept. */
export const MAX_BLOBS = 900;

/** The period each war belongs to, up to the top (a front → its world war). */
export function rootsOf(periods: Period[]): Map<string, string> {
  const parent = new Map<string, string>();
  for (const p of periods) for (const k of p.kids) if (k !== p.id && !parent.has(k)) parent.set(k, p.id);
  const root = new Map<string, string>();
  for (const id of parent.keys()) {
    let r = id;
    const seen = new Set<string>();
    while (parent.has(r) && !seen.has(r)) { seen.add(r); r = parent.get(r)!; }
    root.set(id, r);
  }
  return root;
}

/** A hue that depends only on the id, so a war keeps its colour from one frame and one session to the next. */
export function hueOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}

/**
 * The clouds of the year `year`: one per war (or gathering period) with at least one battle
 * fought in the last HORIZON fades. A battle at `by` weighs exp(-(year - by) / fade).
 */
export function warClouds(wars: War[], roots: ReadonlyMap<string, string>, year: number, fade: number): Cloud[] {
  const from = year - HORIZON * fade;
  const picked: Array<{ id: string; lon: number; lat: number; by: number }> = [];
  for (const w of wars) {
    if (w.s > year || w.e < from - 1) continue;
    const id = roots.get(w.id) ?? w.id;
    for (const b of w.b) {
      if (b.lon === null || b.lat === null || b.y > year || b.y < from) continue;
      picked.push({ id, lon: b.lon, lat: b.lat, by: b.y });
    }
  }
  if (picked.length > MAX_BLOBS) { picked.sort((m, n) => n.by - m.by); picked.length = MAX_BLOBS; }
  const by = new Map<string, Cloud>();
  for (const p of picked) {
    // a battle of the cursor's own year weighs fully all year long
    const w = Math.exp(-Math.max(0, year - p.by - 1) / fade);
    let c = by.get(p.id);
    if (!c) { c = { id: p.id, hue: hueOf(p.id), blobs: [], weight: 0, lon: 0, lat: 0 }; by.set(p.id, c); }
    c.blobs.push({ lon: p.lon, lat: p.lat, w });
    c.weight += w;
  }
  const out = [...by.values()];
  for (const c of out) {
    const cells = new Map<string, { w: number; lon: number; lat: number }>();
    for (const b of c.blobs) {
      const k = `${Math.floor(b.lon / 10)}:${Math.floor(b.lat / 10)}`;
      const cell = cells.get(k) ?? { w: 0, lon: 0, lat: 0 };
      cell.w += b.w; cell.lon += b.lon * b.w; cell.lat += b.lat * b.w;
      cells.set(k, cell);
    }
    let best = { w: -1, lon: 0, lat: 0 };
    for (const cell of cells.values()) if (cell.w > best.w) best = cell;
    c.lon = best.lon / best.w; c.lat = best.lat / best.w;
  }
  return out.sort((m, n) => n.weight - m.weight);
}
