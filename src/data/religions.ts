/**
 * religions.ts — where religions built, year by year (public/data/religions.json, written by
 * scripts/religions/rel.mjs from Wikidata). Doc 137 §5quaterdecies holds the rule this follows:
 *
 *  - POINTS only: a place of worship where Wikidata places it, never a territory, never a country;
 *  - a place carrying several religions keeps them all (one point per religion, none erases another);
 *  - families in a FIXED order (the legend is never sorted by count), no name written "where it is
 *    densest";
 *  - what is shown is the places of worship Wikidata KNOWS (≥ 5 Wikipedias), not believers.
 *
 * A place stands from its founding year until the year it was demolished (P576), then it is gone.
 */

/** [year, lon, lat, family index (families.length = other), demolished year | null, inferred 0/1, Q number] */
type RawPlace = [number, number, number, number, number | null, 0 | 1, number];
/** [year, approximate 0/1, lon | null, lat | null, Q number] */
type RawCurrent = [number, 0 | 1, number | null, number | null, number];
export interface RawReligions { read: string; families: string[]; p: RawPlace[]; c: RawCurrent[]; n: Record<string, Partial<Record<string, string>>> }

export interface Place { q: string; y: number; lon: number; lat: number; fam: number; end: number | null; inferred: boolean }
export interface Current { q: string; y: number; about: boolean; lon: number | null; lat: number | null }
export interface Religions {
  read: string;
  /** The twelve families' Wikidata ids, in the fixed order; index `families.length` is "other". */
  families: string[];
  /** Sorted by founding year. */
  places: Place[];
  currents: Current[];
  names: Record<string, Partial<Record<string, string>>>;
}

export function decodeReligions(raw: RawReligions): Religions {
  const places = raw.p.map(([y, lon, lat, fam, end, inf, q]) => ({ q: 'Q' + q, y, lon, lat, fam, end, inferred: inf === 1 }));
  places.sort((a, b) => a.y - b.y);
  const currents = raw.c.map(([y, a, lon, lat, q]) => ({ q: 'Q' + q, y, about: a === 1, lon, lat }));
  return { read: raw.read, families: raw.families, places, currents, names: raw.n };
}

/** Index of the first place founded after `year` (places sorted by year). */
function upTo(places: readonly Place[], year: number): number {
  let lo = 0, hi = places.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (places[mid]!.y <= year) lo = mid + 1; else hi = mid; }
  return lo;
}

/** The places standing in `year`: founded by then, not yet demolished. */
export function standingAt(places: readonly Place[], year: number): Place[] {
  const y = Math.floor(year);
  const out: Place[] = [];
  for (let i = 0, n = upTo(places, y); i < n; i++) { const p = places[i]!; if (p.end === null || p.end > y) out.push(p); }
  return out;
}

/** Places standing per family, in the families' fixed order, "other" last. */
export function countsByFamily(standing: readonly Place[], families: number): number[] {
  const c = new Array<number>(families + 1).fill(0);
  for (const p of standing) c[Math.min(p.fam, families)]!++;
  return c;
}

/** Currents founded in [start, start + size). */
export const foundedIn = (currents: readonly Current[], start: number, size: number): Current[] =>
  currents.filter((c) => c.y >= start && c.y < start + size);

/**
 * A FIXED hue per family (index in `families`), never a hash: a hash would give two neighbouring
 * faiths colours that look alike by chance. Judaism, Christianity, Islam, Hinduism, Buddhism,
 * Jainism, Sikhism, Taoism, Confucianism, Shinto, Zoroastrianism, Baháʼí.
 */
export const FAMILY_HUE = [220, 45, 140, 15, 285, 325, 195, 90, 255, 0, 170, 305];

/** A name in the person's language, else English, else any. */
export function relName(r: Religions, q: string, lang: string): string {
  const n = r.names[q] ?? {};
  return n[lang] ?? n.en ?? Object.values(n).find(Boolean) ?? q;
}
