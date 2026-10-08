/**
 * epidemics.ts — outbreaks where Wikidata places them (public/data/epidemics.json, written by
 * scripts/epidemics/epi.mjs): dated FOCI, never an invented spread.
 *
 * An outbreak is under way from its start to its end. 🎭 An end nobody dated is null, and then
 * the outbreak is shown only around its start, written "end not dated": claiming it lasted, or
 * that it ended the year it began, would be a date nobody measured. A focus appears the year
 * Wikidata gives it and stays while the outbreak is under way, so the foci of a pandemic come
 * on in the order they were recorded (COVID-19's 357 foci, the Black Death's five).
 */

/** [year, lon, lat] */
export type Focus = [number, number, number];
export interface Epidemic {
  q: string;
  /** Names by language (en, fr, es, de, pt, ru, zh), as Wikidata has them. */
  n: Partial<Record<string, string>>;
  s: number;
  e: number | null;
  sl: number;
  /** Deaths Wikidata records (P1120), the highest figure given; null when none. */
  dead: number | null;
  f: Focus[];
}

/** Is the outbreak under way in `year`? With no dated end, only within `window` years of its start. */
export function underWay(ep: Epidemic, year: number, window: number): boolean {
  const y = Math.floor(year);
  if (ep.e === null) return Math.abs(y - ep.s) <= window;
  return ep.s <= y && y <= ep.e;
}

/** The foci on the map in `year`: those already recorded, of an outbreak under way. */
export function fociAt(ep: Epidemic, year: number, window: number): Focus[] {
  if (!underWay(ep, year, window)) return [];
  const y = Math.floor(year);
  return ep.e === null ? ep.f : ep.f.filter((f) => f[0] <= y);
}

/** Its name in the person's language, else English, else any. */
export function epiName(ep: Epidemic, lang: string): string {
  return ep.n[lang] ?? ep.n.en ?? Object.values(ep.n).find(Boolean) ?? ep.q;
}
