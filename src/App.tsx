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
import { loadAll } from './data/load';
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
import { Timeline } from './ui/Timeline';
import { LAYOUTS, clampLayout, readLayout, saveLayout, type Layout } from './ui/layout';
import { fey, fy, setYearFormat } from './engine/years';
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
  const [tr, setTr] = useState(false);
  const [borders, setBorders] = useState<'now' | 'era'>('now');
  const [askEra, setAskEra] = useState(false);
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
  const name = useCallback((x: Named) => (tr ? x.f ?? x.o : x.o), [tr]);

  // the cursor's year, the play state and the feed, from the scene
  const snap = useSyncExternalStore(
    useCallback((fn: () => void) => scene.subscribe(fn), [scene]),
    () => `${Math.floor(scene.cursor)}|${scene.playing}|${scene.speed}|${scene.sparks[0]?.at ?? 0}`,
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
    let y: number | null = null;
    if (p.type === 'event') y = byQ.get(p.q)?.y ?? null;
    if (p.type === 'war') y = history.wars.find((w) => w.id === p.id)?.s ?? null;
    if (p.type === 'regime') y = history.regimes.find((r) => r.id === p.id && r.c === p.c)?.s ?? null;
    if (p.type === 'period') y = history.periods.find((r) => r.id === p.id)?.s ?? null;
    if (p.type === 'decade') y = p.decade + Math.floor((p.size ?? 10) / 2);
    if (p.type === 'leader') { y = p.s; const l = history.leaders.find((x) => x.q === p.q && x.of === p.of); const c = l?.c ?? l?.h; if (c && !shown.includes(c)) setShown((s) => [...s, c]); }
    if (y === null) return;
    if (p.type === 'event') { const c = byQ.get(p.q)?.c; if (c && !shown.includes(c)) setShown((s) => [...s, c]); }
    scene.setCursor(y + 0.5);
    const v = scene.target;
    if (y < v.y0 + span(v) * 0.08 || y > v.y1 - span(v) * 0.08) scene.setTarget(centreOn(y, span(v)), reduceMotion);
  }, [byQ, history, scene, shown, reduceMotion]);

  // ---- keyboard: space plays, arrows move the cursor, +/- zoom ----
  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (ev.key === ' ') { ev.preventDefault(); scene.setPlaying(!scene.playing); }
      else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); scene.setCursor(scene.cursor + (ev.key === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 10 : 1)); }
      else if (ev.key === '+' || ev.key === '=') scene.setTarget(zoomAt(scene.target, scene.cursor, 0.6), reduceMotion);
      else if (ev.key === '-') scene.setTarget(zoomAt(scene.target, scene.cursor, 1.6), reduceMotion);
      else if (ev.key === 'Escape') setPicked(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [scene, reduceMotion]);

  // ---- search ----
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const f = fold(q.trim());
    if (f.length < 2 || !history) return null;
    const hit = (x: Named) => fold(x.o).includes(f) || fold(x.f).includes(f);
    // one item can sit in two subjects (a person who is also a discovery): offered once
    const seen = new Set<string>();
    return {
      events: all.filter(hit).sort((a, b) => b.sl - a.sl).filter((e) => !seen.has(e.q) && !!seen.add(e.q)).slice(0, 10),
      wars: history.wars.filter(hit).slice(0, 4),
      regimes: history.regimes.filter(hit).slice(0, 4),
      leaders: history.leaders.filter(hit).sort((a, b) => b.sl - a.sl).slice(0, 5),
    };
  }, [q, all, history]);

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

  return (
    <div className="clio-app">
      <header className="clio-head">
        <div className="clio-title">
          <h1>MnemoClio</h1>
          <p>{t('app.subtitle')}</p>
        </div>
        <button type="button" className={playing ? 'clio-play on' : 'clio-play'} onClick={() => scene.setPlaying(!playing)} aria-pressed={playing}>
          {playing ? '❚❚ ' + t('play.pause') : '▶ ' + t('play.play')}
        </button>
        <div className="clio-seg" role="group" aria-label="speed">
          {SPEEDS.map((s) => <button key={s} type="button" aria-pressed={scene.speed === s} onClick={() => scene.setSpeed(s)}>{t('play.speed', { n: s })}</button>)}
        </div>
        <select className="clio-jump" aria-label={t('jump.label')} value="" onChange={(e) => {
          const y = Number(e.target.value);
          if (!Number.isFinite(y)) return;
          scene.setCursor(y + 0.5);
          // keep the zoom, but never wider than 600 years around a jump: a jump is to SEE a moment
          scene.setTarget(centreOn(y, Math.min(600, span(scene.target))), reduceMotion);
        }}>
          <option value="">{t('jump.label')}</option>
          {JUMPS.map((y) => <option key={y} value={y}>{fy(y)}</option>)}
        </select>
        <div className="clio-seg" role="group" aria-label="zoom">
          <button type="button" onClick={() => scene.setTarget(zoomAt(scene.target, scene.cursor, 0.55), reduceMotion)} title={t('zoom.in')} aria-label={t('zoom.in')}>＋</button>
          <button type="button" onClick={() => scene.setTarget(zoomAt(scene.target, scene.cursor, 1.8), reduceMotion)} title={t('zoom.out')} aria-label={t('zoom.out')}>－</button>
          <button type="button" onClick={() => scene.setTarget({ y0: BOUNDS.min, y1: BOUNDS.min + MAX_SPAN }, reduceMotion)}>{t('zoom.all')}</button>
        </div>
        <div className="clio-seg" role="group" aria-label={t('layout.label')}>
          {(Object.keys(LAYOUTS) as Array<keyof typeof LAYOUTS>).map((k) => (
            <button key={k} type="button" aria-pressed={Math.abs(layout.timeline - LAYOUTS[k].timeline) < 0.01 && Math.abs(layout.map - LAYOUTS[k].map) < 0.01}
              onClick={() => setLayout(LAYOUTS[k])}>{t(`layout.${k}` as Key)}</button>
          ))}
        </div>
        <div className="clio-seg" role="group" aria-label="names">
          <button type="button" aria-pressed={!tr} onClick={() => setTr(false)} title={t('names.original.hint')}>{t('names.original')}</button>
          <button type="button" aria-pressed={tr} onClick={() => setTr(true)}>{t('names.french')}</button>
        </div>
        <div className="clio-search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} />
          {results && (
            <div className="clio-results">
              {results.events.map((e) => (
                <button key={e.q} type="button" className="clio-pill" onClick={() => { pick({ type: 'event', q: e.q }); setQ(''); }}>
                  <i className="clio-kd" style={{ background: `hsl(${KIND_HUE[e.k]} 68% var(--clio-l))` }} />{name(e)} <small>{fey(e)}</small>
                </button>
              ))}
              {results.wars.map((w) => <button key={w.id} type="button" className="clio-pill clio-solid" onClick={() => { pick({ type: 'war', id: w.id }); setQ(''); }}>{name(w)} <small>{t('search.war', { year: fy(w.s) })}</small></button>)}
              {results.regimes.map((r) => <button key={r.id + r.c} type="button" className="clio-pill" onClick={() => { if (!shown.includes(r.c)) setShown([...shown, r.c]); pick({ type: 'regime', id: r.id, c: r.c }); setQ(''); }}>{name(r)} <small>{t('search.regime', { year: fy(r.s) })}</small></button>)}
              {results.leaders.map((l) => <button key={l.q + l.of + l.s} type="button" className="clio-pill" onClick={() => { pick({ type: 'leader', q: l.q, of: l.of, s: l.s }); setQ(''); }}>{name(l)} <small>{t('search.leader', { year: fy(l.s) })}</small></button>)}
              {!results.events.length && !results.wars.length && !results.regimes.length && !results.leaders.length && <span className="clio-empty">{t('search.none')}</span>}
            </div>
          )}
        </div>
      </header>

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

      <section className="clio-row clio-kinds">
        <button type="button" className={showWars ? 'clio-chip on' : 'clio-chip'} style={{ '--c': 'var(--text-primary)' } as CSSProperties} onClick={() => setShowWars(!showWars)} aria-pressed={showWars}>
          <i /> {t('kind.wars')} <small>{history.wars.length}</small>
        </button>
        <button type="button" className={showLeaders ? 'clio-chip on' : 'clio-chip'} style={{ '--c': 'var(--text-primary)' } as CSSProperties} onClick={() => setShowLeaders(!showLeaders)} aria-pressed={showLeaders}>
          <i /> {t('kind.leaders')} <small>{history.leaders.filter((l) => (l.c !== null && shown.includes(l.c)) || (l.h !== null && shown.includes(l.h))).length.toLocaleString(lang)}</small>
        </button>
        {KINDS.map((k) => {
          const loaded = byKind.get(k);
          const n = loaded ? loaded.filter((e) => e.c === null || shown.includes(e.c)).length : null;
          return (
            <button key={k} type="button" className={kinds.has(k) ? 'clio-chip on' : 'clio-chip'} style={{ '--c': `hsl(${KIND_HUE[k]} 68% var(--clio-l))` } as CSSProperties}
              aria-pressed={kinds.has(k)} title={capLine(k)}
              onClick={() => { const s = new Set(kinds); if (s.has(k)) s.delete(k); else s.add(k); setKinds(s); }}>
              <i /> {t(`kind.${k}` as Key)} <small>{n === null ? '…' : n.toLocaleString(lang)}</small>
            </button>
          );
        })}
        <button type="button" className="clio-pill" onClick={() => { setKinds(new Set(KINDS)); setShowWars(true); setShowLeaders(true); }}>{t('subjects.all')}</button>
        <button type="button" className="clio-pill" onClick={() => { setKinds(new Set()); setShowWars(false); setShowLeaders(false); }}>{t('subjects.none')}</button>
      </section>

      {(loadedKinds < totalKinds || errors.length > 0 || dropped.length > 0 || tr) && (
        <div className="clio-notices">
          {loadedKinds < totalKinds && (
            <div className="clio-loading"><span>{t('load.reading', { done: loadedKinds, total: totalKinds })}</span><div className="clio-bar"><i style={{ width: `${Math.round((100 * loadedKinds) / totalKinds)}%` }} /></div></div>
          )}
          {errors.map((e, i) => <p key={i} className="clio-error">{t('load.failed', { what: e.what, why: e.why })}</p>)}
          {dropped.map((d, i) => <p key={i} className="clio-note">{t('load.dropped', { n: d.n, what: d.what })}</p>)}
          {tr && <p className="clio-note">{untr > 0 ? t('names.missing', { n: untr }) : t('names.allThere')}</p>}
        </div>
      )}

      <main ref={mainRef} className="clio-main" style={{ '--clio-tl': `${(layout.timeline * 100).toFixed(1)}%`, '--clio-map': `${layout.map}fr`, '--clio-panel-share': `${1 - layout.map}fr` } as CSSProperties}>
        <div className="clio-timeline-wrap">
          <Timeline history={history} events={laneEvents} shown={shown} kinds={kinds} showWars={showWars} showLeaders={showLeaders} sinceLabel={(y) => t('country.since', { year: y })} name={name} theme={theme} scene={scene}
            reduceMotion={reduceMotion} worldLabel={t('world.name')} periodsLabel={t('now.periods')} onPick={pick} onUntranslated={tr ? setUntr : undefined} />
          <p className="clio-hint">{t('app.hint')}</p>
        </div>
        <div className="clio-split clio-split-rows" role="separator" aria-orientation="horizontal" aria-label={t('layout.resize')} tabIndex={0}
          aria-valuenow={Math.round(layout.timeline * 100)} aria-valuemin={20} aria-valuemax={85} onPointerDown={startSplit('rows')} onKeyDown={nudge('rows')} />
        <div ref={bottomRef} className="clio-bottom">
          <div className="clio-map-wrap">
            <div className="clio-seg clio-borders" role="group" aria-label="borders">
              <button type="button" aria-pressed={borders === 'now'} onClick={() => setBorders('now')}>{t('borders.now')}</button>
              <button type="button" aria-pressed={borders === 'era'} onClick={() => { if (readConsent()) setBorders('era'); else setAskEra(true); }}>{t('borders.era')}</button>
            </div>
            <MapView world={world} era={borders === 'era' ? era?.shapes ?? null : null} eraYear={era?.year ?? null} events={mapEvents} wars={showWars ? history.wars : []}
              shown={shown} countries={history.countries} name={name} theme={theme} scene={scene} reduceMotion={reduceMotion} stamp={stamp} followLabel={t('map.follow')} onPick={pick} />
            {borders === 'era' && eraState.loading !== null && <p className="clio-map-note">{t('borders.loading', { year: eraState.loading })}</p>}
            {borders === 'era' && eraState.failed && <p className="clio-map-note clio-error">{t('borders.failed', { year: eraState.failed.year, why: eraState.failed.why })}</p>}
            {borders === 'era' && year < ERA_YEARS[0] && <p className="clio-map-note">{t('borders.before', { first: ERA_YEARS[0] })}</p>}
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
          <div className="clio-split clio-split-cols" role="separator" aria-orientation="vertical" aria-label={t('layout.resize')} tabIndex={0}
            aria-valuenow={Math.round(layout.map * 100)} aria-valuemin={25} aria-valuemax={85} onPointerDown={startSplit('cols')} onKeyDown={nudge('cols')} />
          <Panel history={history} byQ={byQ} all={all} shown={shown} kinds={kinds} showWars={showWars} showLeaders={showLeaders} year={year} picked={picked}
            sparks={scene.sparks} playing={playing} tr={tr} name={name} t={t} onPick={pick} />
        </div>
      </main>

      <footer className="clio-foot">{t('footer.source', { date: meta?.readAt ?? '—' })}</footer>
    </div>
  );
}
