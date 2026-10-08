/**
 * population.ts — how many people lived on a country's land in a year (public/data/population.json,
 * written by scripts/population/pop.mjs from Our World in Data).
 *
 * Every figure is on TODAY's borders (that is how the source counts), and every figure before 1950
 * is a reconstruction (HYDE before 1800, Gapminder after), so it reads "≈". Between two known
 * years the figure is interpolated GEOMETRICALLY: a population grows by a share a year, not by a
 * number. Before the first known year or after the last there is no figure (absent, never zero).
 * The share of women is known from 1960 only; before, nothing is said about it.
 */

/** Flat [year, value, year, value, …], years increasing. */
export type Series = number[];
export interface Population {
  world: Series;
  c: Record<string, Series>;
  women: { world: Series; c: Record<string, Series> };
  read: string;
}

export interface At {
  v: number;
  /** A reconstruction (before 1950) or between two known years: written "≈". */
  about: boolean;
  /** The source of that year. */
  source: 'hyde' | 'gapminder' | 'un';
}

export const sourceOf = (y: number): At['source'] => (y < 1800 ? 'hyde' : y < 1950 ? 'gapminder' : 'un');

function bracket(s: Series, y: number): { i: number; exact: boolean } | null {
  const n = s.length / 2;
  if (n === 0 || y < s[0]! || y > s[(n - 1) * 2]!) return null;
  let lo = 0, hi = n - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (s[mid * 2]! <= y) lo = mid; else hi = mid - 1; }
  return { i: lo, exact: s[lo * 2] === y };
}

/** The population in `year` (whole year), or null outside the series. */
export function popAt(s: Series | undefined, year: number): At | null {
  if (!s) return null;
  const y = Math.floor(year);
  const b = bracket(s, y);
  if (!b) return null;
  const y0 = s[b.i * 2]!, v0 = s[b.i * 2 + 1]!;
  if (b.exact) return { v: v0, about: y < 1950, source: sourceOf(y) };
  const y1 = s[b.i * 2 + 2]!, v1 = s[b.i * 2 + 3]!;
  const t = (y - y0) / (y1 - y0);
  const v = v0 > 0 && v1 > 0 ? v0 * Math.pow(v1 / v0, t) : v0 + (v1 - v0) * t;
  return { v: Math.round(v), about: true, source: sourceOf(y) };
}

/** The share of women (percent) in `year`, or null before 1960 and outside the series. */
export function womenAt(s: Series | undefined, year: number): number | null {
  if (!s) return null;
  const y = Math.floor(year);
  const b = bracket(s, y);
  if (!b) return null;
  if (b.exact) return s[b.i * 2 + 1]!;
  const y0 = s[b.i * 2]!, y1 = s[b.i * 2 + 2]!;
  return s[b.i * 2 + 1]! + (s[b.i * 2 + 3]! - s[b.i * 2 + 1]!) * ((y - y0) / (y1 - y0));
}

/** 1 270 000 000 → "1,27 Md" / "1.27B", in the person's language. */
export function fmtPop(n: number, lang: string): string {
  try { return new Intl.NumberFormat(lang, { notation: 'compact', maximumSignificantDigits: 3 }).format(n); }
  catch (e) { console.warn('[MnemoClio] compact number format unavailable for', lang, e); return String(n); }
}

/** A percent with one decimal, in the person's language. */
export function fmtPct(n: number, lang: string): string {
  try { return new Intl.NumberFormat(lang, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n); }
  catch (e) { console.warn('[MnemoClio] percent format unavailable for', lang, e); return n.toFixed(1); }
}
