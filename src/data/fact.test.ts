import { describe, expect, it } from 'vitest';
import type { Ev } from './types';
import { FACT_MIN_SL, dayKey, factCard, factOfDay, factPool, meanwhileOf, yearsAgo } from './fact';

const ev = (q: string, y: number, c: string | null, sl: number): Ev => ({ q, y, c, sl, o: q, ol: 'en', f: null, k: 'society', h: null, lon: null, lat: null, sub: null });
const words = { when: '{year} · {n} years ago', meanwhile: 'Meanwhile: {name} ({country})', source: 'Wikidata' };

describe('the fact on the board', () => {
  it('drawn among the well known, once each, in an order that does not depend on loading', () => {
    const a = [ev('Q30', 1789, 'Q142', 200), ev('Q2', 1066, 'Q145', 90), ev('Q5', 1900, 'Q17', FACT_MIN_SL - 1), ev('Q2', 1066, 'Q145', 90)];
    expect(factPool(a).map((e) => e.q)).toEqual(['Q2', 'Q30']);
    expect(factPool([...a].reverse()).map((e) => e.q)).toEqual(['Q2', 'Q30']);
  });

  it('the same day gives the same fact, and the days spread over the pool', () => {
    const pool = factPool(Array.from({ length: 50 }, (_, i) => ev('Q' + (i + 1), 1800 + i, 'Q142', 100)));
    expect(factOfDay(pool, '2026-10-07')).toBe(factOfDay(pool, '2026-10-07'));
    const seen = new Set(Array.from({ length: 30 }, (_, d) => factOfDay(pool, `2026-10-${String(d + 1).padStart(2, '0')}`)!.q));
    expect(seen.size).toBeGreaterThan(10);
    expect(factOfDay([], '2026-10-07')).toBeNull();
  });

  it('the day turns at the person\'s own midnight', () => {
    expect(dayKey(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07');
    expect(dayKey(new Date(2026, 9, 8, 0, 1))).toBe('2026-10-08');
  });

  it('years ago, with no year 0', () => {
    expect(yearsAgo(1789, 2026)).toBe(237);
    expect(yearsAgo(-44, 2026)).toBe(2069);
  });

  it('meanwhile is the best known event of ANOTHER country the same year', () => {
    const e = ev('Q1', 1789, 'Q142', 200);
    const all = [e, ev('Q2', 1789, 'Q142', 150), ev('Q3', 1789, 'Q30', 80), ev('Q4', 1789, 'Q30', 120), ev('Q5', 1790, 'Q17', 300), ev('Q6', 1789, null, 999)];
    expect(meanwhileOf(e, all)?.q).toBe('Q4');
    expect(meanwhileOf(e, [e])).toBeNull();
  });

  it('the card says the year, never a day, and stays inside the host limits', () => {
    const c = factCard({ name: 'x'.repeat(200), year: '1789', ago: 237, country: 'France', kind: 'Society', meanwhile: { name: 'y'.repeat(100), country: 'United States' }, words });
    expect(c.id).toBe('fact');
    expect(c.status).toBe('1789 · 237 years ago');
    expect(c.title.length).toBe(120);
    expect(c.lines[0]).toBe('Society · France');
    expect(c.lines.every((l) => l.length <= 80)).toBe(true);
    expect(c.lines.length).toBeLessThanOrEqual(4);
  });

  it('no meanwhile, no line for it; no country, the kind alone', () => {
    const c = factCard({ name: 'n', year: '1789', ago: 237, country: null, kind: 'Society', meanwhile: null, words });
    expect(c.lines).toEqual(['Society', 'Wikidata']);
  });
});
