/**
 * Timeline.tsx — the moving timeline, on canvas.
 *
 * Drag it and it follows the finger, let go and it glides; the wheel zooms around the year
 * under the pointer; a double-click dives in. What is drawn changes with the zoom: a bar per
 * decade, then a dot per event, then names where they fit (levelOf). Newcomers grow in a
 * left-to-right wave (Arrivals), leavers fade, and the play cursor lights what it passes.
 *
 * One rAF loop, asleep when nothing moves and woken by the scene (house rules 10 and 13: every
 * listener and the loop are released on unmount). Colours come from the host theme.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ev, History, Kind, Leader, Named, Regime, War } from '../data/types';
import { crossed } from '../data/decode';
import { Arrivals, rippleProgress, type Ripple } from '../engine/arrival';
import { placeLabels, rowOf } from '../engine/labels';
import { layoutLanes, packRows, BAND_H, LEADER_H, type Lane, type LaneSpec } from '../engine/lanes';
import { KIND_HUE, hsl, kindColor } from '../engine/palette';
import type { Scene, Picked } from '../engine/scene';
import { completeTheme, type Theme } from '../engine/theme';
import { BOUNDS, CENTRE, centreOn, levelOf, panBy, span, tickStep, xToYear, yearToX, zoomAt, type Level, type View } from '../engine/view';
import { bucketYears, fey, fspan, fy } from '../engine/years';
import { drawDot } from '../engine/dot';

const GUTTER = 132;
const RULER_H = 30;
/** How many events the play cursor may light in one frame: a fast play over a dense decade must not flood the screen. */
const SPARKS_PER_FRAME = 4;

export interface TimelineProps {
  history: History;
  /** Every loaded event of the shown countries and the world, sorted by year. */
  events: Ev[];
  shown: string[];
  kinds: ReadonlySet<Kind>;
  showWars: boolean;
  showLeaders: boolean;
  /** "Exists since {year}" for the founding mark of a country. */
  sinceLabel: (year: number) => string;
  name: (x: Named) => string;
  theme: Theme;
  scene: Scene;
  reduceMotion: boolean;
  worldLabel: string;
  periodsLabel: string;
  onPick: (p: Picked) => void;
  /** A frame's names that have no French label, for the translation notice. */
  onUntranslated?: (n: number) => void;
  /** Has this item a name in the person's language (for the count of those that have none)? */
  translated: (x: Named) => boolean;
}

interface Hit { x: number; y: number; r: number; pick: Picked; tip: string }

/** The timeline: one lane per country, the fixed cursor in the middle, every gesture moving the view under it. */
export function Timeline(p: TimelineProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [contentH, setContentH] = useState(400);
  const props = useRef(p);
  props.current = p;

  const arrivals = useMemo(() => new Arrivals(), []);
  useEffect(() => { arrivals.setReduce(p.reduceMotion); }, [arrivals, p.reduceMotion]);

  // Per-lane indexes, rebuilt only when the data or the selection change, never per frame.
  const index = useMemo(() => {
    const byLane = new Map<string, Ev[]>();
    const push = (key: string, e: Ev) => { let l = byLane.get(key); if (!l) byLane.set(key, (l = [])); l.push(e); };
    for (const e of p.events) {
      if (!p.kinds.has(e.k)) continue;
      // two views, two readings: today's country keeps what resolved to it, and an ended state or
      // territory on the timeline ALSO shows what Wikidata ties to it directly (doc 137 §5ter)
      if (e.h && p.shown.includes(e.h)) push(e.h, e);
      const key = e.c ?? 'world';
      if (key !== 'world' && !p.shown.includes(key)) continue;
      push(key, e);
    }
    const regimesBy = new Map<string, Regime[]>();
    for (const r of p.history.regimes) {
      if (!p.shown.includes(r.c)) continue;
      let l = regimesBy.get(r.c);
      if (!l) regimesBy.set(r.c, (l = []));
      l.push(r);
    }
    const warsBy = new Map<string, War[]>();
    if (p.showWars) for (const w of p.history.wars) {
      const where = new Set(w.b.map((b) => b.c));
      for (const c of where) if (p.shown.includes(c)) {
        let l = warsBy.get(c);
        if (!l) warsBy.set(c, (l = []));
        l.push(w);
      }
    }
    // leaders, by country and office kind (a row for heads of state, one for heads of government)
    const leadersBy = new Map<string, { state: Leader[]; gov: Leader[] }>();
    if (p.showLeaders) for (const l of p.history.leaders) {
      for (const key of [l.c, l.h]) {
        if (!key || !p.shown.includes(key)) continue;
        let g = leadersBy.get(key);
        if (!g) leadersBy.set(key, (g = { state: [], gov: [] }));
        g[p.history.offices[l.of]!.k].push(l);
      }
    }
    const warIndex = new Map(p.history.wars.map((w) => [w.id, w]));
    const periods = p.showWars
      ? p.history.periods.filter((pe) => pe.kids.some((k) => warIndex.get(k)?.b.some((b) => p.shown.includes(b.c))))
      : [];
    const bandRow = new Map<{ s: number; e: number }, number>();
    const specs: LaneSpec[] = [];
    if (periods.length) specs.push({ key: 'periods', kind: 'periods', bandRows: packRows(periods, bandRow), hasWars: false, hasEvents: false });
    if (byLane.get('world')?.length) specs.push({ key: 'world', kind: 'world', bandRows: 0, hasWars: false, hasEvents: true });
    for (const c of p.shown) {
      const lg = leadersBy.get(c);
      specs.push({ key: c, kind: 'country', bandRows: packRows(regimesBy.get(c) ?? [], bandRow), leaderRows: lg ? Number(lg.state.length > 0) + Number(lg.gov.length > 0) : 0, hasWars: (warsBy.get(c)?.length ?? 0) > 0, hasEvents: (byLane.get(c)?.length ?? 0) > 0 });
    }
    // Ignitable events for the play cursor, sorted by year, most known first within a year.
    const ignitable = [...byLane.values()].flat().sort((a, b) => a.y - b.y || b.sl - a.sl);
    return { byLane, regimesBy, warsBy, leadersBy, periods, bandRow, specs, ignitable };
  }, [p.events, p.history, p.kinds, p.shown, p.showWars, p.showLeaders]);
  const indexRef = useRef(index);
  indexRef.current = index;

  // ---- drawing --------------------------------------------------------------------------
  const hits = useRef<Hit[]>([]);
  const ripples = useRef<Ripple[]>([]);
  const textWidth = useRef(new Map<string, number>());
  const levelRef = useRef<Level>('dots');

  const draw = useCallback((now: number) => {
    const P = props.current;
    const ix = indexRef.current;
    const canvas = canvasRef.current, ruler = rulerRef.current, wrap = wrapRef.current, sc = scrollRef.current;
    if (!canvas || !ruler || !wrap || !sc) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth, H = sc.clientHeight;
    const tw = Math.max(200, W - GUTTER);
    P.scene.width = tw;
    for (const [c, w, h] of [[canvas, W, H], [ruler, W, RULER_H]] as const) {
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        c.style.width = w + 'px'; c.style.height = h + 'px';
      }
    }
    const v: View = P.scene.view;
    const level = levelOf(v, tw);
    levelRef.current = level;
    const { lanes, height } = layoutLanes(ix.specs, level);
    if (Math.abs(height - contentHRef.current) > 1) { contentHRef.current = height; setContentH(height); }
    const X = (year: number) => GUTTER + yearToX(v, tw, year);
    const th = completeTheme(P.theme);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const top = sc.scrollTop;
    const newHits: Hit[] = [];
    const visibleIds: string[] = [];
    // positions are rebuilt every frame (a ripple must start where the dot IS); the leaving ones keep their last place
    const prevPos = posRef.current;
    const placedPos = new Map<string, { x: number; y: number; r: number; color: string; hollow: boolean }>();
    let untranslated = 0;
    const nm = (x: Named) => { if (!P.translated(x)) untranslated++; return P.name(x); };

    // decade grid
    const step = tickStep(v, tw);
    ctx.lineWidth = 1;
    for (let y = Math.ceil(v.y0 / step) * step; y <= v.y1; y += step) {
      const x = Math.round(X(y)) + 0.5;
      ctx.strokeStyle = th.line;
      ctx.globalAlpha = y % (step * 5) === 0 ? 0.9 : 0.45;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const lane of lanes) {
      const ly = lane.y - top;
      if (ly > H || ly + lane.h < 0) continue;
      ctx.fillStyle = th.laneTint;
      ctx.fillRect(GUTTER, ly, tw, lane.h);
      drawLane(ctx, lane, ly, now);
    }

    // the play cursor
    const cx = X(P.scene.cursor);
    ctx.strokeStyle = th.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();

    // ripples (play cursor passing an event)
    ripples.current = ripples.current.filter((r) => {
      const t = rippleProgress(r, now);
      if (t === null) return false;
      const ry = r.y - top;
      ctx.strokeStyle = hsl(r.hue, th.l, 75, 1 - t);
      ctx.lineWidth = 2 * (1 - t) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, ry, 4 + t * 26, 0, Math.PI * 2); ctx.stroke();
      return true;
    });

    // gutter: country names stay put while the years slide under them
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, GUTTER - 4, H);
    for (const lane of lanes) {
      const ly = lane.y - top;
      if (ly > H || ly + lane.h < 0) continue;
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      if (lane.kind === 'country') {
        const c = P.history.countries.find((k) => k.id === lane.key)!;
        ctx.fillStyle = hsl(c.h, th.l, 70);
        ctx.beginPath(); ctx.arc(14, ly + 11, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = th.text;
        ctx.fillText(ellipsize(ctx, nm(c), GUTTER - 32), 24, ly + 11);
      } else {
        ctx.fillStyle = th.muted;
        ctx.fillText(lane.kind === 'world' ? P.worldLabel : P.periodsLabel, 12, ly + 11);
      }
    }
    hits.current = newHits;
    P.onUntranslated?.(untranslated);

    // ruler
    const rc = ruler.getContext('2d')!;
    rc.setTransform(dpr, 0, 0, dpr, 0, 0);
    rc.clearRect(0, 0, W, RULER_H);
    rc.fillStyle = th.bg; rc.fillRect(0, 0, W, RULER_H);
    rc.font = '12px system-ui, sans-serif'; rc.textBaseline = 'middle'; rc.textAlign = 'center';
    for (let y = Math.ceil(Math.max(v.y0, BOUNDS.min) / step) * step; y <= Math.min(v.y1, CENTRE.max); y += step) {
      const x = X(y);
      if (x < GUTTER + 12) continue;
      rc.fillStyle = y % (step * 5) === 0 ? th.text : th.muted;
      rc.fillText(fy(y), x, RULER_H / 2 - 2);
      rc.fillRect(x, RULER_H - 6, 1, 6);
    }
    // cursor bubble
    const label = fy(Math.floor(P.scene.cursor));
    rc.font = '700 13px system-ui, sans-serif';
    const bw = rc.measureText(label).width + 16;
    rc.fillStyle = th.accent;
    roundRect(rc, cx - bw / 2, 3, bw, RULER_H - 8, 8); rc.fill();
    rc.fillStyle = th.onAccent;
    rc.fillText(label, cx, RULER_H / 2 - 1);
    rc.textAlign = 'left';

    arrivals.update(visibleIds, now);
    // where the fading ones were last drawn
    for (const id of arrivals.leaving()) {
      const at = prevPos.get(id);
      if (at) placedPos.set(id, at);
      if (!at) continue;
      const look = arrivals.look(id, now);
      ctx.globalAlpha = look.alpha * 0.8;
      drawDot(ctx, at.x, at.y - top, at.r * look.scale, at.color, at.hollow);
    }
    ctx.globalAlpha = 1;
    posRef.current = placedPos;

    // ---------------------------------------------------------------------------------
    function drawLane(c: CanvasRenderingContext2D, lane: Lane, ly: number, t: number) {
      const off = ly - lane.y;
      // bands: regimes, or periods
      if (lane.kind === 'periods') {
        for (const pe of ix.periods) {
          const row = ix.bandRow.get(pe) ?? 0;
          band(c, X(pe.s), X(pe.e), lane.bandY + off + row * (BAND_H + 2), th.accent, 0.16, nm(pe), true,
            { type: 'period', id: pe.id }, `${P.name(pe)} · ${fspan(pe.s, pe.e)}`);
        }
        return;
      }
      if (lane.kind === 'country') {
        const country = P.history.countries.find((k) => k.id === lane.key)!;
        for (const r of ix.regimesBy.get(lane.key) ?? []) {
          const row = ix.bandRow.get(r) ?? 0;
          band(c, X(r.s), X(r.e), lane.bandY + off + row * (BAND_H + 2), hsl(country.h, th.l, 62), r.open ? 0.35 : 0.85, nm(r), false,
            { type: 'regime', id: r.id, c: r.c }, `${P.name(r)} · ${fspan(r.s, r.e, r.open)}`);
        }
        // the country itself: a thin line from the year it exists, with a mark where it starts
        if (country.s !== null && country.s <= v.y1) {
          const x0 = Math.max(GUTTER, X(country.s));
          const ly0 = lane.bandY + off - 5;
          // an ended state stops where it ended; a state of today runs to the edge
          const x1 = country.e !== null ? Math.min(GUTTER + tw, X(country.e)) : GUTTER + tw;
          c.strokeStyle = hsl(country.h, th.l, 62, 0.75); c.lineWidth = 2; c.setLineDash([]);
          c.beginPath(); c.moveTo(x0, ly0); c.lineTo(Math.max(x0, x1), ly0); c.stroke();
          if (X(country.s) >= GUTTER) {
            c.fillStyle = hsl(country.h, th.l, 62);
            c.beginPath(); c.moveTo(X(country.s), ly0 - 5); c.lineTo(X(country.s) + 5, ly0); c.lineTo(X(country.s), ly0 + 5); c.lineTo(X(country.s) - 5, ly0); c.closePath(); c.fill();
            newHits.push({ x: X(country.s), y: lane.bandY - 5, r: 8, pick: { type: 'decade', key: lane.key, decade: Math.floor(country.s / 10) * 10 }, tip: `${P.name(country)} · ${country.e !== null ? fspan(country.s, country.e) : P.sinceLabel(country.s)}` });
          }
        }
        // leaders: one row of terms per office kind, names where they fit
        const lg = ix.leadersBy.get(lane.key);
        if (lg) {
          let row = 0;
          for (const terms of [lg.state, lg.gov]) {
            if (!terms.length) continue;
            const ry = lane.leaderY + off + row * (LEADER_H + 2);
            row++;
            for (const l of terms) {
              const a = Math.max(GUTTER, X(l.s)), b = Math.min(GUTTER + tw, X(l.e));
              if (b < GUTTER || a > GUTTER + tw || b - a < 0.5) continue;
              c.globalAlpha = l.open ? 0.3 : 0.55;
              c.fillStyle = hsl(country.h, th.l, 70);
              roundRect(c, a, ry, Math.max(1.5, b - a - 1), LEADER_H, 4); c.fill();
              c.globalAlpha = 1;
              if (b - a > 34) {
                c.font = '10.5px system-ui, sans-serif'; c.textBaseline = 'middle'; c.fillStyle = th.text;
                c.fillText(ellipsize(c, nm(l), b - a - 6), a + 3, ry + LEADER_H / 2 + 0.5);
              }
              newHits.push({ x: (a + b) / 2, y: ry - off + LEADER_H / 2, r: Math.max(6, (b - a) / 2), pick: { type: 'leader', q: l.q, of: l.of, s: l.s }, tip: `${P.name(l)} · ${P.name(P.history.offices[l.of]!)} · ${fspan(l.s, l.e, l.open)}` });
            }
          }
        }
        // wars: a line over their span, a tick per battle fought here
        for (const w of ix.warsBy.get(lane.key) ?? []) {
          const x0 = X(w.s), x1 = Math.max(X(w.e), x0 + 3);
          if (x1 < GUTTER || x0 > GUTTER + tw) continue;
          const wy = lane.warY + off;
          c.strokeStyle = hsl(country.h, th.l, 62, 0.9); c.lineWidth = 3; c.lineCap = 'round';
          c.beginPath(); c.moveTo(Math.max(GUTTER, x0), wy); c.lineTo(Math.min(GUTTER + tw, x1), wy); c.stroke();
          c.fillStyle = th.text;
          for (const b of w.b) {
            if (b.c !== lane.key) continue;
            const bx = X(b.y + 0.5);
            if (bx < GUTTER || bx > GUTTER + tw) continue;
            c.fillRect(bx - 0.5, wy - 4, 1, 8);
          }
          newHits.push({ x: Math.max(GUTTER + 6, Math.min(x0, GUTTER + tw - 6)), y: lane.warY, r: 9, pick: { type: 'war', id: w.id }, tip: `${P.name(w)} · ${fspan(w.s, w.e)} · ${w.b.length}` });
          if (level !== 'density' && x1 - x0 > 60) {
            c.font = '600 11px system-ui, sans-serif'; c.textBaseline = 'bottom'; c.fillStyle = th.text;
            c.fillText(ellipsize(c, nm(w), x1 - Math.max(GUTTER, x0)), Math.max(GUTTER + 2, x0), wy - 4);
          }
        }
      }
      if (!lane.hasEvents) return;
      const list = ix.byLane.get(lane.key) ?? [];
      const ey = lane.evY + off;
      if (level === 'density') {
        // one stacked bar per bucket (a decade when zoomed in, up to centuries when zoomed out), height in log of the count
        const B = bucketYears(tw / span(v));
        const per = new Map<number, Map<Kind, number>>();
        for (const e of list) {
          if (e.y < v.y0 - B || e.y > v.y1 + B) continue;
          const d = Math.floor(e.y / B) * B;
          let m = per.get(d);
          if (!m) per.set(d, (m = new Map()));
          m.set(e.k, (m.get(e.k) ?? 0) + 1);
        }
        const bw = Math.max(1, X(B) - X(0) - 1);
        for (const [d, m] of per) {
          const id = `d:${lane.key}:${B}:${d}`;
          visibleIds.push(id);
          const look = arrivals.look(id, t);
          let n = 0; for (const k of m.values()) n += k;
          const full = Math.min(lane.evH, 4 + 4.4 * Math.log2(1 + n));
          let yy = ey + lane.evH;
          const x = X(d);
          for (const [k, cnt] of [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
            const h = (full * cnt / n) * look.scale;
            yy -= h;
            c.globalAlpha = look.alpha;
            c.fillStyle = kindColor(k, th.l);
            c.fillRect(x, yy, bw, h);
          }
          c.globalAlpha = 1;
          newHits.push({ x: x + bw / 2, y: lane.evY + lane.evH / 2, r: Math.max(8, bw / 2), pick: { type: 'decade', key: lane.key, decade: d, size: B }, tip: `${fspan(d, d + B - 1)} · ${n}` });
        }
        return;
      }
      // dots, and names where they fit
      const rows = lane.evRows;
      const rowH = lane.evH / rows;
      const pxPerYear = tw / span(v);
      const cands: Array<{ id: string; x: number; width: number; prio: number }> = [];
      const drawn: Array<{ e: Ev; x: number; y: number }> = [];
      for (const e of list) {
        if (e.y < v.y0 - 1 || e.y > v.y1 + 1) continue;
        // spread a year's events across its own width, deterministically
        const jitter = ((rowOf(e.q + 'x', 97) / 97) * 0.8 + 0.1);
        const x = X(e.y + jitter);
        if (x < GUTTER - 4 || x > GUTTER + tw + 4) continue;
        const row = rowOf(e.q, rows);
        const y = ey + rowH * (row + 0.5);
        drawn.push({ e, x, y });
        if (level === 'labels') {
          const key = P.name(e);
          let w = textWidth.current.get(key);
          if (w === undefined) { c.font = '11px system-ui, sans-serif'; w = c.measureText(key).width; textWidth.current.set(key, w); }
          cands.push({ id: e.q, x: x + 6, width: Math.min(w, 220), prio: e.sl });
        }
      }
      const placed = level === 'labels' ? placeLabels(cands, rows, GUTTER + tw) : [];
      const labelRow = new Map(placed.map((pl) => [pl.id, pl.row]));
      const r0 = level === 'labels' ? 4 : Math.min(3.2, Math.max(1.8, pxPerYear / 5));
      for (const { e, x } of drawn) {
        visibleIds.push(e.q);
        const look = arrivals.look(e.q, t);
        const lr = labelRow.get(e.q);
        const yy = lr !== undefined ? ey + rowH * (lr + 0.5) : ey + rowH * (rowOf(e.q, rows) + 0.5);
        const color = kindColor(e.k, th.l);
        c.globalAlpha = look.alpha;
        drawDot(c, x, yy, r0 * look.scale, color, !!e.a);
        if (lr !== undefined) {
          c.font = '11px system-ui, sans-serif'; c.textBaseline = 'middle';
          c.fillStyle = th.text;
          c.fillText(ellipsize(c, nm(e), 220), x + 6, yy);
        }
        c.globalAlpha = 1;
        placedPos.set(e.q, { x, y: yy - off, r: r0, color, hollow: !!e.a });
        newHits.push({ x, y: yy - off, r: Math.max(6, r0 + 3), pick: { type: 'event', q: e.q }, tip: `${P.name(e)} · ${fey(e)}${e.sub ? ' · ' + e.sub : ''}` });
      }
    }

    function band(c: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: string, alpha: number, label: string, dashed: boolean, pick: Picked, tipText: string) {
      const a = Math.max(GUTTER, x0), b = Math.min(GUTTER + tw, x1);
      if (b < a) return;
      c.globalAlpha = alpha;
      c.fillStyle = color;
      roundRect(c, a, y, Math.max(3, b - a), BAND_H, 6); c.fill();
      c.globalAlpha = 1;
      if (dashed) { c.setLineDash([3, 3]); c.strokeStyle = color; c.lineWidth = 1; roundRect(c, a, y, Math.max(3, b - a), BAND_H, 6); c.stroke(); c.setLineDash([]); }
      if (b - a > 40) {
        c.font = '11px system-ui, sans-serif'; c.textBaseline = 'middle';
        c.fillStyle = dashed ? th.text : th.onAccent;
        c.fillText(ellipsize(c, label, b - a - 10), a + 6, y + BAND_H / 2 + 0.5);
      }
      newHits.push({ x: (a + b) / 2, y: y + top + BAND_H / 2, r: Math.max(8, (b - a) / 2), pick, tip: tipText });
    }
  }, [arrivals]);

  const contentHRef = useRef(400);
  const posRef = useRef(new Map<string, { x: number; y: number; r: number; color: string; hollow: boolean }>());

  // ---- the loop -------------------------------------------------------------------------
  useEffect(() => {
    const scene = p.scene;
    let raf = 0;
    let last = performance.now();
    // the cursor at the last frame, not at this frame's start: in a window whose play clock runs
    // elsewhere (the exploded view), the cursor moves BETWEEN frames and nothing would be lit
    let prev = scene.cursor;
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const before = prev;
      const moving = scene.step(dt);
      // the play cursor lights what it passes; a jump (a click far away) lights nothing
      const after = scene.cursor;
      if (scene.playing && after > before && after - before < 30) {
        const passed = crossed(indexRef.current.ignitable, before, after).slice(0, SPARKS_PER_FRAME);
        if (passed.length) {
          const qs: string[] = [];
          for (const e of passed) {
            const at = posRef.current.get(e.q);
            if (at && !props.current.reduceMotion) ripples.current.push({ x: at.x, y: at.y, hue: KIND_HUE[e.k], born: now, map: false });
            qs.push(e.q);
          }
          scene.addSparks(qs, now);
        }
      }
      prev = after;
      draw(now);
      if (moving || arrivals.busy(now) || ripples.current.length) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const off = scene.onWake(wake);
    wake();
    return () => { off(); if (raf) cancelAnimationFrame(raf); };
  }, [p.scene, draw, arrivals]);

  // A change of data, selection or theme is one more frame (and a wave for newcomers).
  useEffect(() => { p.scene.wake(); }, [index, p.theme, p.name, p.scene]);

  // resize
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => p.scene.wake());
    ro.observe(el);
    return () => ro.disconnect();
  }, [p.scene]);

  // ---- gestures -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current, ruler = rulerRef.current, sc = scrollRef.current;
    if (!canvas || !ruler || !sc) return;
    const scene = p.scene;
    const yearAt = (clientX: number) => {
      const r = canvas.getBoundingClientRect();
      return xToYear(scene.view, scene.width, clientX - r.left - GUTTER);
    };
    // the cursor never moves on screen: every drag moves the timeline under it
    let drag: null | { x: number; y: number; view: View; scroll: number; moved: number; samples: Array<[number, number]> } = null;

    const down = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      drag = { x: ev.clientX, y: ev.clientY, view: scene.view, scroll: sc.scrollTop, moved: 0, samples: [[performance.now(), ev.clientX]] };
      scene.velocity = 0;
      canvas.setPointerCapture(ev.pointerId);
    };
    const move = (ev: PointerEvent) => {
      if (!drag) { hover(ev); return; }
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      scene.dragTo(panBy(drag.view, -dx * span(drag.view) / scene.width));
      sc.scrollTop = drag.scroll - dy;
      drag.samples.push([performance.now(), ev.clientX]);
      if (drag.samples.length > 6) drag.samples.shift();
    };
    const up = (ev: PointerEvent) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
      if (d.moved < 4) { click(ev); return; }
      if (!props.current.reduceMotion) {
        const [t0, x0] = d.samples[0]!, [t1, x1] = d.samples[d.samples.length - 1]!;
        const dt = (t1 - t0) / 1000;
        if (dt > 0 && performance.now() - t1 < 80) scene.fling(-((x1 - x0) / dt) * span(scene.view) / scene.width);
      }
    };
    const hit = (ev: MouseEvent): Hit | null => {
      const r = canvas.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top + sc.scrollTop;
      let best: Hit | null = null, bd = Infinity;
      for (const h of hits.current) {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d <= h.r && d < bd) { best = h; bd = d; }
      }
      return best;
    };
    // a click on empty space brings that year under the cursor
    const click = (ev: MouseEvent) => {
      const h = hit(ev);
      if (h) props.current.onPick(h.pick);
      else { scene.setLoop(null); scene.goTo(yearAt(ev.clientX), props.current.reduceMotion); }
    };
    const hover = (ev: PointerEvent) => {
      const h = hit(ev);
      const r = canvas.getBoundingClientRect();
      setTip(h ? { x: ev.clientX - r.left, y: ev.clientY - r.top, text: h.tip } : null);
      canvas.style.cursor = h ? 'pointer' : 'grab';
    };
    const wheel = (ev: WheelEvent) => {
      // Ctrl (⌘) + wheel belongs to the board: untouched, the shell turns it into a zoom of the
      // canvas. Taken here, a board filled with MnemoClio's windows left no way to zoom out
      // (field, 08/10: « otherwise we can be stuck »). A trackpad pinch arrives the same way.
      if (ev.ctrlKey || ev.metaKey) return;
      ev.preventDefault();
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) { scene.setTarget(panBy(scene.target, ev.deltaX * span(scene.target) / scene.width)); return; }
      if (ev.shiftKey) { sc.scrollTop += ev.deltaY; return; }
      const factor = Math.exp(ev.deltaY * 0.0016);
      // zoom around the fixed cursor: the year it shows does not change
      scene.setTarget(zoomAt(scene.target, (scene.target.y0 + scene.target.y1) / 2, factor), props.current.reduceMotion);
    };
    const dbl = (ev: MouseEvent) => { if (!hit(ev)) scene.setTarget(centreOn(yearAt(ev.clientX), span(scene.target) * 0.35), props.current.reduceMotion); };
    const leave = () => setTip(null);
    // the ruler: a press brings that year under the cursor, a drag moves the timeline like the canvas
    const rulerDown = (ev: PointerEvent) => {
      const x0 = ev.clientX, view0 = scene.view;
      let moved = false;
      scene.velocity = 0;
      const mv = (e: PointerEvent) => {
        if (Math.abs(e.clientX - x0) > 3) moved = true;
        if (moved) scene.dragTo(panBy(view0, -(e.clientX - x0) * span(view0) / scene.width));
      };
      const end = (e: PointerEvent) => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', end);
        if (!moved) { scene.setLoop(null); scene.goTo(yearAt(e.clientX), props.current.reduceMotion); }
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', end);
    };
    const scroll = () => scene.wake();
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('dblclick', dbl);
    canvas.addEventListener('pointerleave', leave);
    ruler.addEventListener('pointerdown', rulerDown);
    sc.addEventListener('scroll', scroll);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('dblclick', dbl);
      canvas.removeEventListener('pointerleave', leave);
      ruler.removeEventListener('pointerdown', rulerDown);
      sc.removeEventListener('scroll', scroll);
    };
  }, [p.scene]);

  return (
    <div ref={wrapRef} className="clio-timeline">
      <canvas ref={rulerRef} className="clio-ruler" aria-hidden="true" />
      <div ref={scrollRef} className="clio-lanes-scroll">
        <div style={{ height: contentH, position: 'relative' }}>
          <canvas ref={canvasRef} className="clio-lanes" tabIndex={0} aria-label="timeline" />
        </div>
      </div>
      {tip && <div className="clio-tip" style={{ left: Math.min(tip.x + 14, (wrapRef.current?.clientWidth ?? 600) - 260), top: tip.y + RULER_H + 14 }}>{tip.text}</div>}
    </div>
  );
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function ellipsize(c: CanvasRenderingContext2D, s: string, max: number): string {
  if (c.measureText(s).width <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (c.measureText(s.slice(0, mid) + '…').width <= max) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? s.slice(0, lo) + '…' : '';
}
