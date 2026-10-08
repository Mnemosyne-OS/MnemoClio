/**
 * fact.ts — a fact of history on the person's board (doc 110's cockpit card).
 *
 * Field, 07/10: "cards of historical facts that appear on my dashboard". One card, id `fact`,
 * pinned by a press in MnemoClio; the fact changes with the day (the same for everyone on the
 * same day, the same all day long) or on a press. ⚠️ Our dates are YEARS: the card says
 * "in 1789", never "on this day" — the data cannot tell what happened on a given day.
 */
import type { Ev } from './types';

export const FACT_CARD_ID = 'fact';
/** Known enough to make a card: articles in at least this many Wikipedias. */
export const FACT_MIN_SL = 60;

/** The events a fact is drawn from, in an order that does not depend on how they loaded. */
export function factPool(events: readonly Ev[]): Ev[] {
  const seen = new Set<string>();
  const out: Ev[] = [];
  for (const e of events) if (e.sl >= FACT_MIN_SL && !seen.has(e.q)) { seen.add(e.q); out.push(e); }
  return out.sort((a, b) => Number(a.q.slice(1)) - Number(b.q.slice(1)));
}

/** The day as YYYY-MM-DD in the person's own time zone: the fact turns over at their midnight. */
export const dayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The fact of a day: the same for the same day, spread over the pool. */
export function factOfDay(pool: readonly Ev[], day: string): Ev | null {
  if (!pool.length) return null;
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) { h ^= day.charCodeAt(i); h = Math.imul(h, 16777619); }
  return pool[(h >>> 0) % pool.length]!;
}

/** Years from `y` to `now`, counting that there is no year 0. */
export const yearsAgo = (y: number, now: number): number => now - y - (y < 0 && now > 0 ? 1 : 0);

/** Elsewhere the same year: the best known event of another country. */
export function meanwhileOf(e: Ev, events: readonly Ev[]): Ev | null {
  let best: Ev | null = null;
  for (const x of events) if (x.y === e.y && x.q !== e.q && x.c && x.c !== e.c && (!best || x.sl > best.sl)) best = x;
  return best;
}

export interface FactWords {
  /** "{year} · {n} years ago" */
  when: string;
  /** "Meanwhile: {name} ({country})" */
  meanwhile: string;
  source: string;
}

export interface FactCard {
  id: string;
  title: string;
  mark: { label: string; tint: null; svg: null };
  status: string;
  seenAt: null;
  lines: string[];
  tone: 'idle';
  snapshot: true;
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** The card as the host draws it (its limits: title 120, status 160, 4 lines of 80). */
export function factCard(o: {
  name: string; year: string; ago: number; country: string | null; kind: string;
  meanwhile: { name: string; country: string | null } | null; words: FactWords;
}): FactCard {
  const w = o.words;
  const lines = [
    [o.kind, o.country].filter(Boolean).join(' · '),
    o.meanwhile ? w.meanwhile.replace('{name}', o.meanwhile.name).replace('{country}', o.meanwhile.country ?? '?') : '',
    w.source,
  ].filter(Boolean).map((l) => cut(l, 80));
  return {
    id: FACT_CARD_ID,
    title: cut(o.name, 120),
    mark: { label: '🕰', tint: null, svg: null },
    status: cut(w.when.replace('{year}', o.year).replace('{n}', String(o.ago)), 160),
    seenAt: null,
    lines,
    tone: 'idle',
    snapshot: true,
  };
}
