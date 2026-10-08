/**
 * era.ts — the borders of each era, downloaded on the person's gesture, never shipped.
 *
 * Source: historical-basemaps by A. Ourednik, GPL-3.0 (doc 135 §8.3): MnemoClio does not
 * carry it. The person presses a button that names the source and the licence, and their own
 * machine downloads the maps they look at, one date at a time, straight from GitHub.
 * A date is simplified once here (Douglas-Peucker 0.1°) and kept for the session.
 */
import { getJson } from './load';

export const ERA_SOURCE = 'https://github.com/aourednik/historical-basemaps';
export const ERA_LICENSE = 'GPL-3.0';
const RAW = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/world_';

/** The dates the source has from 4000 BC to 2010. Before the first, the first is used, and the screen says so. */
export const ERA_YEARS = [-4000, -3000, -2000, -1500, -1000, -700, -500, -400, -323, -300, -200, -100, -1, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492, 1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994, 2000, 2010] as const;
/** The source names a date before Christ `bc<years>` (world_bc323.geojson). */
export const eraFile = (y: number): string => (y < 0 ? `bc${-y}` : String(y));

/** The map in force at a year: the latest date not after it (the first one before the first date). */
export function eraFor(year: number): number {
  let best: number = ERA_YEARS[0];
  for (const y of ERA_YEARS) if (y <= year) best = y;
  return best;
}

export interface EraShape { n: string; subj: string; r: number[][]; bb: [number, number, number, number][] }

type Pt = [number, number];
interface GeoFeature { properties: { NAME?: string | null; SUBJECTO?: string | null }; geometry: { type: string; coordinates: unknown } | null }

/** Douglas-Peucker on one ring. A closed ring (first = last) is measured to its start point. */
export function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [x1, y1] = pts[a]!;
    const [x2, y2] = pts[b]!;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    let max = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i]!;
      const d = len < 1e-9 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / len;
      if (d > max) { max = d; at = i; }
    }
    if (max > tol && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export function shapesFrom(features: GeoFeature[], tol = 0.1): EraShape[] {
  const round = (v: number) => Math.round(v * 20) / 20;
  const out: EraShape[] = [];
  for (const f of features) {
    if (!f.geometry) continue;
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as Pt[][][];
    const r: number[][] = [];
    const bb: [number, number, number, number][] = [];
    for (const poly of polys) {
      const outer = poly[0];
      if (!outer) continue;
      const flat: number[] = [];
      let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
      for (const [x, y] of simplify(outer, tol)) {
        const rx = round(x), ry = round(y);
        if (flat.length >= 2 && flat[flat.length - 2] === rx && flat[flat.length - 1] === ry) continue;
        flat.push(rx, ry);
        a = Math.min(a, rx); b = Math.max(b, rx); c = Math.min(c, ry); d = Math.max(d, ry);
      }
      if (flat.length >= 8) { r.push(flat); bb.push([a, b, c, d]); }
    }
    if (r.length) out.push({ n: f.properties.NAME ?? '', subj: f.properties.SUBJECTO ?? f.properties.NAME ?? '', r, bb });
  }
  return out;
}

const cache = new Map<number, Promise<EraShape[]>>();

/** One date's map: downloaded once per session, on the person's gesture (the caller checks consent). */
export function loadEra(year: number, signal?: AbortSignal): Promise<EraShape[]> {
  const y = eraFor(year);
  let p = cache.get(y);
  if (!p) {
    p = getJson<{ features: GeoFeature[] }>(`${RAW}${eraFile(y)}.geojson`, signal, 60000).then((g) => shapesFrom(g.features));
    // A failed download must not stay cached: the next look tries again.
    p.catch(() => cache.delete(y));
    cache.set(y, p);
  }
  return p;
}

/**
 * Polities a country governed, to tint an empire with its country's colour (colonies paler).
 * Hand-made for 15 countries; any other country tints the polities whose centre lies on its
 * land today (see MapView). Names are the source's own, in English.
 */
/** English names that differ between Wikidata and the era maps (lower case, Wikidata → map names). */
export const ERA_ALIASES: Record<string, string[]> = {
  'soviet union': ['ussr'], 'qing dynasty': ['qing empire'], 'ming dynasty': ['ming chinese empire'],
  'austria-hungary': ['austria hungary', 'austro-hungarian empire'], 'austria–hungary': ['austria hungary', 'austro-hungarian empire'],
  'songhai empire': ['songhai'], 'mali empire': ['mali'], 'safavid dynasty': ['safavid empire'], 'safavid iran': ['safavid empire'],
  'timurid empire': ['timurid emirates'], 'republic of venice': ['venice'], 'republic of genoa': ['genoa'],
};
/** The map names a polity can carry: its English name and its aliases. */
export function eraNames(en: string | null): string[] {
  if (!en) return [];
  const k = en.toLowerCase();
  return [k, ...(ERA_ALIASES[k] ?? [])];
}

/**
 * Map name → ended state, for the ended states on the timeline whose life covers the map's date.
 * Outside its life a name is a homonym: the Mali of 1960 is not the Mali Empire.
 */
export function polityNameIndex(countries: ReadonlyArray<{ id: string; kind: string; s: number | null; e: number | null; en: string | null }>, shown: readonly string[], mapYear: number | null): Map<string, string> {
  const out = new Map<string, string>();
  if (mapYear === null) return out;
  for (const id of shown) {
    const c = countries.find((k) => k.id === id);
    if (!c || c.kind !== 'ended' || (c.s ?? -9999) > mapYear || mapYear > (c.e ?? 9999)) continue;
    for (const n of eraNames(c.en)) out.set(n, c.id);
  }
  return out;
}

export const EMPIRE: Record<string, string[]> = {
  Q142: ['France', 'French Guiana', 'Madagascar (France)', 'French Indo-China', 'French Somaliland'],
  Q145: ['England', 'Scotland', 'England and Ireland', 'United Kingdom', 'United Kingdom of Great Britain and Ireland', 'British East India Company', 'British Guiana', 'Great Britain'],
  Q29: ['Castille', 'Spain', 'Spanish Habsburg', 'Cuba (Spain)', 'Hispaniola (Spain)', 'Viceroyalty of New Spain', 'Spanish Guinea', 'Spanish Morocco', 'Spanish Sahara'],
  Q183: ['Holy Roman Empire', 'Prussia', 'Germany', 'German Empire', 'East Prussia', 'East Germany', 'West Germany', 'German South-West Africa'],
  Q38: ['Papal States', 'Venice', 'Sardinia', 'Naples', 'Sardinia-Piedmont', 'Kingdom of Sardinia', 'Italy'],
  Q159: ['Tsardom of Muscovy', 'Russian Empire', 'Russia', 'White Russia', 'South Russia', 'USSR'],
  Q43: ['Ottoman Empire', 'Ottoman Sultanate', 'Turkey', 'Republic of Turkey'],
  Q79: ['Mamluke Sultanate', 'Egypt', 'Harer (Egypt)'],
  Q17: ['Japan', 'Japan (Warring States)', 'Tokugawa shogunate', 'Imperial Japan', 'Empire of Japan'],
  Q148: ['Ming Chinese Empire', 'Post-Ming Warlords', 'Qing Empire', 'Chinese Warlords', 'Chinese warlords', 'China'],
  Q668: ['Mughal Empire', 'Maratha', 'Maratha Confederacy', 'India'],
  Q30: ['United States of America', 'United States'],
  Q96: ['Aztec Empire', 'Mexico'],
  Q155: ['Kingdom of Brazil', 'Brazil'],
  Q1033: ['Sokoto Caliphate', 'Oyo', 'Kanem-Bornu', 'Nigeria'],
};

/**
 * Does a shape of a map of the time belong to a shown country whose land it lies on today?
 * Only when its name says so (field, 07/10: the United States were painted over the hundreds
 * of peoples the map of 1492 names there). "United States of America" in 1783, "Empire of
 * Japan", "Kingdom of France" carry the country's name; "Cherokee", "Roman Empire" do not.
 * Names shorter than 4 letters are ignored (they would match inside any word).
 */
export function namesCountry(shapeName: string, countryNames: Array<string | null | undefined>): boolean {
  const s = shapeName.toLowerCase();
  return countryNames.some((n) => !!n && n.length >= 4 && s.includes(n.toLowerCase()));
}
