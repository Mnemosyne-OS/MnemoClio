/**
 * clioAgent.ts — what an agent may do in MnemoClio (doc 149), as plain functions over the app's
 * own state and its own moves. Declared in `mnemo-plugin.json` › agentActions, served by
 * `ClioAgentActions` while a Clio window with the header is open.
 *
 * 🚨 Every move is the one the person's own control makes: a time goes through `goToWhen` (the
 * search box's « go to »), a zoom through `scene.setTarget(…, reduceMotion)` (the jump menu),
 * an item through `pick` (a search result), play through `scene.setPlaying` (the play button),
 * layers through `setLayerState` (the Layers menu), countries through `setShown` (the chips).
 * So the timeline GLIDES as it does under a hand, and the other windows of a board follow
 * through the same sync.
 *
 * Years are numbers: negative is BC, and there is no year 0 (Wikidata's years).
 * Refusals throw `CODE: reason`, and an unknown name says how to list the right ones.
 */
import { BOUNDS, CENTRE, MAX_SPAN, MIN_SPAN, centreOn, span, zoomAt, type View } from '@mnemosyne_os/timeline-map/view';
import { parseWhen, type When } from '@mnemosyne_os/timeline-map/when';
import type { Scene } from '@mnemosyne_os/timeline-map/scene';
import { KINDS, type Country, type Ev, type History, type Kind, type Named } from '../data/types';
import type { LayerState } from '../data/layers';
import type { Picked } from '../engine/picked';
import type { Role } from './sync';
import { countryMatches, findByName, fold } from '../data/search';
import { findNamed, fold as foldWord, listed, nameWords, type Named as Entry } from '../data/agentFind';
import { meanwhileList } from '../data/fact';

/** The app's state and its own moves, read fresh at every call. */
export interface ClioAgentContext {
  scene: Scene;
  history: History;
  all: readonly Ev[];
  byQ: ReadonlyMap<string, Ev>;
  /** Events of the countries shown (the timeline's lanes), every subject. */
  laneEvents: readonly Ev[];
  shown: readonly string[];
  setShown: (next: string[]) => void;
  kinds: ReadonlySet<Kind>;
  layerState: LayerState;
  setLayerState: (next: LayerState) => void;
  borders: 'now' | 'era';
  picked: Picked | null;
  pick: (p: Picked | null) => void;
  name: (x: Named) => string;
  reduceMotion: boolean;
  goToWhen: (w: When) => void;
  loopWhen: (w: When) => void;
  speeds: readonly number[];
  /** Subjects read so far, of how many: a count taken mid-load is not the whole history. */
  loaded: { subjects: number; of: number };
  role: Role;
  /** The names in the person's language (true) or each in its own (false): the View menu's switch. */
  tr: boolean;
  setTr: (on: boolean) => void;
  /** Today's borders: the map's « now » button. */
  setBorders: (b: 'now') => void;
  /** The map's « era » button: true when the borders of the era show, false when it asked the person first. */
  showEra: () => boolean;
  /** Has the person already accepted to download the era's borders? */
  eraConsented: () => boolean;
  /** The « at random » button: a moment drawn among the years that have events, then time runs. */
  randomMoment: () => void;
}

/** The years the cursor can stand on: what the manifest declares as `year`'s limits. */
export const YEAR_LIMITS = { min: BOUNDS.min, max: CENTRE.max } as const;
/** How many years the screen can hold: what the manifest declares as `span`'s limits. */
export const SPAN_LIMITS = { min: MIN_SPAN, max: MAX_SPAN } as const;
const OPEN_TYPES = ['event', 'war', 'regime', 'period', 'leader'] as const;
type OpenType = typeof OPEN_TYPES[number];
/** The View menu's zoom buttons, around the cursor. */
export const ZOOM_FACTORS = { in: 0.55, out: 1.8 } as const;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

/** A whole year on the timeline, or the refusal that says why not. */
function readYear(v: unknown, what: string): number {
  const y = num(v);
  if (y === null || !Number.isInteger(y)) throw new Error(`BAD_ARG: ${what} must be a whole year (negative = BC)`);
  if (y === 0) throw new Error(`BAD_ARG: there is no year 0; 1 BC is -1, AD 1 is 1`);
  if (y < YEAR_LIMITS.min || y > YEAR_LIMITS.max) throw new Error(`OUTSIDE: the timeline runs from ${YEAR_LIMITS.min} to ${YEAR_LIMITS.max}`);
  return y;
}

/** A country by its Wikidata id, then its name in any language, exact first. */
export function resolveCountry(countries: readonly Country[], ref: string): Country {
  const r = ref.trim();
  const byId = countries.find((c) => c.id === r);
  if (byId) return byId;
  const f = fold(r);
  if (!f) throw new Error('BAD_ARG: an empty country name');
  const names = (c: Country) => [c.o, c.f, c.en, ...Object.values(c.nl)].map(fold);
  const exact = countries.filter((c) => names(c).includes(f));
  if (exact.length === 1) return exact[0]!;
  const near = exact.length ? exact : countries.filter((c) => countryMatches(c, f) || Object.values(c.nl).some((n) => fold(n).includes(f)));
  if (near.length === 1) return near[0]!;
  if (!near.length) {
    // the names that start like it: what the orb's repair call can pick from
    const head = f.slice(0, 3);
    const like = countries.filter((c) => [c.o, c.f, c.en].some((n) => fold(n).startsWith(head))).map((c) => c.f ?? c.en ?? c.o);
    throw new Error(`NO_COUNTRY: no country named "${r}"${like.length ? `; countries: ${listed(like)}` : ''}; listCountries finds the others`);
  }
  // today's states first: "France" means France before French Polynesia
  const states = near.filter((c) => c.kind === 'state');
  if (states.length === 1 && !exact.length) return states[0]!;
  const list = near.slice(0, 8).map((c) => `${c.f ?? c.en ?? c.o} (${c.id}, ${c.kind})`).join(', ');
  throw new Error(`AMBIGUOUS: "${r}" names several countries: ${list}${near.length > 8 ? ', …' : ''}; say which, or pass the id`);
}

/** The first and the last year of an item (an event is one year). */
function spanOf(ctx: ClioAgentContext, p: Picked): { a: number; b: number } | null {
  const h = ctx.history;
  if (p.type === 'event') { const e = ctx.byQ.get(p.q); return e ? { a: e.y, b: e.y } : null; }
  if (p.type === 'war') { const w = h.wars.find((x) => x.id === p.id); return w ? { a: w.s, b: w.e } : null; }
  if (p.type === 'regime') { const r = h.regimes.find((x) => x.id === p.id && x.c === p.c); return r ? { a: r.s, b: r.e } : null; }
  if (p.type === 'period') { const r = h.periods.find((x) => x.id === p.id); return r ? { a: r.s, b: r.e } : null; }
  if (p.type === 'leader') return { a: p.s, b: h.leaders.find((x) => x.q === p.q && x.of === p.of && x.s === p.s)?.e ?? p.s };
  return null;
}

/**
 * The one event, war, regime, period or ruler a name says (doc 149 §19: the orb never searches
 * first). Over the WHOLE history, not the search box's ten best known: « Prise de la Bastille »
 * must be found even when ten better known events hold « Bastille ». A ruler's terms are one
 * person: the first term opens (its card lists the others). A person who was born on the
 * timeline AND ruled opens as the ruler.
 */
export function resolveItem(ctx: ClioAgentContext, ref: string, only: { type?: OpenType; year?: number; country?: string } = {}): Picked {
  const asked = nameWords(ref);
  if (!asked.length) throw new Error(`BAD_ARG: "${ref}" names nothing; give the name of an event, a war, a regime, a period or a ruler`);
  // the longest word cuts the history down before the words of every name are read
  const key = [...asked].sort((a, b) => b.length - a.length)[0]!;
  const has = (x: Named) => foldWord(x.o).includes(key) || (x.f !== null && foldWord(x.f).includes(key)) || foldWord(ctx.name(x)).includes(key);
  const h = ctx.history;
  const country = only.country ? resolveCountry(h.countries, only.country).id : null;
  const cname = (id: string | null | undefined) => { const c = id ? h.countries.find((x) => x.id === id) : undefined; return c ? ctx.name(c) : null; };
  const inYear = (a: number, b: number) => only.year === undefined || (a <= only.year && only.year <= b);
  const want = (t: OpenType) => !only.type || only.type === t;
  const entries: Array<Entry<Picked>> = [];
  const add = (p: Picked, x: Named, kind: string, year: number, c: string | null | undefined, id: string) => {
    const where = cname(c);
    const nm = ctx.name(x);
    entries.push({ item: p, id: `${kind}:${id}`, names: [x.o, x.f ?? '', nm].filter(Boolean), label: `${nm} (${kind}, ${year}${where ? `, ${where}` : ''})` });
  };
  const rulers = new Set<string>();
  if (want('leader')) {
    const first = new Map<string, History['leaders'][number]>();
    for (const l of h.leaders) {
      if (!has(l) || !inYear(l.s, l.e) || (country && (l.c ?? l.h) !== country)) continue;
      const seen = first.get(l.q);
      if (!seen || l.s < seen.s) first.set(l.q, l);
    }
    for (const l of first.values()) { rulers.add(l.q); add({ type: 'leader', q: l.q, of: l.of, s: l.s }, l, 'ruler', l.s, l.c ?? l.h, l.q); }
  }
  if (want('event')) {
    const seen = new Set<string>();
    for (const e of ctx.all) {
      if (seen.has(e.q) || rulers.has(e.q) || !has(e) || !inYear(e.y, e.y) || (country && e.c !== country)) continue;
      seen.add(e.q);
      add({ type: 'event', q: e.q }, e, 'event', e.y, e.c, e.q);
    }
  }
  if (want('war')) for (const w of h.wars) if (has(w) && inYear(w.s, w.e) && (!country || w.c === country)) add({ type: 'war', id: w.id }, w, 'war', w.s, w.c, w.id);
  if (want('regime')) for (const r of h.regimes) if (has(r) && inYear(r.s, r.e) && (!country || r.c === country)) add({ type: 'regime', id: r.id, c: r.c }, r, 'regime', r.s, r.c, `${r.id}@${r.c}`);
  if (want('period') && !country) for (const r of h.periods) if (has(r) && inYear(r.s, r.e)) add({ type: 'period', id: r.id }, r, 'period', r.s, null, r.id);
  const what = only.type ? (only.type === 'leader' ? 'ruler' : only.type) : 'event, war, regime, period or ruler';
  const narrowed = [only.year !== undefined ? `in ${only.year}` : '', country ? `in ${cname(country)}` : ''].filter(Boolean).join(' ');
  if (!entries.length) throw new Error(`NO_ITEM: no ${what} named "${ref}"${narrowed ? ` ${narrowed}` : ''}; try the name in its own language`);
  try {
    return findNamed(entries, ref, { code: 'NO_ITEM', noun: 'item' });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    // the narrowing the repair call can add, said where it reads
    throw new Error(m.startsWith('AMBIGUOUS') ? m.replace(/; say which$/, '; say which, or give its type, year or country') : m);
  }
}

/** What is picked, as the panel's card names it. */
function describePicked(ctx: ClioAgentContext, p: Picked | null) {
  if (!p) return null;
  const { history: h, byQ, name } = ctx;
  if (p.type === 'event') { const e = byQ.get(p.q); return e ? { type: p.type, id: e.q, name: name(e), year: e.y, approx: !!e.a, country: e.c } : { type: p.type, id: p.q }; }
  if (p.type === 'war') { const w = h.wars.find((x) => x.id === p.id); return w ? { type: p.type, id: w.id, name: name(w), from: w.s, to: w.e } : { type: p.type, id: p.id }; }
  if (p.type === 'regime') { const r = h.regimes.find((x) => x.id === p.id && x.c === p.c); return r ? { type: p.type, id: r.id, country: r.c, name: name(r), from: r.s, to: r.e } : { type: p.type, id: p.id, country: p.c }; }
  if (p.type === 'period') { const r = h.periods.find((x) => x.id === p.id); return r ? { type: p.type, id: r.id, name: name(r), from: r.s, to: r.e } : { type: p.type, id: p.id }; }
  if (p.type === 'leader') { const l = h.leaders.find((x) => x.q === p.q && x.of === p.of && x.s === p.s); return l ? { type: p.type, id: l.q, office: l.of, name: name(l), from: l.s, to: l.e } : { type: p.type, id: p.q }; }
  return { type: p.type, from: p.decade, size: p.size ?? 10 };
}

const viewOf = (v: View) => ({ from: Math.round(v.y0 * 10) / 10, to: Math.round(v.y1 * 10) / 10, cursor: Math.floor((v.y0 + v.y1) / 2) });

/**
 * The handlers, one per declared action. `get` reads the app's state as it is NOW (a ref the
 * component refreshes every render), so a handler never acts on the state of its first render.
 */
export function clioAgentHandlers(get: () => ClioAgentContext) {
  const countryLine = (c: Country) => {
    const { name, shown } = get();
    return { id: c.id, name: name(c), kind: c.kind, from: c.s, to: c.e, events: c.n, shown: shown.includes(c.id) };
  };

  // agent-actions:begin
  return {
    status: () => {
      const ctx = get();
      const { scene, layerState: l } = ctx;
      const v = scene.view;
      const onScreen = ctx.laneEvents.filter((e) => ctx.kinds.has(e.k) && e.y >= v.y0 && e.y < v.y1).length;
      const moving = scene.target.y0 !== v.y0 || scene.target.y1 !== v.y1;
      return {
        range: { first: YEAR_LIMITS.min, last: YEAR_LIMITS.max },
        onScreen: { ...viewOf(v), span: Math.round(span(v)) },
        ...(moving ? { goingTo: viewOf(scene.target) } : {}),
        playing: scene.playing, speed: scene.speed,
        loop: scene.loop ? { from: Math.floor(scene.loop.a), to: Math.ceil(scene.loop.b) - 1 } : null,
        countries: ctx.shown.map((id) => { const c = ctx.history.countries.find((x) => x.id === id); return { id, name: c ? ctx.name(c) : null }; }),
        subjects: KINDS.filter((k) => ctx.kinds.has(k)),
        layers: { wars: l.wars, clouds: l.clouds, leaders: l.leaders, epidemics: l.epi, religions: l.rel },
        borders: ctx.borders,
        picked: describePicked(ctx, ctx.picked),
        eventsOnScreen: onScreen,
        // 🎭 counted while the subjects still land, it is not the whole history
        subjectsLoaded: { loaded: ctx.loaded.subjects, of: ctx.loaded.of, complete: ctx.loaded.subjects >= ctx.loaded.of },
        window: ctx.role,
      };
    },

    listCountries: (args) => {
      const { history } = get();
      const f = fold(str(args.query));
      const limit = num(args.limit) ?? 30;
      const hits = history.countries
        .filter((c) => !f || countryMatches(c, f) || Object.values(c.nl).some((n) => fold(n).includes(f)))
        // the picker's order: today's states first, the best covered first
        .sort((a, b) => Number(a.kind !== 'state') - Number(b.kind !== 'state') || b.n - a.n);
      return { total: hits.length, countries: hits.slice(0, limit).map(countryLine) };
    },

    search: (args) => {
      const ctx = get();
      const text = str(args.text);
      const asked = parseWhen(text);
      const r = findByName(asked.rest, ctx.all, ctx.history);
      const country = (id: string | null) => (id ? ctx.history.countries.find((c) => c.id === id) : undefined);
      const cname = (id: string | null) => { const c = country(id); return c ? ctx.name(c) : null; };
      return {
        when: asked.when ? { kind: asked.when.kind, from: asked.when.a, to: asked.when.b } : null,
        ...(asked.outside ? { outside: `the timeline runs from ${YEAR_LIMITS.min} to ${YEAR_LIMITS.max}` } : {}),
        ...(r ? {} : { note: 'a name needs at least two letters' }),
        events: (r?.events ?? []).map((e) => ({ open: { type: 'event', id: e.q }, name: ctx.name(e), year: e.y, approx: !!e.a, subject: e.k, country: cname(e.c) })),
        wars: (r?.wars ?? []).map((w) => ({ open: { type: 'war', id: w.id }, name: ctx.name(w), from: w.s, to: w.e, country: cname(w.c) })),
        regimes: (r?.regimes ?? []).map((x) => ({ open: { type: 'regime', id: x.id, country: x.c }, name: ctx.name(x), from: x.s, to: x.e, country: cname(x.c) })),
        leaders: (r?.leaders ?? []).map((x) => ({ open: { type: 'leader', id: x.q, office: x.of, start: x.s }, name: ctx.name(x), from: x.s, to: x.e, country: cname(x.c ?? x.h) })),
        periods: (r?.periods ?? []).map((x) => ({ open: { type: 'period', id: x.id }, name: ctx.name(x), from: x.s, to: x.e })),
        ...(r && asked.when === null && !r.events.length && !r.wars.length && !r.regimes.length && !r.leaders.length && !r.periods.length ? { note: 'nothing by that name; try another spelling or the name in its own language' } : {}),
      };
    },

    goTo: (args) => {
      const ctx = get();
      const { scene } = ctx;
      const text = str(args.when);
      const hasYear = args.year !== undefined, hasRange = args.from !== undefined || args.to !== undefined;
      if ([!!text, hasYear, hasRange].filter(Boolean).length !== 1) throw new Error('BAD_ARG: give one of when (text), year, or from + to');
      const s = args.span === undefined ? null : num(args.span);
      if (args.span !== undefined && (s === null || s < SPAN_LIMITS.min || s > SPAN_LIMITS.max)) throw new Error(`BAD_ARG: span is ${SPAN_LIMITS.min} to ${SPAN_LIMITS.max} years`);
      let w: When;
      let named: ReturnType<typeof describePicked> = null;
      if (text) {
        const asked = parseWhen(text);
        if (asked.outside) throw new Error(`OUTSIDE: the timeline runs from ${YEAR_LIMITS.min} to ${YEAR_LIMITS.max}`);
        if (asked.when) w = asked.when;
        else {
          // « va à la Révolution française »: a name said where a time was expected goes to its years
          let p: Picked;
          try { p = resolveItem(ctx, asked.rest || text); } catch (err) {
            const m = err instanceof Error ? err.message : String(err);
            if (m.startsWith('NO_ITEM') || m.startsWith('BAD_ARG')) throw new Error(`NOT_A_TIME: "${text}" names no year or period, and ${m.replace(/^\w+: /, '')}`);
            throw err;
          }
          const sp = spanOf(ctx, p)!;
          w = sp.a === sp.b ? { kind: 'year', a: sp.a, b: sp.a } : { kind: 'range', a: sp.a, b: sp.b };
          named = describePicked(ctx, p);
        }
      } else if (hasYear) {
        const y = readYear(args.year, 'year');
        w = { kind: 'year', a: y, b: y };
      } else {
        if (args.from === undefined || args.to === undefined) throw new Error('BAD_ARG: a range needs both from and to');
        const a = readYear(args.from, 'from'), b = readYear(args.to, 'to');
        if (b < a) throw new Error('BAD_ARG: from comes before to');
        w = { kind: 'range', a, b };
      }
      if (s !== null && w.kind !== 'year') throw new Error('BAD_ARG: span goes with a single year; a period fills the screen by itself');
      if (s !== null) {
        // the jump menu's move with the zoom the agent asked for
        scene.setLoop(null);
        scene.setTarget(centreOn(w.a + 0.5, s), ctx.reduceMotion);
      } else ctx.goToWhen(w);
      return { goingTo: viewOf(scene.target), animated: !ctx.reduceMotion, ...(named ? { named, note: 'its card is not open; open shows it' } : {}) };
    },

    chooseCountries: (args) => {
      const ctx = get();
      const list = (v: unknown, what: string): Country[] | null => {
        if (v === undefined) return null;
        if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new Error(`BAD_ARG: ${what} is a list of country ids or names`);
        return v.map((x) => resolveCountry(ctx.history.countries, x as string));
      };
      const only = list(args.only, 'only'), add = list(args.add, 'add'), remove = list(args.remove, 'remove');
      if (!only && !add && !remove) throw new Error('BAD_ARG: give only, add or remove');
      if (only && (add || remove)) throw new Error('BAD_ARG: only replaces the countries; it does not go with add or remove');
      let next = only ? [...new Set(only.map((c) => c.id))] : [...ctx.shown];
      for (const c of add ?? []) if (!next.includes(c.id)) next.push(c.id);
      if (remove) next = next.filter((id) => !remove.some((c) => c.id === id));
      // the chips keep one country at least: an empty timeline shows nothing
      if (!next.length) throw new Error('LAST_COUNTRY: at least one country stays on the timeline');
      ctx.setShown(next);
      return { countries: next.map((id) => { const c = ctx.history.countries.find((x) => x.id === id)!; return { id, name: ctx.name(c) }; }) };
    },

    setLayers: (args) => {
      const ctx = get();
      const n: LayerState = { ...ctx.layerState };
      let changed = false;
      if (args.subjects !== undefined) {
        const s = args.subjects;
        if (!Array.isArray(s) || !s.every((k) => typeof k === 'string')) throw new Error('BAD_ARG: subjects is a list');
        const bad = s.filter((k) => !(KINDS as readonly string[]).includes(k as string));
        if (bad.length) throw new Error(`BAD_ARG: unknown subject ${bad.join(', ')}; the subjects are ${KINDS.join(', ')}`);
        n.kinds = new Set(s as Kind[]);
        changed = true;
      }
      const events = bool(args.events);
      if (events !== null) {
        if (args.subjects !== undefined && !events) throw new Error('BAD_ARG: events false hides every subject; it does not go with subjects');
        // the Layers menu's Events switch: off hides every subject, on gives them all back
        if (!events) n.kinds = new Set();
        else if (!n.kinds.size) n.kinds = new Set(KINDS);
        changed = true;
      }
      const flags = { wars: 'wars', clouds: 'clouds', leaders: 'leaders', epidemics: 'epi', religions: 'rel' } as const;
      for (const [arg, key] of Object.entries(flags) as Array<[keyof typeof flags, 'wars' | 'clouds' | 'leaders' | 'epi' | 'rel']>) {
        const b = bool(args[arg]);
        if (b !== null) { n[key] = b; changed = true; }
      }
      if (!changed) throw new Error('BAD_ARG: nothing to change; give subjects, events, wars, clouds, leaders, epidemics or religions');
      ctx.setLayerState(n);
      return { subjects: KINDS.filter((k) => n.kinds.has(k)), layers: { wars: n.wars, clouds: n.clouds, leaders: n.leaders, epidemics: n.epi, religions: n.rel } };
    },

    open: (args) => {
      const ctx = get();
      const { history: h } = ctx;
      const rawType = str(args.type);
      if (rawType && !(OPEN_TYPES as readonly string[]).includes(rawType)) throw new Error(`BAD_ARG: type is one of ${OPEN_TYPES.join(', ')}`);
      const type = (rawType || null) as OpenType | null;
      const id = str(args.id);
      if (!id) throw new Error('MISSING_ARG: id (an id from search, or the name as the person says it)');
      const year = args.year === undefined ? undefined : readYear(args.year, 'year');
      // a regime's country: its id (from search) or its name as said
      const cRef = str(args.country);
      const cId = cRef ? (h.countries.some((c) => c.id === cRef) ? cRef : resolveCountry(h.countries, cRef).id) : '';
      /** The item by its id, as search hands it; null when `id` is no id of that type (then it is a name). */
      const byId = (t: OpenType): Picked | null => {
        if (t === 'event') return ctx.byQ.has(id) ? { type: t, q: id } : null;
        if (t === 'war') return h.wars.some((w) => w.id === id) ? { type: t, id } : null;
        if (t === 'period') return h.periods.some((x) => x.id === id) ? { type: t, id } : null;
        if (t === 'regime') {
          const all = h.regimes.filter((r) => r.id === id && (!cId || r.c === cId));
          if (!all.length) return null;
          if (all.length > 1) throw new Error(`AMBIGUOUS: regime "${id}" is in ${all.map((r) => r.c).join(', ')}; pass country`);
          return { type: t, id, c: all[0]!.c };
        }
        const of = num(args.office), s = num(args.start);
        const all = h.leaders.filter((l) => l.q === id && (of === null || l.of === of) && (s === null || l.s === s));
        if (!all.length) return null;
        if (all.length > 1) throw new Error(`AMBIGUOUS: leader "${id}" held ${all.length} terms or offices; pass office and start from search`);
        const l = all[0]!;
        return { type: 'leader', q: l.q, of: l.of, s: l.s };
      };
      let p: Picked | null = null;
      for (const t of type ? [type] : OPEN_TYPES) { p = byId(t); if (p) break; }
      // not an id: the words a person says (« la Révolution française », « Napoléon »)
      p ??= resolveItem(ctx, id, { ...(type ? { type } : {}), ...(year !== undefined ? { year } : {}), ...(cId ? { country: cId } : {}) });
      // the search pill's two lines: a regime's country on the timeline, then the regime
      if (p.type === 'regime' && !ctx.shown.includes(p.c)) ctx.setShown([...ctx.shown, p.c]);
      ctx.pick(p);
      return { opened: describePicked(ctx, p), animated: !ctx.reduceMotion };
    },

    close: () => {
      const ctx = get();
      const was = describePicked(ctx, ctx.picked);
      // the card's × (and Escape)
      ctx.pick(null);
      return { closed: was };
    },

    zoom: (args) => {
      const ctx = get();
      const { scene } = ctx;
      const dir = str(args.direction);
      const s = args.span === undefined ? null : num(args.span);
      if (args.span !== undefined && (s === null || s < SPAN_LIMITS.min || s > SPAN_LIMITS.max)) throw new Error(`BAD_ARG: span is ${SPAN_LIMITS.min} to ${SPAN_LIMITS.max} years`);
      if (!!dir === (s !== null)) throw new Error('BAD_ARG: give direction (in, out, all) or span');
      const steps = args.steps === undefined ? 1 : num(args.steps);
      if (steps === null || !Number.isInteger(steps) || steps < 1 || steps > 5) throw new Error('BAD_ARG: steps is 1 to 5');
      if (s !== null) scene.setTarget(centreOn(scene.cursor, s), ctx.reduceMotion);
      else if (dir === 'all') scene.setTarget({ y0: BOUNDS.min, y1: BOUNDS.min + MAX_SPAN }, ctx.reduceMotion);
      else if (dir === 'in' || dir === 'out') {
        // the View menu's ＋ / － pressed `steps` times, around the cursor
        let v = scene.target;
        for (let i = 0; i < steps; i++) v = zoomAt(v, scene.cursor, ZOOM_FACTORS[dir]);
        scene.setTarget(v, ctx.reduceMotion);
      } else throw new Error('BAD_ARG: direction is in, out or all');
      return { goingTo: { ...viewOf(scene.target), span: Math.round(span(scene.target)) }, animated: !ctx.reduceMotion };
    },

    move: (args) => {
      const ctx = get();
      const { scene } = ctx;
      const years = num(args.years);
      if (years === null || !Number.isInteger(years) || years === 0) throw new Error('BAD_ARG: years is a whole number of years, negative to go back');
      const to = scene.cursor + years;
      if (to < YEAR_LIMITS.min || to > YEAR_LIMITS.max + 1) throw new Error(`OUTSIDE: the timeline runs from ${YEAR_LIMITS.min} to ${YEAR_LIMITS.max}`);
      // the arrow keys' move (a loop ends), gliding as a pick does
      scene.setLoop(null);
      scene.goTo(to, ctx.reduceMotion);
      return { goingTo: viewOf(scene.target), animated: !ctx.reduceMotion };
    },

    meanwhile: (args) => {
      const ctx = get();
      const p = ctx.picked;
      const ev = p?.type === 'event' ? ctx.byQ.get(p.q) : undefined;
      let year: number;
      if (args.year !== undefined) year = readYear(args.year, 'year');
      else if (ev) year = ev.y;
      else year = Math.floor(ctx.scene.cursor);
      const from = args.year === undefined && ev ? ev : undefined;
      const cname = (id: string | null) => { const c = id ? ctx.history.countries.find((x) => x.id === id) : undefined; return c ? ctx.name(c) : null; };
      // the card's « Meanwhile, elsewhere »: the same function, the same subjects shown
      const list = meanwhileList(year, ctx.all, ctx.kinds, from ? { q: from.q, c: from.c } : {});
      return {
        year,
        ...(from ? { elsewhereThan: { name: ctx.name(from), country: cname(from.c) } } : {}),
        events: list.map((e) => ({ open: { type: 'event', id: e.q }, name: ctx.name(e), subject: e.k, country: cname(e.c) })),
        wars: ctx.history.wars.filter((w) => w.s <= year && year <= w.e).sort((a, b) => b.b.length - a.b.length).slice(0, 4).map((w) => ({ open: { type: 'war', id: w.id }, name: ctx.name(w), from: w.s, to: w.e })),
        subjectsLoaded: { loaded: ctx.loaded.subjects, of: ctx.loaded.of, complete: ctx.loaded.subjects >= ctx.loaded.of },
      };
    },

    setView: (args) => {
      const ctx = get();
      const translated = bool(args.translatedNames);
      const era = bool(args.eraBorders);
      if (translated === null && era === null) throw new Error('BAD_ARG: give translatedNames or eraBorders');
      // the consent dialog lives on the map: an exploded board's timeline window cannot show it (refused before anything changes)
      if (era === true && !ctx.eraConsented() && ctx.role === 'timeline') throw new Error('CONSENT_NEEDED: the borders of the era are downloaded once the person accepts; they press « era » on the map window');
      if (translated !== null) ctx.setTr(translated);
      let borders: 'now' | 'era' = ctx.borders;
      let consentAsked = false;
      if (era === false) { ctx.setBorders('now'); borders = 'now'; }
      // the « era » button: the first time, it asks the person before the borders are downloaded
      else if (era === true) { if (ctx.showEra()) borders = 'era'; else consentAsked = true; }
      return {
        translatedNames: translated ?? ctx.tr, borders,
        ...(consentAsked ? { consentAsked: true, note: 'the borders of the era are downloaded only once the person accepts in the window; they still show today\'s' } : {}),
      };
    },

    random: () => {
      const ctx = get();
      if (!ctx.all.length) throw new Error('NOT_READY: no event is read yet');
      // the « at random » button: a moment drawn, then time runs
      ctx.randomMoment();
      return { goingTo: viewOf(ctx.scene.target), playing: ctx.scene.playing };
    },

    play: (args) => {
      const ctx = get();
      const { scene } = ctx;
      const playing = bool(args.playing);
      if (playing === null) throw new Error('MISSING_ARG: playing (true or false)');
      if (args.speed !== undefined) {
        const sp = num(args.speed);
        if (sp === null || !ctx.speeds.includes(sp)) throw new Error(`BAD_ARG: speed is one of ${ctx.speeds.join(', ')} years per second`);
        scene.setSpeed(sp);
      }
      const loopText = str(args.loop);
      if (loopText) {
        if (!playing) throw new Error('BAD_ARG: a loop plays; it does not go with playing false');
        const asked = parseWhen(loopText);
        if (asked.outside) throw new Error(`OUTSIDE: the timeline runs from ${YEAR_LIMITS.min} to ${YEAR_LIMITS.max}`);
        if (!asked.when) throw new Error(`NOT_A_TIME: "${loopText}" names no year or period`);
        // the search box's « loop » pill
        ctx.loopWhen(asked.when);
      } else scene.setPlaying(playing);
      return {
        playing: scene.playing, speed: scene.speed,
        loop: scene.loop ? { from: Math.floor(scene.loop.a), to: Math.ceil(scene.loop.b) - 1 } : null,
      };
    },
  } satisfies Record<string, (args: Record<string, unknown>) => unknown>;
  // agent-actions:end
}
