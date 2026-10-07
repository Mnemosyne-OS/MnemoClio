import { describe, expect, it } from 'vitest';
import { LAST_YEAR, crossed, decodeEvents, decodeHistory, firstAtOrAfter, hueOf, uniqueByQ } from './decode';
import { eraFor, polityNameIndex, shapesFrom, simplify, ERA_YEARS } from './era';

const countries = [
  { id: 'Q142', lang: 'fr', o: 'France', ol: 'fr', f: 'France', n: 1053, h: 0, s: 843, kind: 'state' as const, e: null, en: 'France' },
  { id: 'Q17', lang: 'ja', o: '日本', ol: 'ja', f: 'Japon', n: 397, h: 137, s: null, kind: 'state' as const, e: null, en: 'Japan' },
];

describe('decodeEvents', () => {
  const raw = { kind: 'person' as const, langs: ['fr', 'ja', 'en'], subs: ['physicien'], rows: [
    [1871, 0, 2.35, 48.85, 191, 'Marcel Proust', 0, 1, -1, 7199],
    [1879, -1, null, null, 321, 'Albert Einstein', 2, 'Albert Einstein', 0, 937],
    [1900, 1, null, null, 50, '某人', 1, 0, -1, 1],
    ['bad', 0, null, null, 1, 'x', 0, 0, -1, 2],
    [1901, 9, null, null, 1, 'ghost country', 0, 0, -1, 3],
  ] };
  const { events, dropped } = decodeEvents(raw, countries);

  it('reads a French label of 1 as "same as the original" and 0 as "none on Wikidata", never as a name', () => {
    expect(events[0]!.f).toBe('Marcel Proust');
    expect(events[2]!.f).toBeNull();
  });

  it('keeps an event Wikidata ties to no country, with no country, not a made-up one', () => {
    expect(events[1]!.c).toBeNull();
    expect(events[1]!.sub).toBe('physicien');
  });

  it('drops and COUNTS a row it cannot read, and a row pointing at a country that is not there', () => {
    expect(events).toHaveLength(3);
    expect(dropped).toBe(2);
  });

  it('keeps the language the name is written in', () => {
    expect(events[2]!.ol).toBe('ja');
    expect(events[0]!.q).toBe('Q7199');
  });
});

describe('decodeHistory', () => {
  const h = decodeHistory({
    countries: countries.map(({ h: _h, ...c }) => c),
    wars: [],
    periods: [],
    states: [
      { id: 'A', c: 'Q142', s: 1830, e: null, next: 'B', nl: null, o: 'A', ol: 'fr', f: 'A' },
      { id: 'B', c: 'Q142', s: 1848, e: 1852, next: null, nl: null, o: 'B', ol: 'fr', f: null },
      { id: 'C', c: 'Q142', s: 1900, e: null, next: null, nl: null, o: 'C', ol: 'fr', f: 'C' },
      { id: 'D', c: 'Q142', s: 1910, e: 1910, next: null, nl: null, o: 'D', ol: 'fr', f: 'D' },
    ],
  });
  it('an open end runs to its successor', () => {
    expect(h.regimes[0]!.e).toBe(1848);
    expect(h.regimes[0]!.open).toBe(false);
  });
  it('no end and no successor is OPEN: drawn to the last year, never presented as still running', () => {
    expect(h.regimes[2]!.e).toBe(LAST_YEAR);
    expect(h.regimes[2]!.open).toBe(true);
  });
  it('a regime of a single year is still one year wide', () => {
    expect(h.regimes[3]!.e).toBe(1911);
  });
  it('gives neighbouring countries different hues', () => {
    expect(hueOf(0)).not.toBe(hueOf(1));
  });
});

describe('an ended state on the era map', () => {
  const cs = [
    { id: 'Q12560', kind: 'ended', s: 1299, e: 1922, en: 'Ottoman Empire' },
    { id: 'Q15180', kind: 'ended', s: 1922, e: 1991, en: 'Soviet Union' },
    { id: 'Q184536', kind: 'ended', s: 1226, e: 1670, en: 'Mali Empire' },
    { id: 'Q912', kind: 'state', s: 1960, e: null, en: 'Mali' },
  ];
  it('takes the colour of its polities by their English name on a map dated within its life', () => {
    const idx = polityNameIndex(cs, ['Q12560', 'Q15180'], 1815);
    expect(idx.get('ottoman empire')).toBe('Q12560');
    // the USSR does not exist in 1815: no polity of that map is coloured as Soviet
    expect([...idx.values()]).not.toContain('Q15180');
  });
  it('a name the maps spell differently goes through the alias table (Soviet Union → USSR)', () => {
    expect(polityNameIndex(cs, ['Q15180'], 1945).get('ussr')).toBe('Q15180');
  });
  it('outside its life a name is a homonym: the Mali of 1960 is not the Mali Empire', () => {
    expect(polityNameIndex(cs, ['Q184536'], 1960).size).toBe(0);
    expect(polityNameIndex(cs, ['Q184536'], 1500).get('mali')).toBe('Q184536');
    // a state of today is never matched by name (it is matched by its land)
    expect(polityNameIndex(cs, ['Q912'], 1960).size).toBe(0);
  });
});

describe('ended states and territories', () => {
  const withOttoman = [...countries, { id: 'Q12560', lang: 'ota', o: 'دولت عليه عثمانیه', ol: 'ota', f: 'Empire ottoman', n: 0, h: 274, s: 1299, kind: 'ended' as const, e: 1922, en: 'Ottoman Empire' }];
  it('an event keeps the polity Wikidata ties it to directly, beside the country it resolved to', () => {
    const { events } = decodeEvents({ kind: 'violence', langs: ['en'], subs: [], rows: [
      [1683, 0, null, null, 40, 'Battle', 0, 0, -1, 1, 2],
      [1700, 0, null, null, 40, 'No polity', 0, 0, -1, 2, -1],
      [1701, 0, null, null, 40, 'Old file', 0, 0, -1, 3],
      [1702, 0, null, null, 40, 'Polity nowhere', 0, 0, -1, 4, 99],
    ] }, withOttoman);
    expect(events[0]!.h).toBe('Q12560');
    expect(events[0]!.c).toBe('Q142');
    expect(events[1]!.h).toBeNull();
    // a row from before the column existed, and an index pointing nowhere: no polity, never a guess
    expect(events[2]!.h).toBeNull();
    expect(events[3]!.h).toBeNull();
  });
  it('an ended state keeps its span; a country written before the kinds existed reads as one of today', () => {
    const h = decodeHistory({ countries: [
      { id: 'Q12560', lang: 'ota', o: 'x', ol: 'ota', f: null, n: 1, s: 1299, kind: 'ended', e: 1922, en: 'Ottoman Empire' },
      { id: 'Q142', lang: 'fr', o: 'France', ol: 'fr', f: 'France', n: 1 },
    ], wars: [], periods: [], states: [] });
    expect(h.countries[0]).toMatchObject({ kind: 'ended', s: 1299, e: 1922 });
    expect(h.countries[1]).toMatchObject({ kind: 'state', e: null, s: null });
  });
});

describe('leaders', () => {
  const base = { countries: [{ id: 'Q30', lang: 'en', o: 'United States', ol: 'en', f: 'États-Unis', n: 1, s: 1776 }], wars: [], periods: [], states: [] };
  it('reads who led a country, and keeps a term of a single year one year wide', () => {
    const h = decodeHistory({ ...base,
      offices: [{ id: 'Q11696', k: 'state', o: 'President of the United States', ol: 'en', f: 'président des États-Unis' }],
      leaders: [{ c: 'Q30', of: 0, s: 1861, e: 1865, open: false, o: 'Abraham Lincoln', ol: 'en', f: 'Abraham Lincoln', q: 'Q91', sl: 300 },
        { c: 'Q30', of: 0, s: 1841, e: 1841, open: false, o: 'William Henry Harrison', ol: 'en', f: null, q: 'Q11869', sl: 90 }] });
    expect(h.leaders[0]!.o).toBe('Abraham Lincoln');
    expect(h.leaders[1]!.e).toBe(1842);
    expect(h.leaders[1]!.f).toBeNull();
  });
  it('a term pointing at an office that is not there is left out, not drawn under a made-up office', () => {
    const h = decodeHistory({ ...base, offices: [], leaders: [{ c: 'Q30', of: 3, s: 1861, e: 1865, open: false, o: 'x', ol: 'en', f: null, q: 'Q1', sl: 1 }] });
    expect(h.leaders).toEqual([]);
  });
  it('data written before the leaders were read gives no leaders, never a crash', () => {
    const h = decodeHistory(base);
    expect(h.leaders).toEqual([]);
    expect(h.offices).toEqual([]);
    expect(h.countries[0]!.s).toBe(1776);
  });
});

describe('the play cursor', () => {
  const sorted = [{ y: 1870 }, { y: 1871 }, { y: 1871 }, { y: 1875 }];
  it('passes the events of the years it enters, once', () => {
    expect(crossed(sorted, 1869.8, 1871.2)).toHaveLength(3);
    expect(crossed(sorted, 1871.2, 1871.9)).toHaveLength(0);
    expect(crossed(sorted, 1871.9, 1875.0)).toHaveLength(1);
  });
  it('going backwards passes nothing', () => {
    expect(crossed(sorted, 1875, 1870)).toEqual([]);
  });
  it('binary search lands on the first event of a year', () => {
    expect(firstAtOrAfter(sorted, 1871)).toBe(1);
    expect(firstAtOrAfter(sorted, 2000)).toBe(4);
  });
});

describe('era borders', () => {
  it('uses the latest map not after the year, and the first one before it', () => {
    expect(eraFor(1870)).toBe(1815);
    expect(eraFor(1914)).toBe(1914);
    expect(eraFor(1450)).toBe(1400);
    expect(eraFor(-44)).toBe(-100);
    expect(eraFor(-5000)).toBe(ERA_YEARS[0]);
  });

  it('simplifies a closed ring without collapsing it (a closed ring measures to its start point)', () => {
    const square: Array<[number, number]> = [[0, 0], [5, 0.01], [10, 0], [10, 10], [0, 10], [0, 0]];
    const s = simplify(square, 0.1);
    expect(s.length).toBeGreaterThanOrEqual(4);
    expect(s).not.toContainEqual([5, 0.01]);
  });

  it('keeps the source name and the ruling polity of a shape', () => {
    const shapes = shapesFrom([{ properties: { NAME: 'Algeria', SUBJECTO: 'France' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] } }]);
    expect(shapes[0]).toMatchObject({ n: 'Algeria', subj: 'France' });
    expect(shapes[0]!.bb[0]).toEqual([0, 4, 0, 4]);
  });

  it('keeps one of each item filed under two subjects, the first, in order', () => {
    expect(uniqueByQ([{ q: 'Q1', k: 'law' }, { q: 'Q2', k: 'law' }, { q: 'Q1', k: 'treaty' }])).toEqual([{ q: 'Q1', k: 'law' }, { q: 'Q2', k: 'law' }]);
  });
});

describe('approximate dates', () => {
  it('marks a date approximate only on an explicit 1, never on a missing or other value', () => {
    const { events } = decodeEvents({ kind: 'person', langs: ['en'], subs: [], rows: [
      [-400, -1, null, null, 20, 'Century', 0, 0, -1, 1, -1, 1],
      [-427, -1, null, null, 20, 'Year', 0, 0, -1, 2, -1],
      [-300, -1, null, null, 20, 'Odd value', 0, 0, -1, 3, -1, 2],
    ] }, countries);
    expect(events.map((e) => e.a ?? false)).toEqual([true, false, false]);
  });
});
