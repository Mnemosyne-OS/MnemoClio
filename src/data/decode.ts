/**
 * decode.ts — public/data as written by scripts/wikidata/split.mjs, into the types the app uses.
 *
 * Pure: no fetch, no DOM. The rules that matter are the ones about ABSENCE:
 *  - an event's French label `0` is "Wikidata has none", `1` is "the same as the original";
 *  - a regime with no end and no successor is OPEN (drawn faded), never "still running";
 *  - a row that cannot be read is dropped and COUNTED, never patched with a made-up value.
 */
import type { Battle, Country, Ev, History, Kind, Leader, Named, Office, Period, Regime, War } from './types';

/** The last year the timeline reaches; an open regime is drawn up to here. */
export const LAST_YEAR = 2025;

interface RawCountry { id: string; lang: string | null; o: string; ol: string; f: string | null; n: number; s?: number | null; kind?: 'state' | 'ended' | 'territory'; e?: number | null; en?: string | null }
interface RawRegime { id: string; c: string; s: number; e: number | null; next: string | null; nl: Named | null; o: string; ol: string; f: string | null }
interface RawWar { id: string; c: string; s: number; e: number; o: string; ol: string; f: string | null; groups: Record<string, Named>; b: Battle[] }
interface RawHistory { countries: RawCountry[]; wars: RawWar[]; states: RawRegime[]; periods: Period[]; leaders?: Array<Omit<Leader, 'c' | 'h'> & { c?: string | null; h?: string | null }>; offices?: Office[] }

/** Lane hues spread by the golden angle: neighbours in the list never share a colour. */
export const hueOf = (index: number): number => Math.round((index * 137.508) % 360);

export function decodeHistory(raw: RawHistory): History {
  const countries: Country[] = raw.countries.map((c, i) => ({ ...c, f: c.f ?? null, h: hueOf(i), s: typeof c.s === 'number' ? c.s : null, kind: c.kind ?? 'state', e: typeof c.e === 'number' ? c.e : null, en: c.en ?? null }));
  const regimes: Regime[] = raw.states.map((s) => ({ ...s, f: s.f ?? null, e: s.e ?? NaN, open: false }));
  for (const r of regimes) {
    if (Number.isNaN(r.e)) {
      const next = regimes.find((t) => t.id === r.next);
      r.e = next ? next.s : LAST_YEAR;
      r.open = !next;
    }
    // A regime dated to a single year is still one year wide on the timeline.
    if (r.e <= r.s) r.e = r.s + 1;
  }
  const wars: War[] = raw.wars.map((w) => ({ ...w, f: w.f ?? null }));
  // a data file from before the leaders were read simply has none: an empty list, never a crash
  const offices = raw.offices ?? [];
  const leaders = (raw.leaders ?? []).filter((l) => offices[l.of] !== undefined).map((l) => ({ ...l, c: l.c ?? null, h: l.h ?? null, f: l.f ?? null, e: l.e <= l.s ? l.s + 1 : l.e }));
  return { countries, regimes, wars, periods: raw.periods, leaders, offices };
}

export interface RawEvents {
  kind: Kind;
  langs: string[];
  subs: string[];
  /** [year, countryIndex|-1, lon, lat, sitelinks, original, langIndex, fr(0|1|string), subIndex|-1, qid number, polityIndex|-1, approximate (1, only when it is)] */
  rows: unknown[][];
}

export interface Decoded { events: Ev[]; dropped: number }

export function decodeEvents(raw: RawEvents, countries: Country[]): Decoded {
  const events: Ev[] = [];
  let dropped = 0;
  for (const r of raw.rows) {
    const [y, ci, lon, lat, sl, o, li, f, si, q, hi, ap] = r as [number, number, number | null, number | null, number, string, number, 0 | 1 | string, number, number, number | undefined, number | undefined];
    if (typeof y !== 'number' || !Number.isFinite(y) || typeof o !== 'string' || !o || typeof q !== 'number') { dropped++; continue; }
    const country = ci >= 0 ? countries[ci] : undefined;
    if (ci >= 0 && !country) { dropped++; continue; }
    events.push({
      k: raw.kind,
      y,
      c: country ? country.id : null,
      // a polity index that points nowhere is ignored, never guessed
      h: typeof hi === 'number' && hi >= 0 ? countries[hi]?.id ?? null : null,
      lon: typeof lon === 'number' ? lon : null,
      lat: typeof lat === 'number' ? lat : null,
      sl: typeof sl === 'number' ? sl : 0,
      o,
      ol: raw.langs[li] ?? 'en',
      f: f === 1 ? o : typeof f === 'string' && f ? f : null,
      sub: si >= 0 ? raw.subs[si] ?? null : null,
      q: 'Q' + q,
      // only an explicit 1 marks a date approximate: anything else is the exact year it always was
      ...(ap === 1 ? { a: true } : {}),
    });
  }
  return { events, dropped };
}

/** One item can be filed under two subjects (a treaty that is also a law): keep the first of each, in order. */
export function uniqueByQ<T extends { q: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((x) => !seen.has(x.q) && !!seen.add(x.q));
}

/** Binary search: index of the first event whose year is >= y, in a list sorted by year. */
export function firstAtOrAfter(sorted: { y: number }[], y: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]!.y < y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Events whose year falls in (from, to] — what a moving cursor just passed. Sorted input. */
export function crossed<T extends { y: number }>(sorted: T[], from: number, to: number): T[] {
  if (to <= from) return [];
  const a = firstAtOrAfter(sorted, Math.floor(from) + 1);
  const b = firstAtOrAfter(sorted, Math.floor(to) + 1);
  return sorted.slice(a, b);
}
