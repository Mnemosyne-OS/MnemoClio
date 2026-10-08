import { describe, expect, it } from 'vitest';
import type { Country, Ev, History, Named } from './types';
import { MAX_BYTES, chroniclesOf, packNameOf, type ChronicleWords } from './chronicle';

const country = { id: 'Q142', o: 'France', ol: 'fr', f: 'France', en: 'France', lang: 'fr', n: 0, h: 0, s: null, kind: 'state', e: null, nl: {} } as Country;
const ev = (q: string, y: number, o: string, extra: Partial<Ev> = {}): Ev => ({ q, y, o, ol: 'fr', f: o, k: 'society', c: 'Q142', h: null, lon: null, lat: null, sl: 50, sub: null, ...extra });
const history = {
  countries: [country],
  regimes: [{ id: 'R1', c: 'Q142', s: 1792, e: 1804, o: 'Première République', ol: 'fr', f: 'Première République', open: false, next: null, nl: null }],
  leaders: [{ q: 'L1', o: 'Robespierre', ol: 'fr', f: 'Robespierre', c: 'Q142', h: null, of: 0, s: 1793, e: 1794, open: false, sl: 10 }],
  offices: [{ id: 'O1', o: 'chef', ol: 'fr', f: 'chef', k: 'gov' }],
  wars: [{ id: 'W1', o: 'guerres de la Révolution', ol: 'fr', f: 'guerres de la Révolution', c: 'Q142', s: 1792, e: 1802, groups: {}, b: [{ o: 'Valmy', ol: 'fr', f: 'Valmy', y: 1792, c: 'Q142', lon: null, lat: null, g: null }] }],
  periods: [],
} as unknown as History;
const name = (x: Named) => x.f ?? x.o;
const words: ChronicleWords = {
  title: '{country}, {span}', source: 'Source : Wikidata (CC0), lu le {date}, via MnemoClio.', regimes: 'Régimes :', rulers: 'Au pouvoir :', wars: 'Guerres :', events: 'Événements :',
  people: (y) => (y >= 1700 ? `≈ 28 M d'habitants en ${y}` : null), continued: '(suite)', kind: () => 'Société',
};

describe('the chronicles of a country', () => {
  it('one per moment, each carrying its title, its source and its date of reading', () => {
    const cs = chroniclesOf(country, history, [ev('E1', 1789, 'Révolution française'), ev('E2', 1792, 'bataille de Valmy'), ev('E3', 1066, 'Hastings', { c: 'Q145' })], name, words, '2026-10-07');
    expect(cs.map((c) => [c.start, c.size])).toEqual([[1780, 10], [1790, 10]]);
    expect(cs[0]!.content.startsWith('# France, 1780–1789')).toBe(true);
    expect(cs[0]!.content).toContain('lu le 2026-10-07');
    expect(cs[0]!.content).toContain('- 1789 · Société · Révolution française');
    expect(cs[0]!.content).toContain("≈ 28 M d'habitants en 1780");
  });

  it('what overlaps the moment is written in it: regimes, who ruled, wars', () => {
    const [, c90] = chroniclesOf(country, history, [ev('E1', 1789, 'a'), ev('E2', 1795, 'b')], name, words, 'd');
    expect(c90!.content).toContain('Régimes : Première République (1792–1804)');
    expect(c90!.content).toContain('Au pouvoir : Robespierre (1793–1794, chef)');
    expect(c90!.content).toContain('Guerres : guerres de la Révolution (1792–1802)');
  });

  it('another country\'s events are not in it; a moment with nothing dated has no chronicle', () => {
    expect(chroniclesOf(country, history, [ev('E3', 1066, 'Hastings', { c: 'Q145' })], name, words, 'd')).toEqual([]);
  });

  it('the same moment poured twice is the same text under the same reference (kept once)', () => {
    const a = chroniclesOf(country, history, [ev('E1', 1789, 'x')], name, words, 'd');
    const b = chroniclesOf(country, history, [ev('E1', 1789, 'x')], name, words, 'd');
    expect(a).toEqual(b);
    expect(a[0]!.sourceRef).toBe('mnemo-clio:Q142:1780');
  });

  it('a crowded moment is cut into parts under the host limit, each standing on its own', () => {
    const many = Array.from({ length: 3000 }, (_, i) => ev('E' + i, 1900 + (i % 10), 'un événement au nom assez long pour remplir la chronique ' + i));
    const cs = chroniclesOf(country, history, many, name, words, 'd');
    expect(cs.length).toBeGreaterThan(1);
    expect(cs.every((c) => new TextEncoder().encode(c.content).length <= MAX_BYTES)).toBe(true);
    expect(cs[1]!.content.startsWith('# France, 1900–1909 (suite)')).toBe(true);
    expect(cs[1]!.content).toContain('Source : Wikidata');
    expect(new Set(cs.map((c) => c.sourceRef)).size).toBe(cs.length);
    expect(cs.reduce((n, c) => n + c.content.split('\n').filter((l) => l.startsWith('- ')).length, 0)).toBe(3000);
  });

  it('🚨 cut in BYTES: names in Cyrillic weigh two bytes a letter and stay under the host limit', () => {
    const many = Array.from({ length: 2000 }, (_, i) => ev('E' + i, 2010 + (i % 10), 'Событие с довольно длинным русским названием номер ' + i));
    const cs = chroniclesOf(country, history, many, name, words, 'd');
    expect(cs.every((c) => new TextEncoder().encode(c.content).length <= MAX_BYTES)).toBe(true);
  });

  it('a state of today is named by its English name, which lives in nl.en', () => {
    expect(packNameOf({ id: 'Q17', en: null, o: '日本', nl: { en: 'Japan' } })).toBe('japan');
    expect(packNameOf({ id: 'Q29', en: null, o: 'España', nl: { en: 'Spain' } })).toBe('spain');
  });

  it('the pack is named after the country, in plain letters', () => {
    expect(packNameOf(country)).toBe('france');
    expect(packNameOf({ id: 'Q1', en: 'Côte d’Ivoire', o: 'x' })).toBe('cote-d-ivoire');
    expect(packNameOf({ id: 'Q9', en: null, o: '日本' })).toBe('q9');
  });
});
