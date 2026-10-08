/**
 * App.tsx — MnemoClio: the history of every country on one timeline you can move.
 *
 * Holds what a person chooses (countries, subjects, names, borders, what is picked) and the
 * data as it lands. The moving state (view, cursor, play) lives in a Scene shared by the two
 * canvases; React only hears the cursor's whole year and the feed.
 * Three states, always (house rule 11): reading (with what is coming), failed (by name), data.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { onHostConfig } from '@mnemosyne_os/cartridge-sdk';
import { getJson, loadAll } from './data/load';
import { ERA_LICENSE, ERA_SOURCE, ERA_YEARS, eraFor, loadEra, type EraShape } from './data/era';
import { KINDS, type Ev, type History, type Kind, type Meta, type Named, type WorldCountry } from './data/types';
import { KIND_HUE } from './engine/palette';
import { Scene, type Picked } from './engine/scene';
import { readTheme, type Theme } from './engine/theme';
import { centreOn, span, zoomAt, MAX_SPAN, BOUNDS } from './engine/view';
import { useI18n } from './i18n/useI18n';
import type { Key } from './i18n/strings';
import { MapView } from './ui/MapView';
import { Panel } from './ui/Panel';
import { countryName, translatedName } from './data/names';
import { Timeline } from './ui/Timeline';
import { LAYOUTS, clampLayout, readLayout, saveLayout, type Layout } from './ui/layout';
import { fey, fspan, fy, periodOf, setYearFormat } from './engine/years';
import { parseWhen, type When } from './engine/when';
import { factCard, meanwhileOf, yearsAgo } from './data/fact';
import { useFactCard } from './ui/useFactCard';
import { usePourHistory } from './ui/usePourHistory';
import { useHostGoto } from './ui/useHostGoto';
import { LayersMenu } from './ui/LayersMenu';
import { ViewMenu } from './ui/ViewMenu';
import { roleOf, type Choices } from './ui/sync';
import { useSync } from './ui/useSync';
import { useSceneStepper } from './ui/useSceneStepper';
import { useBoard } from './ui/useBoard';
import type { LayerId, LayerState } from './data/layers';
import { chroniclesOf, packNameOf, type ChronicleWords } from './data/chronicle';
import { fmtPop, popAt } from './data/population';
import type { Population } from './data/population';
import { epiName, type Epidemic } from './data/epidemics';
import { windowFor } from './engine/mapGeometry';
import { decodeReligions, relName, type Current, type Place, type RawReligions, type Religions } from './data/religions';
import './ui/clio.css';

const DEFAULT_SHOWN = ['Q142', 'Q145', 'Q17', 'Q79', 'Q155'];
const SPEEDS = [1, 5, 20, 60];
/** Years to jump to, from the first cities to the fall of the Berlin Wall. Only years: what happened is on the timeline. */
const JUMPS = [-3000, -1500, -500, -44, 476, 800, 1066, 1453, 1492, 1789, 1870, 1914, 1945, 1989];
const CONSENT_KEY = 'mnemo-clio.era-consent';

const fold = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function readConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch (e) { console.warn('[MnemoClio] consent not readable', e); return false; }
}
function writeConsent(): void {
  try { localStorage.setItem(CONSENT_KEY, '1'); } catch (e) { console.warn('[MnemoClio] consent not saved: it will be asked again next time', e); }
}

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

export default function App() {
  const { t, lang } = useI18n();
  // a year before Christ in the language of the app; set before anything below renders a year
  setYearFormat(t('year.bc'), t('year.about'));
  const reduceMotion = useReducedMotion();
  const scene = useMemo(() => new Scene(1870, 220), []);
  // which view this window is: the single one, or one piece of the exploded view (doc 137 §5vicies)
  const role = useMemo(() => roleOf(window.location.search), []);
  // the year the panel has not heard yet is not delivered to an app that is gone
  useEffect(() => () => scene.dispose(), [scene]);

  // ---- data, as it lands ----
  const [meta, setMeta] = useState<Meta | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [byKind, setByKind] = useState<Map<Kind, Ev[]>>(new Map());
  const [world, setWorld] = useState<WorldCountry[] | null>(null);
  const [errors, setErrors] = useState<Array<{ what: string; why: string }>>([]);
  const [dropped, setDropped] = useState<Array<{ what: string; n: number }>>([]);
  useEffect(() => {
    const ac = new AbortController();
    void loadAll({
      onMeta: setMeta,
      onHistory: setHistory,
      onKind: (k, events, n) => {
        setByKind((m) => new Map(m).set(k, events));
        if (n > 0) setDropped((d) => [...d, { what: k, n }]);
      },
      onWorld: setWorld,
      onError: (what, e) => {
        console.error('[MnemoClio] could not read', what, e);
        setErrors((x) => [...x, { what, why: e instanceof Error ? e.message : String(e) }]);
      },
    }, ac.signal);
    return () => ac.abort();
  }, []);

  // ---- theme: the host's colours, re-read when the shell broadcasts a change ----
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  useEffect(() => onHostConfig(() => setTheme(readTheme())), []);
  useEffect(() => { document.documentElement.style.setProperty('--clio-l', `${theme.l}%`); }, [theme]);

  // ---- choices ----
  const [shown, setShown] = useState<string[]>(DEFAULT_SHOWN);
  const [kinds, setKinds] = useState<Set<Kind>>(() => new Set(KINDS));
  const [showWars, setShowWars] = useState(true);
  const [showLeaders, setShowLeaders] = useState(true);
  const [clouds, setClouds] = useState(true);
  const [globe, setGlobe] = useState(false);
  // how many people lived there: read after the history, one file, never blocking the timeline
  const [pop, setPop] = useState<Population | null>(null);
  const [popFailed, setPopFailed] = useState<string | null>(null);
  // outbreaks: one small file, read like the population
  const [epidemics, setEpidemics] = useState<Epidemic[] | null>(null);
  const [epiFailed, setEpiFailed] = useState<string | null>(null);
  const [showEpi, setShowEpi] = useState(true);
  // religions: off by default, the file is read on the first press (doc 137 §5quaterdecies)
  const [showRel, setShowRel] = useState(false);
  const [religions, setReligions] = useState<Religions | null>(null);
  const [relState, setRelState] = useState<{ loading: boolean; failed: string | null }>({ loading: false, failed: null });
  useEffect(() => {
    if (!showRel || religions) return;
    const ac = new AbortController();
    setRelState({ loading: true, failed: null });
    getJson<RawReligions>('data/religions.json', ac.signal).then(
      (o) => { if (!ac.signal.aborted) { setReligions(decodeReligions(o)); setRelState({ loading: false, failed: null }); } },
      (e: unknown) => { if (!ac.signal.aborted) setRelState({ loading: false, failed: e instanceof Error ? e.message : String(e) }); },
    );
    return () => ac.abort();
  }, [showRel, religions]);
  useEffect(() => {
    const ac = new AbortController();
    getJson<{ e: Epidemic[] }>('data/epidemics.json', ac.signal).then(
      (o) => { if (!ac.signal.aborted) setEpidemics(o.e); },
      (e: unknown) => { if (!ac.signal.aborted) setEpiFailed(e instanceof Error ? e.message : String(e)); },
    );
    return () => ac.abort();
  }, []);
  useEffect(() => {
    const ac = new AbortController();
    getJson<Population>('data/population.json', ac.signal).then(
      (o) => { if (!ac.signal.aborted) setPop(o); },
      (e: unknown) => { if (!ac.signal.aborted) setPopFailed(e instanceof Error ? e.message : String(e)); },
    );
    return () => ac.abort();
  }, []);
  const [tr, setTr] = useState(false);
  const [borders, setBorders] = useState<'now' | 'era'>('now');
  const [askEra, setAskEra] = useState(false);
  // the borders of the time: at once when the person already said yes, else the consent first
  const showEra = () => { if (readConsent()) setBorders('era'); else setAskEra(true); };
  const [picked, setPicked] = useState<Picked | null>(null);
  // how the window is shared between the timeline, the map and the panel: three presets, two splitters
  const [layout, setLayout] = useState<Layout>(readLayout);
  useEffect(() => { saveLayout(layout); }, [layout]);
  const mainRef = useRef<HTMLElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startSplit = (axis: 'rows' | 'cols') => (ev: React.PointerEvent) => {
    ev.preventDefault();
    const box = (axis === 'rows' ? mainRef.current : bottomRef.current)?.getBoundingClientRect();
    if (!box) return;
    const move = (e: PointerEvent) => {
      const share = axis === 'rows' ? (e.clientY - box.top) / box.height : (e.clientX - box.left) / box.width;
      setLayout((l) => clampLayout(axis === 'rows' ? { ...l, timeline: share } : { ...l, map: share }));
    };
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const nudge = (axis: 'rows' | 'cols') => (ev: React.KeyboardEvent) => {
    const d = ev.key === 'ArrowUp' || ev.key === 'ArrowLeft' ? -0.04 : ev.key === 'ArrowDown' || ev.key === 'ArrowRight' ? 0.04 : 0;
    if (!d) return;
    ev.preventDefault();
    setLayout((l) => clampLayout(axis === 'rows' ? { ...l, timeline: l.timeline + d } : { ...l, map: l.map + d }));
  };
  const [untr, setUntr] = useState(0);
  // Country names follow the app's language whatever the names toggle says (field, 07/10:
  // Россия, 中华人民共和国 on the map, "c'est compliqué"), in all seven languages. Events, regimes
  // and people keep the toggle.
  const countryLabel = useMemo(() => {
    const m = new Map<Named, string>();
    if (!history) return m;
    const en = new Map((world ?? []).map((w) => [w.w, w.n]));
    for (const c of history.countries) m.set(c, countryName(c, lang, en.get(c.id)));
    return m;
  }, [history, world, lang]);
  // Names in the person's language (field, 07/10: "if I am in Spanish I want the titles in my
  // language, do it for everyone"): French is in every item, the other languages are one file
  // each, read only when someone asks for them.
  const [langNames, setLangNames] = useState<{ lang: string; map: Map<string, string> } | null>(null);
  const [namesState, setNamesState] = useState<{ loading: boolean; failed: string | null }>({ loading: false, failed: null });
  useEffect(() => {
    if (!tr || lang === 'fr' || langNames?.lang === lang) return;
    const ac = new AbortController();
    setNamesState({ loading: true, failed: null });
    getJson<Record<string, string>>(`data/names-${lang}.json`, ac.signal).then(
      (o) => { if (!ac.signal.aborted) { setLangNames({ lang, map: new Map(Object.entries(o)) }); setNamesState({ loading: false, failed: null }); } },
      (e: unknown) => { if (!ac.signal.aborted) setNamesState({ loading: false, failed: e instanceof Error ? e.message : String(e) }); },
    );
    return () => ac.abort();
  }, [tr, lang, langNames]);
  const names = langNames?.lang === lang ? langNames.map : null;
  const langLabel = useMemo(() => {
    try { return new Intl.DisplayNames([lang], { type: 'language' }).of(lang) ?? lang; } catch (e) { console.warn('[MnemoClio] no language name for', lang, e); return lang; }
  }, [lang]);
  /** Has this item a name in the person's language? (a country always has: it follows the app) */
  const translated = useCallback((x: Named) => countryLabel.has(x) || translatedName(x, lang, names) !== null, [countryLabel, lang, names]);
  const name = useCallback((x: Named) => countryLabel.get(x) ?? (tr ? translatedName(x, lang, names) ?? x.o : x.o), [tr, countryLabel, lang, names]);

  // the cursor's year, the play state and the feed, from the scene
  const snap = useSyncExternalStore(
    useCallback((fn: () => void) => scene.subscribe(fn), [scene]),
    () => `${Math.floor(scene.cursor)}|${scene.playing}|${scene.speed}|${scene.sparks[0]?.at ?? 0}|${scene.loop?.a ?? ''}:${scene.loop?.b ?? ''}`,
  );
  const year = Math.floor(scene.cursor);
  const playing = scene.playing;
  void snap;

  // ---- derived ----
  const all = useMemo(() => [...byKind.values()].flat().sort((a, b) => a.y - b.y), [byKind]);
  const byQ = useMemo(() => new Map(all.map((e) => [e.q, e])), [all]);
  const laneEvents = useMemo(() => all.filter((e) => e.c === null || shown.includes(e.c)), [all, shown]);
  const mapEvents = useMemo(() => laneEvents.filter((e) => e.lon !== null && kinds.has(e.k)), [laneEvents, kinds]);
  const loadedKinds = byKind.size;
  const totalKinds = meta?.files.filter((f) => f.file.startsWith('events-')).length ?? KINDS.length;

  // ---- era borders: one date at a time, after consent ----
  const [era, setEra] = useState<{ year: number; shapes: EraShape[] } | null>(null);
  const [eraState, setEraState] = useState<{ loading: number | null; failed: { year: number; why: string } | null }>({ loading: null, failed: null });
  const eraYear = eraFor(year);
  useEffect(() => {
    if (borders !== 'era') return;
    if (era?.year === eraYear) return;
    const ac = new AbortController();
    setEraState({ loading: eraYear, failed: null });
    loadEra(eraYear, ac.signal).then(
      (shapes) => { if (!ac.signal.aborted) { setEra({ year: eraYear, shapes }); setEraState({ loading: null, failed: null }); } },
      (e) => {
        if (ac.signal.aborted) return;
        console.error('[MnemoClio] era map', eraYear, e);
        setEraState({ loading: null, failed: { year: eraYear, why: e instanceof Error ? e.message : String(e) } });
      },
    );
    return () => ac.abort();
  }, [borders, eraYear, era?.year]);

  const pick = useCallback((p: Picked | null) => {
    setPicked(p);
    if (!p || !history) return;
    // going somewhere ends a loop (only a drag keeps it), or play would drag back to its first year
    scene.setLoop(null);
    let y: number | null = null;
    if (p.type === 'event') y = byQ.get(p.q)?.y ?? null;
    if (p.type === 'war') y = history.wars.find((w) => w.id === p.id)?.s ?? null;
    if (p.type === 'regime') y = history.regimes.find((r) => r.id === p.id && r.c === p.c)?.s ?? null;
    if (p.type === 'period') y = history.periods.find((r) => r.id === p.id)?.s ?? null;
    if (p.type === 'decade') y = p.decade + Math.floor((p.size ?? 10) / 2);
    if (p.type === 'leader') { y = p.s; const l = history.leaders.find((x) => x.q === p.q && x.of === p.of); const c = l?.c ?? l?.h; if (c && !shown.includes(c)) setShown((s) => [...s, c]); }
    if (y === null) return;
    if (p.type === 'event') { const c = byQ.get(p.q)?.c; if (c && !shown.includes(c)) setShown((s) => [...s, c]); }
    // the cursor is fixed: what was picked comes under it
    scene.goTo(y + 0.5, reduceMotion);
  }, [byQ, history, scene, shown, reduceMotion]);

  // ---- keyboard: space plays, arrows move the cursor, +/- zoom ----
  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (ev.key === ' ') { ev.preventDefault(); scene.setPlaying(!scene.playing); }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); scene.setLoop(null); scene.setCursor(scene.cursor + (ev.key === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 10 : 1)); }
      else if (ev.key === '+' || ev.key === '=') scene.setTarget(zoomAt(scene.target, scene.cursor, 0.6), reduceMotion);
      else if (ev.key === '-') scene.setTarget(zoomAt(scene.target, scene.cursor, 1.6), reduceMotion);
      else if (ev.key === 'Escape') setPicked(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [scene, reduceMotion]);

  // ---- search ----
  const [q, setQ] = useState('');
  const asked = useMemo(() => parseWhen(q), [q]);
  const results = useMemo(() => {
    // "va à la Révolution française": the name search looks for "révolution française"
    const f = asked.rest;
    if (f.length < 2 || !history) return null;
    const hit = (x: Named) => fold(x.o).includes(f) || fold(x.f).includes(f);
    // one item can sit in two subjects (a person who is also a discovery): offered once
    const seen = new Set<string>();
    return {
      events: all.filter(hit).sort((a, b) => b.sl - a.sl).filter((e) => !seen.has(e.q) && !!seen.add(e.q)).slice(0, 10),
      wars: history.wars.filter(hit).slice(0, 4),
      regimes: history.regimes.filter(hit).slice(0, 4),
      leaders: history.leaders.filter(hit).sort((a, b) => b.sl - a.sl).slice(0, 5),
      periods: history.periods.filter(hit).slice(0, 4),
    };
  }, [asked, all, history]);

  // ---- going to a moment, looping on it, a moment at random ----
  /** A year keeps the zoom (at most 600 years around it); a range fills the screen. */
  const goToWhen = useCallback((w: When) => {
    scene.setLoop(null);
    if (w.kind === 'year') scene.setTarget(centreOn(w.a + 0.5, Math.min(600, span(scene.target))), reduceMotion);
    else scene.setTarget({ y0: w.a, y1: w.b + 1 }, reduceMotion);
  }, [scene, reduceMotion]);
  const loopWhen = useCallback((w: When) => {
    scene.setTarget({ y0: w.a, y1: w.b + 1 }, true);
    if (scene.setLoop({ a: w.a, b: w.b + 1 })) scene.setPlaying(true);
  }, [scene]);
  /** The screen is the period: what is on it, from its left edge to its right one. */
  const loopScreen = useCallback(() => {
    if (scene.loop) { scene.setLoop(null); return; }
    if (scene.setLoop({ a: scene.view.y0, b: scene.view.y1 })) scene.setPlaying(true);
  }, [scene]);
  // field, 07/10: "a random period, then time runs". Drawn among the YEARS that have events, each
  // year once, so antiquity has its chance: drawn among events, it would land after 1800 almost always.
  const eventYears = useMemo(() => [...new Set(all.map((e) => e.y))], [all]);
  const randomMoment = useCallback(() => {
    if (!eventYears.length) return;
    const y = eventYears[Math.floor(Math.random() * eventYears.length)]!;
    scene.setLoop(null);
    // six "moments" wide: sixty years from 1400, three centuries before 500
    scene.setTarget(centreOn(y + 0.5, periodOf(y).size * 6), true);
    scene.setPlaying(true);
  }, [eventYears, scene]);
  const loop = scene.loop;

  // ---- the layers (field, 07/10: "only the wars, or only the epidemics, or the three together") ----
  const layerState: LayerState = { wars: showWars, clouds, leaders: showLeaders, epi: showEpi, rel: showRel, kinds };
  /** The subjects Events had before it was switched off, given back when it is switched on. */
  const lastKinds = useRef<ReadonlySet<Kind>>(kinds);
  if (kinds.size) lastKinds.current = kinds;
  const setLayerState = useCallback((n: LayerState) => {
    setShowWars(n.wars); setClouds(n.clouds); setShowLeaders(n.leaders); setShowEpi(n.epi); setShowRel(n.rel); setKinds(new Set(n.kinds));
  }, []);
  const layerNote: Partial<Record<LayerId, string>> = {
    ...(epiFailed ? { epi: t('epi.failed', { why: epiFailed }) } : !epidemics ? { epi: t('layers.reading') } : {}),
    ...(relState.failed ? { rel: t('rel.failed', { why: relState.failed }) } : relState.loading ? { rel: t('layers.reading') } : {}),
  };
  const shownEpi = useMemo(() => (showEpi && epidemics ? epidemics : []), [showEpi, epidemics]);
  const shownRel = showRel ? religions : null;
  const placeTip = useCallback((p: Place) => {
    if (!religions) return '';
    const fam = p.fam < religions.families.length ? relName(religions, religions.families[p.fam]!, lang) : t('rel.other');
    return `${relName(religions, p.q, lang)} · ${fy(p.y)}${p.end !== null ? ' – ' + fy(p.end) : ''} · ${fam}${p.inferred ? ' (' + t('rel.inferred') + ')' : ''} · Wikidata`;
  }, [religions, lang, t]);
  const currentTip = useCallback((c: Current) => (religions ? `✦ ${relName(religions, c.q, lang)} · ${c.about ? t('year.about', { y: fy(c.y) }) : fy(c.y)} · Wikidata` : ''), [religions, lang, t]);
  const epiTip = useCallback((ep: Epidemic) => {
    const years = ep.e === null ? t('epi.noEnd', { s: fy(ep.s) }) : fspan(ep.s, ep.e);
    return `☣ ${epiName(ep, lang)} · ${years}${ep.dead !== null ? ' · ' + t('epi.dead', { n: new Intl.NumberFormat(lang, { notation: 'compact', maximumSignificantDigits: 3 }).format(ep.dead) }) : ''}`;
  }, [t, lang]);

  // ---- the other windows of this MnemoClio: one moment, one set of choices ----
  const choices = useMemo<Choices | null>(() => (history
    ? { shown, kinds: [...kinds], wars: showWars, clouds, leaders: showLeaders, epi: showEpi, rel: showRel, tr, borders, picked }
    : null), [history, shown, kinds, showWars, clouds, showLeaders, showEpi, showRel, tr, borders, picked]);
  const applyChoices = useCallback((c: Choices) => {
    setShown(c.shown); setKinds(new Set(c.kinds)); setShowWars(c.wars); setClouds(c.clouds); setShowLeaders(c.leaders);
    setShowEpi(c.epi); setShowRel(c.rel); setTr(c.tr); setBorders(c.borders); setPicked(c.picked);
  }, []);
  useSync(scene, choices, applyChoices, role !== 'main');
  // the timeline steps the scene in its own frame; a window without one needs its own loop
  useSceneStepper(scene, role === 'map' || role === 'panel');
  // the press that lays the three windows out on their own desktop, and the way back
  const board = useBoard(t);

  // ---- a fact of history on the board (doc 110) ----
  const countryById = useMemo(() => new Map((history?.countries ?? []).map((c) => [c.id, c])), [history]);
  const countryOf = useCallback((id: string | null) => { const c = id ? countryById.get(id) : undefined; return c ? name(c) : null; }, [countryById, name]);
  const buildFact = useCallback((e: Ev) => {
    const m = meanwhileOf(e, all);
    return factCard({
      name: name(e), year: fey(e), ago: yearsAgo(e.y, new Date().getFullYear()), country: countryOf(e.c), kind: t(`kind.${e.k}` as Key),
      meanwhile: m ? { name: name(m), country: countryOf(m.c) } : null,
      words: { when: t('fact.when'), meanwhile: t('fact.meanwhile'), source: t('fact.source') },
    });
  }, [all, name, countryOf, t]);
  // every subject read, or failed: the fact of the day is drawn only from the whole pool
  const subjectsDone = !!history && loadedKinds + errors.filter((e) => (KINDS as readonly string[]).includes(e.what)).length >= totalKinds;
  const fact = useFactCard(all, buildFact, useCallback((q: string) => pick({ type: 'event', q }), [pick]), subjectsDone);

  // ---- pouring a country's history into memory (lot 2) ----
  const pourer = usePourHistory();
  const startPour = useCallback((id: string) => {
    const c = countryById.get(id);
    if (!c || !history) return;
    const words: ChronicleWords = {
      title: t('chron.title'), source: t('chron.source'), regimes: t('chron.regimes'), rulers: t('chron.rulers'), wars: t('chron.wars'), events: t('chron.events'), continued: t('chron.continued'),
      kind: (k) => t(`kind.${k}` as Key),
      people: pop ? (y) => { const a = popAt(pop.c[id], y); return a ? t('chron.people', { n: (a.about ? '≈ ' : '') + fmtPop(a.v, lang), year: fy(y) }) : null; } : null,
    };
    // the chronicles are written when the press is made, with the names on screen in the person's language
    pourer.pour(id, packNameOf(c), () => chroniclesOf(c, history, all, name, words, meta?.readAt ?? '?'));
  }, [countryById, history, t, pop, lang, pourer, all, name, meta]);
  // ---- the chat asked to see a moment (lot E): that country on the timeline, that moment under the cursor ----
  useHostGoto(!!history, useCallback((country: string, year: number) => {
    if (!history) return;
    if (history.countries.some((c) => c.id === country)) setShown((s) => (s.includes(country) ? s : [...s, country]));
    setPicked(null);
    scene.setLoop(null);
    const m = periodOf(year);
    scene.setTarget(centreOn(m.start + m.size / 2, Math.max(40, m.size * 4)), reduceMotion);
  }, [history, scene, reduceMotion]));
  const pourProp = useMemo(() => (pourer.available ? { stateOf: pourer.stateOf, busy: pourer.busy, start: startPour, stop: pourer.stop } : null), [pourer, startPour]);

  // ---- country picker ----
  const [pickQ, setPickQ] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  // the country picker closes on Escape or a press outside it
  useEffect(() => {
    if (!pickerOpen) return;
    const away = (ev: PointerEvent) => { if (!pickerRef.current?.contains(ev.target as Node)) setPickerOpen(false); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setPickerOpen(false); };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('keydown', esc); };
  }, [pickerOpen]);
  const candidates = useMemo(() => {
    if (!history) return [];
    const f = fold(pickQ.trim());
    // empty search: today's states first (the best covered), so the first offers are not obscure territories
    return history.countries.filter((c) => !shown.includes(c.id) && (!f || fold(c.o).includes(f) || fold(c.f).includes(f) || fold(c.en).includes(f))).sort((a, b) => (f ? 0 : Number(a.kind !== 'state') - Number(b.kind !== 'state')) || b.n - a.n).slice(0, f ? 12 : 8);
  }, [history, pickQ, shown]);
  const pickHitsShown = useMemo(() => {
    const f = fold(pickQ.trim());
    return !!f && !!history?.countries.some((c) => shown.includes(c.id) && (fold(c.o).includes(f) || fold(c.f).includes(f) || fold(c.en).includes(f)));
  }, [history, pickQ, shown]);

  const capLine = (k: Kind) => {
    const f = meta?.files.find((x) => x.what === k);
    const c = f?.cap;
    const kind = t(`kind.${k}` as Key);
    if (!c) return kind;
    return c.kept < c.total ? t('subjects.cap', { kind, kept: c.kept.toLocaleString(lang), total: c.total.toLocaleString(lang), min: c.minSl }) : t('subjects.whole', { kind, total: c.total.toLocaleString(lang) });
  };

  // ---- render ----
  if (errors.some((e) => e.what === 'meta' || e.what === 'history')) {
    return <div className="clio-state clio-error"><h1>MnemoClio</h1>{errors.map((e, i) => <p key={i}>{t('load.failed', { what: e.what, why: e.why })}</p>)}</div>;
  }
  if (!history) {
    return <div className="clio-state"><h1>MnemoClio</h1><p>{t('load.reading', { done: 0, total: totalKinds })}</p><div className="clio-bar"><i style={{ width: '6%' }} /></div></div>;
  }
  const stamp = borders === 'era' && era ? t('borders.stamp', { year: era.year }) : t('borders.stampNow');

  const timelineBox = (
    <div className="clio-timeline-wrap">
      <Timeline history={history} events={laneEvents} shown={shown} kinds={kinds} showWars={showWars} showLeaders={showLeaders} sinceLabel={(y) => t('country.since', { year: y })} name={name} theme={theme} scene={scene}
        reduceMotion={reduceMotion} worldLabel={t('world.name')} periodsLabel={t('now.periods')} onPick={pick} onUntranslated={tr ? setUntr : undefined} translated={translated} />
      <p className="clio-hint">{t('app.hint')}</p>
    </div>
  );
  const mapBox = (
    <div className="clio-map-wrap">
      <div className="clio-seg clio-borders" role="group" aria-label="borders">
        <button type="button" aria-pressed={borders === 'now'} onClick={() => setBorders('now')}>{t('borders.now')}</button>
        <button type="button" aria-pressed={borders === 'era'} onClick={showEra}>{t('borders.era')}</button>
      </div>
      <MapView world={world} era={borders === 'era' ? era?.shapes ?? null : null} eraYear={era?.year ?? null} events={mapEvents} wars={showWars ? history.wars : []} periods={history.periods} clouds={clouds} globe={globe} epidemics={shownEpi} epiTip={epiTip} religions={shownRel} placeTip={placeTip} currentTip={currentTip}
        shown={shown} countries={history.countries} name={name} theme={theme} scene={scene} reduceMotion={reduceMotion} stamp={stamp} followLabel={t('map.follow')} onPick={pick} />
      <div className="clio-map-tools">
        <button type="button" aria-pressed={globe} onClick={() => setGlobe((g) => !g)} title={t('globe.hint')}>{globe ? t('globe.flat') : t('globe.label')}</button>
      </div>
      {showRel && relState.failed && <p className="clio-map-note clio-error">{t('rel.failed', { why: relState.failed })}</p>}
      {borders === 'era' && eraState.loading !== null && <p className="clio-map-note">{t('borders.loading', { year: eraState.loading })}</p>}
      {borders === 'era' && eraState.failed && <p className="clio-map-note clio-error">{t('borders.failed', { year: eraState.failed.year, why: eraState.failed.why })}</p>}
      {borders === 'era' && year < ERA_YEARS[0] && <p className="clio-map-note">{t('borders.before', { first: ERA_YEARS[0] })}</p>}
      {/* today's map under an old year: one press away from that year's borders, in the corner
          that stays on screen (field, 07/10: the toggle was past the edge of a window too wide) */}
      {borders === 'now' && year < 1945 && <button type="button" className="clio-map-note clio-map-go" onClick={showEra}>{t('borders.hintNow', { year: fy(year) })}</button>}
      {askEra && (
        <div className="clio-consent" role="dialog" aria-modal="true" aria-labelledby="clio-era-title">
          <h3 id="clio-era-title">{t('borders.consent.title')}</h3>
          <p>{t('borders.consent.body')}</p>
          <p className="clio-note">{ERA_LICENSE} · <a href={ERA_SOURCE} target="_blank" rel="noopener noreferrer">{t('borders.consent.source')}</a></p>
          <div className="clio-seg">
            <button type="button" onClick={() => { writeConsent(); setAskEra(false); setBorders('era'); }}>{t('borders.consent.accept')}</button>
            <button type="button" onClick={() => setAskEra(false)}>{t('borders.consent.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
  const panelBox = (
    <Panel pour={pourProp} pop={pop} religions={shownRel} epidemics={shownEpi} epiWindow={windowFor(span(scene.view))} history={history} byQ={byQ} all={all} shown={shown} kinds={kinds} showWars={showWars} showLeaders={showLeaders} year={year} picked={picked}
      sparks={scene.sparks} playing={playing} tr={tr} name={name} translated={translated} t={t} lang={lang} onPick={pick} />
  );
  const footerLine = <footer className="clio-foot">{t('footer.source', { date: meta?.readAt ?? '—' })} · {popFailed ? t('pop.failed', { why: popFailed }) : t('pop.credit')}</footer>;

  // one piece of the exploded view: that view alone, the header with the timeline
  if (role === 'map') return <div className="clio-app clio-solo">{mapBox}</div>;
  if (role === 'panel') return <div className="clio-app clio-solo">{panelBox}</div>;
  const chrome = (
    <>
      <header className="clio-head">
        <h1 className="clio-brand" title={t('app.subtitle')}>MnemoClio</h1>
        <button type="button" className={playing ? 'clio-play clio-primary on' : 'clio-play clio-primary'} onClick={() => scene.setPlaying(!playing)} aria-pressed={playing}>
          {playing ? '❚❚ ' + t('play.pause') : '▶ ' + t('play.play')}
        </button>
        <button type="button" className={loop ? 'clio-play on' : 'clio-play'} aria-pressed={!!loop} onClick={loopScreen}
          title={loop ? t('loop.stop') : t('loop.hint')}>
          {loop ? t('loop.on', { span: fspan(Math.floor(loop.a), Math.ceil(loop.b) - 1) }) : t('loop.screen')}
        </button>
        <button type="button" className="clio-play" onClick={randomMoment} disabled={!eventYears.length} title={t('random.hint')}>{t('random')}</button>
        <select className="clio-jump" aria-label={t('play.speedLabel')} title={t('play.speedLabel')} value={scene.speed} onChange={(e) => scene.setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => <option key={s} value={s}>{t('play.speed', { n: s })}</option>)}
        </select>
        <select className="clio-jump" aria-label={t('jump.label')} value="" onChange={(e) => {
          const y = Number(e.target.value);
          if (!Number.isFinite(y)) return;
          scene.setLoop(null);
          // keep the zoom, but never wider than 600 years around a jump: a jump is to SEE a moment
          scene.setTarget(centreOn(y + 0.5, Math.min(600, span(scene.target))), reduceMotion);
        }}>
          <option value="">{t('jump.label')}</option>
          {JUMPS.map((y) => <option key={y} value={y}>{fy(y)}</option>)}
        </select>
        <div className="clio-search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} />
          {(results || asked.when || asked.outside) && (
            <div className="clio-results">
              {asked.outside && <span className="clio-empty">{t('search.outside', { from: fy(BOUNDS.min), to: fy(2025) })}</span>}
              {asked.when && (() => {
                const w = asked.when;
                const label = w.kind === 'year' ? fy(w.a) : fspan(w.a, w.b);
                return <>
                  <button type="button" className="clio-pill clio-solid" onClick={() => { goToWhen(w); setQ(''); }}>{t('search.goto', { when: label })}</button>
                  {w.kind !== 'year' && <button type="button" className="clio-pill" onClick={() => { loopWhen(w); setQ(''); }}>{t('search.loop', { when: label })}</button>}
                </>;
              })()}
              {results?.events.map((e) => (
                <button key={e.q} type="button" className="clio-pill" onClick={() => { pick({ type: 'event', q: e.q }); setQ(''); }}>
                  <i className="clio-kd" style={{ background: `hsl(${KIND_HUE[e.k]} 68% var(--clio-l))` }} />{name(e)} <small>{fey(e)}</small>
                </button>
              ))}
              {results?.wars.map((w) => <button key={w.id} type="button" className="clio-pill clio-solid" onClick={() => { pick({ type: 'war', id: w.id }); setQ(''); }}>{name(w)} <small>{t('search.war', { year: fy(w.s) })}</small></button>)}
              {results?.regimes.map((r) => <button key={r.id + r.c} type="button" className="clio-pill" onClick={() => { if (!shown.includes(r.c)) setShown([...shown, r.c]); pick({ type: 'regime', id: r.id, c: r.c }); setQ(''); }}>{name(r)} <small>{t('search.regime', { year: fy(r.s) })}</small></button>)}
              {results?.leaders.map((l) => <button key={l.q + l.of + l.s} type="button" className="clio-pill" onClick={() => { pick({ type: 'leader', q: l.q, of: l.of, s: l.s }); setQ(''); }}>{name(l)} <small>{t('search.leader', { year: fy(l.s) })}</small></button>)}
              {results?.periods.map((p) => <button key={p.id} type="button" className="clio-pill" onClick={() => { pick({ type: 'period', id: p.id }); setQ(''); }}>{name(p)} <small>{t('search.period', { span: fspan(p.s, p.e) })}</small></button>)}
              {results && !asked.when && !results.events.length && !results.wars.length && !results.regimes.length && !results.leaders.length && !results.periods.length && <span className="clio-empty">{t('search.none')}</span>}
            </div>
          )}
        </div>
        <LayersMenu t={t} lang={lang} state={layerState} onChange={setLayerState} lastKinds={lastKinds.current}
          kindCount={(k) => { const loaded = byKind.get(k); return loaded ? loaded.filter((e) => e.c === null || shown.includes(e.c)).length : null; }}
          kindTitle={capLine} layerNote={layerNote} />
        <ViewMenu t={t}>
          <div className="clio-menu-sec">
            <h4>{t('view.zoom')}</h4>
            <div className="clio-seg" role="group" aria-label={t('view.zoom')}>
              <button type="button" onClick={() => scene.setTarget(zoomAt(scene.target, scene.cursor, 0.55), reduceMotion)} title={t('zoom.in')} aria-label={t('zoom.in')}>＋</button>
              <button type="button" onClick={() => scene.setTarget(zoomAt(scene.target, scene.cursor, 1.8), reduceMotion)} title={t('zoom.out')} aria-label={t('zoom.out')}>－</button>
              <button type="button" onClick={() => scene.setTarget({ y0: BOUNDS.min, y1: BOUNDS.min + MAX_SPAN }, reduceMotion)}>{t('zoom.all')}</button>
            </div>
          </div>
          {/* how one window is shared: the exploded view has no share to choose */}
          {role === 'main' && (
            <div className="clio-menu-sec">
              <h4>{t('layout.label')}</h4>
              <div className="clio-seg" role="group" aria-label={t('layout.label')}>
                {(Object.keys(LAYOUTS) as Array<keyof typeof LAYOUTS>).map((k) => (
                  <button key={k} type="button" aria-pressed={Math.abs(layout.timeline - LAYOUTS[k].timeline) < 0.01 && Math.abs(layout.map - LAYOUTS[k].map) < 0.01}
                    onClick={() => setLayout(LAYOUTS[k])}>{t(`layout.${k}` as Key)}</button>
                ))}
              </div>
            </div>
          )}
          {board.available && (role === 'main' || role === 'timeline') && (
            <div className="clio-menu-sec">
              <h4>{t('board.label')}</h4>
              <div className="clio-seg" role="group" aria-label={t('board.label')}>
                {role === 'main'
                  ? <button type="button" disabled={board.busy} onClick={board.open} title={t('board.openHint')}>{board.busy ? t('board.opening') : t('board.open')}</button>
                  : <button type="button" disabled={board.busy} onClick={board.leave} title={t('board.leaveHint')}>{t('board.leave')}</button>}
                {role === 'main' && board.full && <button type="button" disabled={board.busy} onClick={board.openHere} title={t('board.hereHint')}>{t('board.here')}</button>}
              </div>
              {/* said HERE, where the press was: under the header it sat behind this open menu (field, 08/10) */}
              {board.error && <p className="clio-note clio-error" role="status">{board.error}</p>}
            </div>
          )}
          <div className="clio-menu-sec">
            <h4>{t('view.names')}</h4>
            <div className="clio-seg" role="group" aria-label={t('view.names')}>
              <button type="button" aria-pressed={!tr} onClick={() => setTr(false)} title={t('names.original.hint')}>{t('names.original')}</button>
              <button type="button" aria-pressed={tr} onClick={() => setTr(true)}>{t('names.mine', { language: langLabel })}</button>
            </div>
          </div>
          {fact.available && (
            <div className="clio-menu-sec">
              <h4>{t('fact.label')}</h4>
              <div className="clio-seg" role="group" aria-label={t('fact.label')}>
                <button type="button" aria-pressed={fact.pinned === true} disabled={fact.pinned === null} onClick={fact.toggle} title={t('fact.hint')}>
                  {fact.pinned ? t('fact.unpin') : t('fact.pin')}
                </button>
                {fact.pinned && <button type="button" onClick={fact.another} title={t('fact.anotherHint')}>{t('fact.another')}</button>}
              </div>
            </div>
          )}
        </ViewMenu>
      </header>
      {fact.available && fact.error && <p className="clio-note clio-error clio-headnote" role="status">{t('fact.failed', { why: fact.error })}</p>}

      <section className="clio-row">
        <div className="clio-chips">
          {shown.map((id) => {
            const c = history.countries.find((k) => k.id === id)!;
            return (
              <button key={id} type="button" className="clio-chip on" style={{ '--c': `hsl(${c.h} 68% var(--clio-l))` } as CSSProperties}
                title={t('countries.remove', { name: c.f ?? c.o })} onClick={() => shown.length > 1 && setShown(shown.filter((x) => x !== id))}>
                <i /> <span lang={tr && c.f ? 'fr' : c.ol}>{name(c)}</span> <small>{c.n.toLocaleString(lang)}</small> ×
              </button>
            );
          })}
          <div className="clio-popwrap" ref={pickerRef}>
            <button type="button" className="clio-pill clio-add" aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}>＋ {t('countries.add')}</button>
            {pickerOpen && (
              <div className="clio-pop" role="dialog" aria-label={t('countries.add')}>
                <input type="search" autoFocus value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder={t('countries.add')} aria-label={t('countries.add')} />
                <p className="clio-note">{t('countries.count', { n: history.countries.length })}</p>
                <div className="clio-pills">
                  {candidates.map((c) => (
                    <button key={c.id} type="button" className="clio-pill" onClick={() => { setShown([...shown, c.id]); setPickQ(''); }}>
                      + <span lang={c.ol}>{name(c)}</span>{!tr && c.f && c.f !== c.o && <small> ({c.f})</small>}
                {c.kind === 'ended' && <small className="clio-kindtag">{t('polity.ended', { s: c.s === null ? '?' : fy(c.s), e: c.e === null ? '?' : fy(c.e) })}</small>}
                {c.kind === 'territory' && <small className="clio-kindtag">{t('polity.territory')}</small>}
                <small>{c.n}</small>
                    </button>
                  ))}
                  {pickQ && candidates.length === 0 && <span className="clio-empty">{pickHitsShown ? t('countries.already') : t('countries.none')}</span>}
                </div>
                <div className="clio-pills">
                  <button type="button" className="clio-pill" onClick={() => { setShown(history.countries.filter((c) => c.kind === 'state').slice(0, 15).map((c) => c.id)); setPickerOpen(false); }}>{t('countries.top')}</button>
                  <button type="button" className="clio-pill" onClick={() => { setShown(DEFAULT_SHOWN); setPickerOpen(false); }}>{t('countries.reset')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {(loadedKinds < totalKinds || errors.length > 0 || dropped.length > 0 || tr) && (
        <div className="clio-notices">
          {loadedKinds < totalKinds && (
            <div className="clio-loading"><span>{t('load.reading', { done: loadedKinds, total: totalKinds })}</span><div className="clio-bar"><i style={{ width: `${Math.round((100 * loadedKinds) / totalKinds)}%` }} /></div></div>
          )}
          {errors.map((e, i) => <p key={i} className="clio-error">{t('load.failed', { what: e.what, why: e.why })}</p>)}
          {dropped.map((d, i) => <p key={i} className="clio-note">{t('load.dropped', { n: d.n, what: d.what })}</p>)}
          {tr && <p className="clio-note">{namesState.loading ? t('names.loading', { language: langLabel }) : namesState.failed ? t('names.failed', { language: langLabel, why: namesState.failed }) : untr > 0 ? t('names.missing', { n: untr, language: langLabel }) : t('names.allThere', { language: langLabel })}</p>}
        </div>
      )}
    </>
  );
  if (role === 'timeline') {
    return (
      <div className="clio-app">
        {chrome}
        <main className="clio-main clio-solo-main">{timelineBox}</main>
        {footerLine}
      </div>
    );
  }

  return (
    <div className="clio-app">
      {chrome}
      <main ref={mainRef} className="clio-main" style={{ '--clio-tl': `${(layout.timeline * 100).toFixed(1)}%`, '--clio-map': `${layout.map}fr`, '--clio-panel-share': `${1 - layout.map}fr` } as CSSProperties}>
        {timelineBox}
        <div className="clio-split clio-split-rows" role="separator" aria-orientation="horizontal" aria-label={t('layout.resize')} tabIndex={0}
          aria-valuenow={Math.round(layout.timeline * 100)} aria-valuemin={20} aria-valuemax={85} onPointerDown={startSplit('rows')} onKeyDown={nudge('rows')} />
        <div ref={bottomRef} className="clio-bottom">
          {mapBox}
          <div className="clio-split clio-split-cols" role="separator" aria-orientation="vertical" aria-label={t('layout.resize')} tabIndex={0}
            aria-valuenow={Math.round(layout.map * 100)} aria-valuemin={25} aria-valuemax={85} onPointerDown={startSplit('cols')} onKeyDown={nudge('cols')} />
          {panelBox}
        </div>
      </main>

      {footerLine}
    </div>
  );
}
