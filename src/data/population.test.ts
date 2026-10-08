import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { fmtPop, popAt, womenAt, type Population } from './population';

const s = [-3000, 1000, 1000, 4000, 1950, 10000, 1951, 10100];

describe('population', () => {
  it('a known year is the known figure; before 1950 it is a reconstruction, written about', () => {
    expect(popAt(s, 1000)).toEqual({ v: 4000, about: true, source: 'hyde' });
    expect(popAt(s, 1950.7)).toEqual({ v: 10000, about: false, source: 'un' });
  });

  it('between two known years it grows by a share, not by a number', () => {
    // half-way from 1 000 to 4 000 geometrically is 2 000, not 2 500
    expect(popAt(s, -1000)!.v).toBe(2000);
    expect(popAt(s, -1000)!.about).toBe(true);
  });

  it('outside the series there is no figure, never a zero', () => {
    expect(popAt(s, -3001)).toBeNull();
    expect(popAt(s, 1952)).toBeNull();
    expect(popAt(undefined, 1900)).toBeNull();
    expect(popAt([], 1900)).toBeNull();
  });

  it('the share of women is said from its first year only', () => {
    const w = [1960, 50, 1970, 52];
    expect(womenAt(w, 1959)).toBeNull();
    expect(womenAt(w, 1960)).toBe(50);
    expect(womenAt(w, 1965)).toBe(51);
  });

  it('written short, in the person\'s language', () => {
    expect(fmtPop(1_270_000_000, 'en')).toBe('1.27B');
    expect(fmtPop(1_270_000_000, 'fr')).toMatch(/^1,27\s?Md$/);
  });

  it('the real file: the world of 1800 near a billion, France of 1789 between its two neighbours', () => {
    const p = JSON.parse(readFileSync(join(__dirname, '..', '..', 'public', 'data', 'population.json'), 'utf8')) as Population;
    const w = popAt(p.world, 1800)!.v;
    expect(w).toBeGreaterThan(9e8);
    expect(w).toBeLessThan(1.1e9);
    const fr = popAt(p.c.Q142, 1789)!;
    expect(fr.about).toBe(true);
    expect(fr.v).toBeGreaterThan(popAt(p.c.Q142, 1700)!.v);
    expect(fr.v).toBeLessThan(popAt(p.c.Q142, 1900)!.v);
    // no forecast: the timeline stops at 2025
    expect(Math.max(...p.world.filter((_, i) => i % 2 === 0))).toBeLessThanOrEqual(2025);
  });
});
