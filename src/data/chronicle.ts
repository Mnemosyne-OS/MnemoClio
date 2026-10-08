/**
 * chronicle.ts — a country's history written as chronicles the memory can hold (lot 2, doc 137
 * §5quindecies).
 *
 * Field, 07/10: pour what one looks at into memory, so the chat can answer "what was happening in
 * Japan during the French Revolution". One Memory Pack per country (doc 135 §6.3), one chronicle
 * per MOMENT (a decade from 1400, half a century from 500, a century before: the panel's own
 * moments, `periodOf`), each a self-contained text: the country and the years in its title, then
 * its regimes, who ruled, its wars, the people living there, what happened, and its SOURCE and
 * the date it was read — a knowledge is never presented as a memory of the person (doc 135 §6.4).
 *
 * Pure: names and words come from the caller (the app's language); nothing here reads the network.
 */
import type { Country, Ev, History, Named } from './types';
import { periodOf, fspan, fey } from '../engine/years';

/**
 * The host refuses an ingest above 50 000 BYTES of UTF-8 (`socialHandlers`), not characters: the
 * heaviest chronicle measured, the United States 2010 in Russian, was 37 519 characters and 48 005
 * bytes. A moment is cut into parts under MAX_BYTES (verification 07/10, T5).
 */
export const MAX_BYTES = 45_000;
const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s).length;

export interface ChronicleWords {
  /** "{country}, {span}" */
  title: string;
  /** "Source: Wikidata (CC0), read on {date}, through MnemoClio. Years only; c. = known to the decade or century." */
  source: string;
  regimes: string;
  rulers: string;
  wars: string;
  events: string;
  /** "{n} people on its land of today (estimate)" — null when there is no figure */
  people: ((year: number) => string | null) | null;
  /** "(continued)" */
  continued: string;
  kind: (k: Ev['k']) => string;
}

export interface Chronicle {
  /** Stable per country and moment: the same moment poured again is the same text, kept once. */
  sourceRef: string;
  start: number;
  size: number;
  content: string;
}

/**
 * The chronicles of one country, oldest first: only moments where something is dated. Regimes,
 * rulers and wars that overlap the moment are written in it; events of the country (its lane: `c`,
 * or the ended state `h` when the country IS that state).
 */
export function chroniclesOf(c: Country, history: History, events: readonly Ev[], name: (x: Named) => string, w: ChronicleWords, readAt: string): Chronicle[] {
  const mine = events.filter((e) => e.c === c.id || e.h === c.id).sort((a, b) => a.y - b.y || b.sl - a.sl);
  const byMoment = new Map<number, Ev[]>();
  for (const e of mine) { const m = periodOf(e.y).start; (byMoment.get(m) ?? byMoment.set(m, []).get(m)!).push(e); }
  const regimes = history.regimes.filter((r) => r.c === c.id);
  const rulers = history.leaders.filter((l) => l.c === c.id || l.h === c.id);
  const wars = history.wars.filter((x) => x.b.some((b) => b.c === c.id));
  const out: Chronicle[] = [];
  for (const [start, evs] of byMoment) {
    const size = periodOf(start).size;
    const end = start + size - 1;
    const span = fspan(start, end);
    const head = [
      `# ${w.title.replace('{country}', name(c)).replace('{span}', span)}`,
      w.source.replace('{date}', readAt),
    ];
    const people = w.people?.(start);
    if (people) head.push(people);
    const overlap = <T extends { s: number; e: number }>(xs: T[]) => xs.filter((x) => x.s <= end && x.e >= start);
    const body: string[] = [];
    const rg = overlap(regimes);
    if (rg.length) body.push(`${w.regimes} ${rg.map((r) => `${name(r)} (${fspan(r.s, r.e, r.open)})`).join(' ; ')}`);
    const ru = overlap(rulers).sort((a, b) => a.s - b.s);
    if (ru.length) body.push(`${w.rulers} ${ru.map((l) => `${name(l)} (${fspan(l.s, l.e, l.open)}, ${name(history.offices[l.of]!)})`).join(' ; ')}`);
    const wa = overlap(wars);
    if (wa.length) body.push(`${w.wars} ${wa.map((x) => `${name(x)} (${fspan(x.s, x.e)})`).join(' ; ')}`);
    body.push(w.events);
    const lines = evs.map((e) => `- ${fey(e)} · ${w.kind(e.k)} · ${name(e)}`);
    // cut a crowded moment into parts, each one carrying the head so it stands on its own
    let part = 0, buf: string[] = [];
    const flush = () => {
      const title = part === 0 ? head : [`${head[0]} ${w.continued}`, ...head.slice(1)];
      out.push({ sourceRef: `mnemo-clio:${c.id}:${start}${part ? ':' + part : ''}`, start, size, content: [...title, '', ...(part === 0 ? body : [w.events]), ...buf].join('\n') });
      part++; buf = [];
    };
    let used = bytes(head.join('\n')) + bytes(body.join('\n'));
    for (const l of lines) {
      const n = bytes(l) + 1;
      if (used + n > MAX_BYTES && buf.length) { flush(); used = bytes(head.join('\n')) + bytes(w.continued) + bytes(w.events) + 4; }
      buf.push(l); used += n;
    }
    flush();
  }
  return out;
}

/** The pack's name for a country: its English name, lowercase, letters and digits joined by dashes. */
export function packNameOf(c: Pick<Country, 'id' | 'en' | 'o'> & { nl?: Country['nl'] }): string {
  // today's 197 states carry their English name in `nl.en` (`en` is the era maps' key, set on ended
  // states only): reading `en` named Japan's pack "q17" and Spain's "espana" (verification 07/10, T3)
  const base = (c.nl?.en ?? c.en ?? c.o ?? c.id).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (base || c.id.toLowerCase()).slice(0, 40);
}
