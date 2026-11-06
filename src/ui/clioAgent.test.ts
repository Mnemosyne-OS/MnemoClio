/**
 * The agent's moves in MnemoClio (doc 149) over a real Scene and a tiny history: each one
 * reaches the app's own move, the timeline GLIDES (target set, view not yet there), and every
 * refusal names what to call instead.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scene } from '@mnemosyne_os/timeline-map/scene';
import { centreOn, span } from '@mnemosyne_os/timeline-map/view';
import type { When } from '@mnemosyne_os/timeline-map/when';
import { KINDS, type Country, type Ev, type History, type Named } from '../data/types';
import type { LayerState } from '../data/layers';
import type { Picked } from '../engine/picked';
import { clioAgentHandlers, resolveCountry, type ClioAgentContext } from './clioAgent';

const named = (o: string, f: string | null = null): Named => ({ o, ol: 'fr', f });
const country = (id: string, o: string, en: string, kind: Country['kind'] = 'state', nl: Record<string, string> = {}): Country =>
  ({ ...named(o), id, lang: null, n: 10, h: 0, s: null, kind, e: null, en, nl });
const ev = (q: string, o: string, y: number, c: string | null, k: Ev['k'] = 'treaty'): Ev =>
  ({ ...named(o), q, y, c, h: null, k, lon: null, lat: null, sl: 5, sub: null });

const history: History = {
  countries: [country('Q142', 'France', 'France'), country('Q183', 'Deutschland', 'Germany', 'state', { de: 'Deutschland' }), country('Q30971', 'Polynésie française', 'French Polynesia', 'territory')],
  regimes: [
    { ...named('Monarchie de Juillet'), id: 'R1', c: 'Q142', s: 1830, e: 1848, open: false, next: null, nl: null },
    { ...named('Empire'), id: 'R2', c: 'Q142', s: 1804, e: 1814, open: false, next: null, nl: null },
    { ...named('Empire'), id: 'R2', c: 'Q183', s: 1871, e: 1918, open: false, next: null, nl: null },
  ],
  wars: [{ ...named('Guerre de Cent Ans'), id: 'W1', c: 'Q142', s: 1337, e: 1453, groups: {}, b: [] }],
  periods: [{ ...named('Révolution française'), id: 'P1', s: 1789, e: 1799, kids: [], alsoWar: false }],
  leaders: [],
  offices: [],
};
const all = [ev('Q1', 'Prise de la Bastille', 1789, 'Q142'), ev('Q2', 'Traité de Versailles', 1919, 'Q142'), ev('Q3', 'Bauhaus', 1919, 'Q183', 'building')];

let scene: Scene;
afterEach(() => scene?.dispose());

function setup(over: Partial<ClioAgentContext> = {}) {
  scene = new Scene(1870, 220);
  const picks: Array<Picked | null> = [];
  const consent = { ok: false, asked: false };
  const layers: LayerState = { wars: true, clouds: true, leaders: true, epi: true, rel: false, kinds: new Set(KINDS) };
  const ctx: ClioAgentContext = {
    scene, history, all, byQ: new Map(all.map((e) => [e.q, e])), laneEvents: all.filter((e) => e.c === 'Q142'),
    shown: ['Q142'], setShown: (n) => { ctx.shown = n; }, kinds: layers.kinds, layerState: layers,
    setLayerState: (n) => { ctx.layerState = n; ctx.kinds = n.kinds; }, borders: 'now', picked: null,
    pick: (p) => { picks.push(p); ctx.picked = p; }, name: (x) => x.o, reduceMotion: false,
    // App's own goToWhen and loopWhen
    goToWhen: (w: When) => {
      scene.setLoop(null);
      if (w.kind === 'year') scene.setTarget(centreOn(w.a + 0.5, Math.min(600, span(scene.target))), false);
      else scene.setTarget({ y0: w.a, y1: w.b + 1 }, false);
    },
    loopWhen: (w: When) => { scene.setTarget({ y0: w.a, y1: w.b + 1 }, true); if (scene.setLoop({ a: w.a, b: w.b + 1 })) scene.setPlaying(true); },
    speeds: [1, 5, 20, 60], loaded: { subjects: 3, of: 17 }, role: 'main',
    tr: false, setTr: (on) => { ctx.tr = on; }, setBorders: (b) => { ctx.borders = b; },
    showEra: () => { if (consent.ok) { ctx.borders = 'era'; return true; } consent.asked = true; return false; },
    eraConsented: () => consent.ok, randomMoment: () => { scene.setTarget(centreOn(1500.5, 60), true); scene.setPlaying(true); }, ...over,
  };
  const h = clioAgentHandlers(() => ctx);
  return { ctx, h, picks, consent };
}

describe('goTo', () => {
  it('a period read from text fills the screen, gliding (the view is not there yet)', () => {
    const { h } = setup();
    const before = scene.view;
    const r = h.goTo({ when: 'XVe siècle' });
    expect(scene.target).toEqual({ y0: 1401, y1: 1501 });
    expect(scene.view).toEqual(before);
    expect(r).toMatchObject({ goingTo: { from: 1401, to: 1501 }, animated: true });
  });

  it('a year with a span is that zoom around it', () => {
    const { h } = setup();
    const before = scene.view;
    h.goTo({ year: -44, span: 20 });
    expect(scene.target).toEqual(centreOn(-43.5, 20));
    expect(scene.view).toEqual(before);
  });

  it('a year alone keeps the zoom, never wider than 600 years', () => {
    const { h } = setup();
    scene.setTarget({ y0: -3000, y1: 2000 }, true);
    h.goTo({ year: 1066 });
    expect(span(scene.target)).toBe(600);
  });

  it('refuses a name, year 0, two ways at once and a span on a period', () => {
    const { h } = setup();
    expect(() => h.goTo({ when: 'Atlantide' })).toThrow(/^NOT_A_TIME: "Atlantide" names no year or period, and no event, war/);
    expect(() => h.goTo({ year: 0 })).toThrow(/^BAD_ARG: there is no year 0/);
    expect(() => h.goTo({ year: 1789, when: '1789' })).toThrow(/^BAD_ARG: give one of/);
    expect(() => h.goTo({ from: 1914, to: 1918, span: 10 })).toThrow(/^BAD_ARG: span goes with a single year/);
    expect(() => h.goTo({ from: 1918, to: 1914 })).toThrow(/^BAD_ARG: from comes before to/);
  });
});

describe('open', () => {
  it('an event is picked through the app\'s own pick', () => {
    const { h, picks } = setup();
    const r = h.open({ type: 'event', id: 'Q1' });
    expect(picks).toEqual([{ type: 'event', q: 'Q1' }]);
    expect(r.opened).toMatchObject({ name: 'Prise de la Bastille', year: 1789 });
  });

  it('a regime brings its country first, as the search pill does', () => {
    const { h, ctx, picks } = setup();
    h.open({ type: 'regime', id: 'R2', country: 'Q183' });
    expect(ctx.shown).toEqual(['Q142', 'Q183']);
    expect(picks).toEqual([{ type: 'regime', id: 'R2', c: 'Q183' }]);
  });

  it('a regime id held by two countries is refused without its country', () => {
    const { h } = setup();
    expect(() => h.open({ type: 'regime', id: 'R2' })).toThrow(/^AMBIGUOUS: .*pass country/);
  });

  it('an unknown item is refused NO_ITEM', () => {
    const { h } = setup();
    expect(() => h.open({ type: 'war', id: 'W9' })).toThrow(/^NO_ITEM: no war named "W9"/);
  });
});

describe('search', () => {
  it('finds by name and hands back the fields open takes', () => {
    const { h } = setup();
    const r = h.search({ text: 'va à la Révolution française' });
    expect(r.periods).toEqual([expect.objectContaining({ open: { type: 'period', id: 'P1' }, from: 1789 })]);
    expect(h.search({ text: 'versailles' }).events[0]).toMatchObject({ open: { type: 'event', id: 'Q2' }, year: 1919 });
  });

  it('reads a time in the text', () => {
    const { h } = setup();
    expect(h.search({ text: '1914 à 1918' }).when).toEqual({ kind: 'range', from: 1914, to: 1918 });
  });
});

describe('countries', () => {
  it('resolve by id, by name in any language, a state before a territory', () => {
    expect(resolveCountry(history.countries, 'Q183').id).toBe('Q183');
    expect(resolveCountry(history.countries, 'germany').id).toBe('Q183');
    expect(resolveCountry(history.countries, 'Deutschland').id).toBe('Q183');
    expect(resolveCountry(history.countries, 'fran').id).toBe('Q142');
  });

  it('a name that two countries answer to is refused AMBIGUOUS with both ids, never the first one', () => {
    const congos = [
      country('Q971', 'République du Congo', 'Republic of the Congo', 'state', { fr: 'Congo', en: 'Congo' }),
      country('Q974', 'République démocratique du Congo', 'Democratic Republic of the Congo', 'state', { fr: 'Congo', en: 'Congo' }),
    ];
    // two exact names
    expect(() => resolveCountry(congos, 'Congo')).toThrow(/^AMBIGUOUS: "Congo" names several countries: .*Q971.*Q974.*say which/);
    // two partial names, both of today's states
    expect(() => resolveCountry(congos, 'republic of the con')).toThrow(/^AMBIGUOUS: .*Q971.*Q974/);
  });

  it('an unknown name says how to list the ids', () => {
    expect(() => resolveCountry(history.countries, 'Atlantis')).toThrow(/^NO_COUNTRY: .*listCountries/);
    // the names that start like it, for the orb's repair call
    expect(() => resolveCountry(history.countries, 'Francia del sur')).toThrow(/^NO_COUNTRY: no country named "Francia del sur"; countries: France/);
  });

  it('choose adds, removes, and never empties the timeline', () => {
    const { h, ctx } = setup();
    h.chooseCountries({ add: ['Germany'] });
    expect(ctx.shown).toEqual(['Q142', 'Q183']);
    h.chooseCountries({ remove: ['Q142'] });
    expect(ctx.shown).toEqual(['Q183']);
    expect(() => h.chooseCountries({ remove: ['Q183'] })).toThrow(/^LAST_COUNTRY/);
    expect(ctx.shown).toEqual(['Q183']);
  });
});

describe('play, layers, status', () => {
  it('play and pause through the scene, a speed the menu offers only', () => {
    const { h } = setup();
    expect(h.play({ playing: true, speed: 20 })).toMatchObject({ playing: true, speed: 20 });
    expect(() => h.play({ playing: true, speed: 7 })).toThrow(/^BAD_ARG: speed is one of 1, 5, 20, 60/);
    expect(h.play({ playing: false }).playing).toBe(false);
  });

  it('a loop plays the period', () => {
    const { h } = setup();
    expect(h.play({ playing: true, loop: '1914 à 1918' })).toMatchObject({ playing: true, loop: { from: 1914, to: 1918 } });
  });

  it('layers go through the menu\'s setter, an unknown subject is named', () => {
    const { h, ctx } = setup();
    h.setLayers({ subjects: ['building'], wars: false });
    expect([...ctx.layerState.kinds]).toEqual(['building']);
    expect(ctx.layerState.wars).toBe(false);
    expect(() => h.setLayers({ subjects: ['dragons'] })).toThrow(/^BAD_ARG: unknown subject dragons/);
    const set = vi.fn();
    expect(() => setup({ setLayerState: set }).h.setLayers({})).toThrow(/^BAD_ARG: nothing to change/);
    expect(set).not.toHaveBeenCalled();
  });

  it('status says the subjects are still being read, and counts what is between the edges', () => {
    const { h } = setup();
    scene.setTarget({ y0: 1700, y1: 1800 }, true);
    const s = h.status();
    expect(s.subjectsLoaded).toEqual({ loaded: 3, of: 17, complete: false });
    expect(s.eventsOnScreen).toBe(1);
    expect(s.onScreen).toMatchObject({ from: 1700, to: 1800 });
  });
});

describe('by voice: things named the way a person says them (doc 149 §19)', () => {
  it('open takes a name, no type, no id: the period opens and the timeline glides to it', () => {
    const { h, picks } = setup();
    const r = h.open({ id: 'la révolution française' });
    expect(picks).toEqual([{ type: 'period', id: 'P1' }]);
    expect(r.opened).toMatchObject({ name: 'Révolution française', from: 1789 });
    expect(h.open({ id: 'Bastille' }).opened).toMatchObject({ type: 'event', id: 'Q1' });
    expect(h.open({ id: 'guerre de cent ans' }).opened).toMatchObject({ type: 'war', id: 'W1' });
  });

  it('a name that two regimes carry is refused AMBIGUOUS with both, and the country by name settles it', () => {
    const { h, ctx, picks } = setup();
    expect(() => h.open({ id: 'Empire' })).toThrow(/^AMBIGUOUS: "Empire" names several items: Empire \(regime, 1804, France\), Empire \(regime, 1871, Deutschland\); say which, or give its type, year or country/);
    expect(picks).toEqual([]);
    h.open({ id: 'Empire', country: 'Germany' });
    expect(picks).toEqual([{ type: 'regime', id: 'R2', c: 'Q183' }]);
    expect(ctx.shown).toContain('Q183');
    h.open({ id: 'Empire', year: 1810 });
    expect(picks.at(-1)).toEqual({ type: 'regime', id: 'R2', c: 'Q142' });
  });

  it('several events holding the word are refused, never the first taken', () => {
    const { h, picks } = setup();
    h.open({ id: 'traité', type: 'event' });
    expect(picks).toEqual([{ type: 'event', q: 'Q2' }]);
    const more = [...all, ev('Q9', 'Traité de Paris', 1763, 'Q142')];
    const two = setup({ all: more, byQ: new Map(more.map((e) => [e.q, e])) });
    expect(() => two.h.open({ id: 'traité' })).toThrow(/^AMBIGUOUS: .*Traité de Versailles \(event, 1919, France\).*Traité de Paris \(event, 1763, France\)/);
    expect(two.picks).toEqual([]);
  });

  it('a ruler is one person: born on the timeline and ruling twice, he opens once, on his first term', () => {
    const term = (s: number, e: number) => ({ ...named('Napoléon Bonaparte'), q: 'Q517', of: 1, s, e, c: 'Q142', h: null, open: false, sl: 200 });
    const born = ev('Q517', 'Napoléon Bonaparte', 1769, 'Q142', 'person');
    const withRuler = { ...history, leaders: [term(1804, 1814), term(1799, 1804)] };
    const { h, picks } = setup({ history: withRuler, all: [...all, born], byQ: new Map([...all, born].map((e) => [e.q, e])) });
    h.open({ id: 'Napoléon' });
    expect(picks).toEqual([{ type: 'leader', q: 'Q517', of: 1, s: 1799 }]);
  });

  it('goTo takes a name and goes to its years without opening its card', () => {
    const { h, picks } = setup();
    const r = h.goTo({ when: 'va à la Guerre de Cent Ans' });
    expect(scene.target).toEqual({ y0: 1337, y1: 1454 });
    expect(r).toMatchObject({ named: { type: 'war', id: 'W1' } });
    expect(picks).toEqual([]);
    expect(() => h.goTo({ when: 'Empire' })).toThrow(/^AMBIGUOUS/);
  });

  it('close is the card\'s ×', () => {
    const { h, picks } = setup();
    h.open({ id: 'Bastille' });
    expect(h.close()).toEqual({ closed: expect.objectContaining({ name: 'Prise de la Bastille' }) });
    expect(picks.at(-1)).toBeNull();
    expect(h.close()).toEqual({ closed: null });
  });

  it('zoom is the View menu\'s buttons around the cursor', () => {
    const { h } = setup();
    const before = span(scene.target);
    h.zoom({ direction: 'in' });
    expect(span(scene.target)).toBeCloseTo(before * 0.55);
    h.zoom({ direction: 'out', steps: 2 });
    expect(span(scene.target)).toBeCloseTo(before * 0.55 * 1.8 * 1.8);
    h.zoom({ span: 50 });
    expect(span(scene.target)).toBeCloseTo(50);
    expect(() => h.zoom({})).toThrow(/^BAD_ARG: give direction/);
    expect(() => h.zoom({ direction: 'sideways' })).toThrow(/^BAD_ARG: direction is in, out or all/);
  });

  it('move goes forward or back from the cursor, never past the timeline', () => {
    const { h } = setup();
    h.move({ years: 50 });
    expect((scene.target.y0 + scene.target.y1) / 2).toBeCloseTo(1920);
    expect(() => h.move({ years: 900 })).toThrow(/^OUTSIDE/);
  });

  it('meanwhile lists what the card lists: the same year, every OTHER country', () => {
    const { h } = setup();
    h.open({ id: 'Traité de Versailles' });
    const r = h.meanwhile({});
    expect(r).toMatchObject({ year: 1919, elsewhereThan: { name: 'Traité de Versailles' } });
    expect(r.events.map((e) => e.name)).toEqual(['Bauhaus']);
    expect(h.meanwhile({ year: 1919 }).events.map((e) => e.name).sort()).toEqual(['Bauhaus', 'Traité de Versailles']);
  });

  it('setView: names in the person\'s language; era borders ask the person first, and a board\'s timeline window refuses', () => {
    const { h, ctx, consent } = setup();
    expect(h.setView({ translatedNames: true })).toMatchObject({ translatedNames: true });
    expect(ctx.tr).toBe(true);
    // the person has not accepted: never reported as done
    expect(h.setView({ eraBorders: true })).toMatchObject({ borders: 'now', consentAsked: true });
    expect(consent.asked).toBe(true);
    const board = setup({ role: 'timeline' });
    expect(() => board.h.setView({ eraBorders: true, translatedNames: true })).toThrow(/^CONSENT_NEEDED/);
    // refused before anything changes
    expect(board.ctx.tr).toBe(false);
    consent.ok = true;
    expect(h.setView({ eraBorders: true })).toMatchObject({ borders: 'era' });
    expect(h.setView({ eraBorders: false })).toMatchObject({ borders: 'now' });
  });

  it('random is the « at random » button', () => {
    const { h } = setup();
    expect(h.random()).toMatchObject({ playing: true });
    expect(() => setup({ all: [] }).h.random()).toThrow(/^NOT_READY/);
  });
});
