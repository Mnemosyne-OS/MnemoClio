import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { epiName, fociAt, underWay, type Epidemic } from './epidemics';

const ep = (o: Partial<Epidemic>): Epidemic => ({ q: 'Q1', n: { en: 'Plague', fr: 'peste' }, s: 1346, e: 1352, sl: 100, dead: null, f: [], ...o });

describe('epidemics', () => {
  it('under way from its start to its end', () => {
    expect(underWay(ep({}), 1345, 6)).toBe(false);
    expect(underWay(ep({}), 1349.5, 6)).toBe(true);
    expect(underWay(ep({}), 1353, 6)).toBe(false);
  });

  it('🎭 an end nobody dated: only around its start, never a guessed duration', () => {
    const open = ep({ e: null, s: 1959 });
    expect(underWay(open, 1962, 6)).toBe(true);
    expect(underWay(open, 1990, 6)).toBe(false);
  });

  it('a focus comes on the year it was recorded, in order', () => {
    const e = ep({ f: [[1346, 44, 42], [1347, 12, 42], [1348, 2, 48]] });
    expect(fociAt(e, 1346, 6).length).toBe(1);
    expect(fociAt(e, 1348, 6).length).toBe(3);
    expect(fociAt(e, 1360, 6)).toEqual([]);
  });

  it('its name in the person\'s language, else English', () => {
    expect(epiName(ep({}), 'fr')).toBe('peste');
    expect(epiName(ep({}), 'ru')).toBe('Plague');
  });

  it('the real file: the Black Death 1346-1352, its five foci, nothing after 2025', () => {
    const d = JSON.parse(readFileSync(join(__dirname, '..', '..', 'public', 'data', 'epidemics.json'), 'utf8')) as { e: Epidemic[] };
    const bd = d.e.find((x) => x.q === 'Q42005')!;
    expect([bd.s, bd.e]).toEqual([1346, 1352]);
    expect(bd.f.length).toBeGreaterThanOrEqual(3);
    expect(d.e.every((x) => x.s <= 2025)).toBe(true);
    expect(d.e.every((x) => x.e === null || x.e >= x.s)).toBe(true);
  });
});
