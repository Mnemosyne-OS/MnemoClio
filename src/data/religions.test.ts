import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { FAMILY_HUE, countsByFamily, decodeReligions, foundedIn, relName, standingAt, type RawReligions } from './religions';

const raw: RawReligions = {
  read: '2026-10-07',
  families: ['QJ', 'QC', 'QI'],
  p: [
    [1500, 10, 50, 1, null, 0, 1],
    [537, 28.98, 41.01, 1, null, 0, 12506], // Hagia Sophia, Christianity…
    [537, 28.98, 41.01, 2, null, 0, 12506], // …and Islam: both kept
    [1200, 5, 45, 0, 1400, 1, 3], // demolished in 1400, religion inferred from its class
    [1000, 0, 0, 3, null, 0, 4], // "other"
  ],
  c: [[1054, 0, null, null, 7], [400, 1, 35, 31, 8]],
  n: { Q12506: { en: 'Hagia Sophia', fr: 'Sainte-Sophie' } },
};
const r = decodeReligions(raw);

describe('religions', () => {
  it('sorted by founding year once', () => {
    expect(r.places.map((p) => p.y)).toEqual([537, 537, 1000, 1200, 1500]);
  });

  it('🚨 a place with two religions is two points, neither erases the other', () => {
    const hs = standingAt(r.places, 1600).filter((p) => p.q === 'Q12506');
    expect(hs.map((p) => p.fam).sort()).toEqual([1, 2]);
  });

  it('a place stands from its founding until the year it was demolished', () => {
    expect(standingAt(r.places, 1199).some((p) => p.q === 'Q3')).toBe(false);
    expect(standingAt(r.places, 1300).some((p) => p.q === 'Q3')).toBe(true);
    expect(standingAt(r.places, 1400).some((p) => p.q === 'Q3')).toBe(false);
    expect(standingAt(r.places, 1300).find((p) => p.q === 'Q3')!.inferred).toBe(true);
  });

  it('counted per family in the fixed order, "other" kept and counted last', () => {
    expect(countsByFamily(standingAt(r.places, 1600), 3)).toEqual([0, 2, 1, 1]);
  });

  it('currents founded in a moment; one known to the century is approximate', () => {
    expect(foundedIn(r.currents, 1050, 10).map((c) => c.q)).toEqual(['Q7']);
    expect(r.currents.find((c) => c.q === 'Q8')!.about).toBe(true);
  });

  it('a name in the person\'s language, else English', () => {
    expect(relName(r, 'Q12506', 'fr')).toBe('Sainte-Sophie');
    expect(relName(r, 'Q12506', 'ru')).toBe('Hagia Sophia');
  });

  it('one fixed colour per family', () => {
    expect(FAMILY_HUE.length).toBe(12);
    expect(new Set(FAMILY_HUE).size).toBe(12);
  });

  const file = join(__dirname, '..', '..', 'public', 'data', 'religions.json');
  it.runIf(existsSync(file))('the real file: Hagia Sophia carries at least two families along its dates, nothing founded after 2025', () => {
    const real = decodeReligions(JSON.parse(readFileSync(file, 'utf8')) as RawReligions);
    expect(real.families.length).toBe(12);
    expect(new Set(real.places.filter((p) => p.q === 'Q12506').map((p) => p.fam)).size).toBeGreaterThanOrEqual(2);
    expect(real.places.every((p) => p.y <= 2025)).toBe(true);
    expect(real.places.length).toBeGreaterThan(8000);
    // its religions follow their dates: Christian in 1000, Islamic in 1500, a museum (neither) in 1950
    const fams = (y: number) => standingAt(real.places, y).filter((p) => p.q === 'Q12506').map((p) => real.families[p.fam]);
    expect(fams(1000)).toEqual(['Q5043']);
    expect(fams(1500)).toEqual(['Q432']);
    expect(fams(1950)).toEqual([]);
  });
});
