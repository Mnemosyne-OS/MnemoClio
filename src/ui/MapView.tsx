/**
 * MapView.tsx — the map that follows the timeline's cursor.
 *
 * The camera glides to frame the places of the years around the cursor (the shown countries
 * when there are none), the dots of those years grow in and fade out as the cursor moves, and
 * an event the play cursor passes rings once where it happened. The borders are today's
 * (Natural Earth) or, after the person's consent, the era's (downloaded, never shipped).
 * The camera moves only because the cursor moved: a still cursor is a still map.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Country, Ev, Named, War, WorldCountry } from '../data/types';
import { EMPIRE, polityNameIndex, type EraShape } from '../data/era';
import { Arrivals, rippleProgress, type Ripple } from '../engine/arrival';
import { KIND_HUE, hsl, kindColor } from '../engine/palette';
import type { Picked, Scene } from '../engine/scene';
import type { Theme } from '../engine/theme';
import { span as viewSpan } from '../engine/view';
import { fey, fy } from '../engine/years';
import { drawDot } from '../engine/dot';
import { WORLD, panCam, toLat, toLon, zoomCam, type Cam, type Projection } from '../engine/mapCam';

/** Years on each side of the cursor whose places are on the map: 6 when zoomed in, up to 80 when the timeline shows millennia. */
export const windowFor = (spanYears: number): number => Math.round(Math.min(80, Math.max(6, spanYears * 0.015)));
const MAX_DOTS = 320;

export interface MapProps {
  world: WorldCountry[] | null;
  era: EraShape[] | null;
  eraYear: number | null;
  events: Ev[];
  wars: War[];
  shown: string[];
  countries: Country[];
  name: (x: Named) => string;
  theme: Theme;
  scene: Scene;
  reduceMotion: boolean;
  stamp: string;
  /** Label of the button that gives the camera back to the cursor once the person moved it. */
  followLabel: string;
  onPick: (p: Picked) => void;
}

interface Shape { r: { pts: number[]; bb: [number, number, number, number] }[]; owner: string | null; home: boolean; label: string; lx: number; ly: number; big: number }

export function MapView(p: MapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const props = useRef(p);
  props.current = p;
  const arrivals = useMemo(() => new Arrivals({ stagger: 8, maxDelay: 360, grow: 520, fade: 380, reduce: false }), []);
  useEffect(() => { arrivals.setReduce(p.reduceMotion); }, [arrivals, p.reduceMotion]);

  // Shapes to draw, with their owner among the shown countries (tint) and their label.
  const shapes = useMemo<Shape[]>(() => {
    const shown = new Set(p.shown);
    if (p.era) {
      // today's land under a point, boxes first (300 polities x 1 000 rings would otherwise test every ring)
      const ne = (p.world ?? []).map((c) => ({ w: c.w, rings: c.r.map((pts) => ({ pts, bb: bbOf(pts) })) }));
      const neAt = (x: number, y: number) => {
        for (const c of ne) for (const ring of c.rings) {
          if (x < ring.bb[0] || x > ring.bb[1] || y < ring.bb[2] || y > ring.bb[3]) continue;
          if (inRing(x, y, ring.pts)) return c.w;
        }
        return null;
      };
      // ended states on the timeline, by the names the era maps use, and only on a map dated within their life
      const byName = polityNameIndex(p.countries, p.shown, p.eraYear);
      return p.era.map((s) => {
        let owner: string | null = byName.get(s.subj.toLowerCase()) ?? null;
        let home = owner ? byName.get(s.n.toLowerCase()) === owner || s.n === s.subj : true;
        if (!owner) for (const id of p.shown) {
          const e = EMPIRE[id];
          if (e?.includes(s.subj)) { owner = id; home = e.includes(s.n); break; }
        }
        let big = 0, bi = 0;
        s.bb.forEach((bb, i) => { const a = (bb[1] - bb[0]) * (bb[3] - bb[2]); if (a > big) { big = a; bi = i; } });
        const bb = s.bb[bi]!;
        const lx = (bb[0] + bb[1]) / 2, ly = (bb[2] + bb[3]) / 2;
        // No hand-made list for this country: the polities lying on its land today take its colour.
        if (!owner) { const w = neAt(lx, ly); if (w && shown.has(w) && !EMPIRE[w]) owner = w; }
        return { r: s.r.map((pts, i) => ({ pts, bb: s.bb[i]! })), owner, home, label: s.n, lx, ly, big: Math.sqrt(big) };
      });
    }
    return (p.world ?? []).map((c) => {
      const r = c.r.map((pts) => ({ pts, bb: bbOf(pts) }));
      const big = Math.max(0, ...r.map((x) => Math.max(x.bb[1] - x.bb[0], x.bb[3] - x.bb[2])));
      const country = p.countries.find((k) => k.id === c.w);
      return { r, owner: shown.has(c.w) ? c.w : null, home: true, label: country ? p.name(country) : c.n, lx: c.l[0], ly: c.l[1], big };
    });
  }, [p.era, p.eraYear, p.world, p.shown, p.countries, p.name]);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  const cam = useRef<Cam>(WORLD);
  // The camera follows the cursor until the person moves the map by hand; then it stays where
  // they put it, and a button gives it back to the cursor.
  const [follow, setFollow] = useState(true);
  const followRef = useRef(true);
  const proj = useRef<Projection>({ a: WORLD.a, d: WORLD.d, kx: 1, s: 1 });
  const takeOver = () => { if (followRef.current) { followRef.current = false; setFollow(false); } };
  const camTarget = useRef<Cam>(cam.current);
  const ripples = useRef<Ripple[]>([]);
  const hits = useRef<Array<{ x: number; y: number; r: number; pick: Picked; tip: string }>>([]);
  const lastDecade = useRef<number | null>(null);

  // The camera's target: the places around the cursor, else the shown countries.
  const aim = () => {
    const P = props.current;
    const y = P.scene.cursor;
    const WINDOW = windowFor(viewSpan(P.scene.view));
    const pts: Array<[number, number]> = [];
    for (const e of P.events) if (e.lon !== null && e.lat !== null && Math.abs(e.y - y) <= WINDOW) pts.push([e.lon, e.lat!]);
    for (const w of P.wars) if (w.s <= y + WINDOW && w.e >= y - WINDOW) for (const b of w.b) if (b.lon !== null && b.lat !== null && P.shown.includes(b.c) && Math.abs(b.y - y) <= WINDOW) pts.push([b.lon, b.lat]);
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    if (pts.length >= 3) {
      // the middle 90 % of the places, so one far-away point does not shrink everything else
      const xs = pts.map((q) => q[0]).sort((m, n) => m - n), ys = pts.map((q) => q[1]).sort((m, n) => m - n);
      const k = Math.floor(pts.length * 0.05);
      a = xs[k]!; b = xs[xs.length - 1 - k]!; c = ys[k]!; d = ys[ys.length - 1 - k]!;
    } else {
      for (const s of shapesRef.current) if (s.owner) for (const r of s.r) { a = Math.min(a, r.bb[0]); b = Math.max(b, r.bb[1]); c = Math.min(c, r.bb[2]); d = Math.max(d, r.bb[3]); }
    }
    if (!Number.isFinite(a)) { a = -170; b = 180; c = -56; d = 78; }
    const pad = Math.max(6, (b - a) * 0.18, (d - c) * 0.18);
    camTarget.current = { a: Math.max(-180, a - pad), b: Math.min(190, b + pad), c: Math.max(-60, c - pad), d: Math.min(84, d + pad) };
  };

  useEffect(() => {
    const scene = p.scene;
    let raf = 0;
    let last = performance.now();
    let seenSparks = scene.sparks[0]?.at ?? 0;
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const P = props.current;
      // re-aim when the cursor enters another year
      const yr = Math.floor(P.scene.cursor);
      if (yr !== lastDecade.current) { lastDecade.current = yr; if (followRef.current) aim(); }
      // new sparks from the timeline ring here too
      for (const s of scene.sparks) {
        if (s.at <= seenSparks) break;
        const e = P.events.find((x) => x.q === s.q);
        if (e && e.lon !== null && e.lat !== null && !P.reduceMotion) ripples.current.push({ x: 0, y: 0, lon: e.lon, lat: e.lat, hue: KIND_HUE[e.k], born: now, map: true });
      }
      seenSparks = scene.sparks[0]?.at ?? seenSparks;
      const k = P.reduceMotion ? 1 : 1 - Math.exp(-5 * dt);
      const t = camTarget.current, c0 = cam.current;
      cam.current = { a: c0.a + (t.a - c0.a) * k, b: c0.b + (t.b - c0.b) * k, c: c0.c + (t.c - c0.c) * k, d: c0.d + (t.d - c0.d) * k };
      const moving = Math.abs(t.a - cam.current.a) + Math.abs(t.b - cam.current.b) + Math.abs(t.c - cam.current.c) + Math.abs(t.d - cam.current.d) > 0.05;
      draw(now);
      if (moving || arrivals.busy(now) || ripples.current.length) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const off = scene.onWake(wake);
    const unsub = scene.subscribe(wake);
    aim();
    wake();
    return () => { off(); unsub(); if (raf) cancelAnimationFrame(raf); };
  }, [p.scene, arrivals]);

  useEffect(() => { if (followRef.current) aim(); p.scene.wake(); }, [shapes, p.events, p.wars, p.theme]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => p.scene.wake());
    ro.observe(el);
    return () => ro.disconnect();
  }, [p.scene]);

  function draw(now: number) {
    const P = props.current;
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = P.theme;
    // equirectangular, longitudes shrunk by cos(mid latitude) so a region keeps its shape;
    // the window is widened to the frame so the map always fills it
    let { a, b, c, d } = cam.current;
    const kx = Math.cos(((c + d) / 2) * Math.PI / 180);
    const s = Math.min(W / ((b - a) * kx), H / (d - c));
    const ox = (W - (b - a) * kx * s) / 2, oy = (H - (d - c) * s) / 2;
    a -= ox / (kx * s); b += ox / (kx * s); c -= oy / s; d += oy / s;
    proj.current = { a, d, kx, s };
    const X = (lon: number) => (lon - a) * kx * s;
    const Y = (lat: number) => (d - lat) * s;
    ctx.fillStyle = th.dark ? '#0b1220' : '#dfe8f3';
    ctx.fillRect(0, 0, W, H);
    const span = b - a;
    const labels: Array<[string, number, number]> = [];
    for (const sh of shapesRef.current) {
      let any = false;
      ctx.beginPath();
      for (const { pts, bb } of sh.r) {
        if (bb[1] < a || bb[0] > b || bb[3] < c || bb[2] > d) continue;
        any = true;
        ctx.moveTo(X(pts[0]!), Y(pts[1]!));
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(X(pts[i]!), Y(pts[i + 1]!));
        ctx.closePath();
      }
      if (!any) continue;
      if (sh.owner) {
        const h = P.countries.find((k) => k.id === sh.owner)?.h ?? 0;
        ctx.fillStyle = hsl(h, th.l, 60, sh.home ? 0.6 : 0.28);
      } else ctx.fillStyle = th.dark ? '#1b2333' : '#f5f2ea';
      ctx.fill();
      ctx.strokeStyle = th.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      if (sh.label && sh.big > span * 0.11 && sh.lx > a && sh.lx < b && sh.ly > c && sh.ly < d) labels.push([sh.label, X(sh.lx), Y(sh.ly)]);
    }
    ctx.font = `${span > 120 ? 9 : 11}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = th.text;
    ctx.globalAlpha = 0.72;
    for (const [t, x, y] of labels) ctx.fillText(t.length > 24 ? t.slice(0, 23) + '…' : t, x, y);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    // the places around the cursor
    const y = P.scene.cursor;
    const WINDOW = windowFor(viewSpan(P.scene.view));
    const near = P.events.filter((e) => e.lon !== null && Math.abs(e.y - y) <= WINDOW).sort((m, n) => n.sl - m.sl).slice(0, MAX_DOTS);
    const battles: Array<{ w: War; lon: number; lat: number; name: string; by: number; c: string }> = [];
    for (const w of P.wars) if (w.s <= y + WINDOW && w.e >= y - WINDOW) for (const bt of w.b) if (bt.lon !== null && bt.lat !== null && Math.abs(bt.y - y) <= WINDOW && P.shown.includes(bt.c)) battles.push({ w, lon: bt.lon, lat: bt.lat, name: P.name(bt), by: bt.y, c: bt.c });
    const battleIds = battles.map((bt) => `b:${bt.w.id}:${bt.by}:${bt.lon}:${bt.lat}`);
    const ids = [...near.map((e) => e.q), ...battleIds];
    arrivals.update(ids.sort((m, n) => m.localeCompare(n)), now);
    const newHits: typeof hits.current = [];
    battles.forEach((bt, i) => {
      const id = battleIds[i]!;
      const look = arrivals.look(id, now);
      const h = P.countries.find((k) => k.id === bt.c)?.h ?? 0;
      // the closer to the cursor's year, the brighter
      const near01 = 1 - Math.min(1, Math.abs(bt.by - y) / WINDOW);
      ctx.globalAlpha = look.alpha * (0.35 + 0.65 * near01);
      ctx.fillStyle = hsl(h, th.l, 58);
      ctx.strokeStyle = th.bg; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(X(bt.lon), Y(bt.lat), 5.5 * look.scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      newHits.push({ x: X(bt.lon), y: Y(bt.lat), r: 8, pick: { type: 'war', id: bt.w.id }, tip: `${bt.name} · ${fy(bt.by)} · ${P.name(bt.w)}` });
    });
    for (const e of near) {
      const look = arrivals.look(e.q, now);
      const near01 = 1 - Math.min(1, Math.abs(e.y - y) / WINDOW);
      ctx.globalAlpha = look.alpha * (0.3 + 0.7 * near01);
      drawDot(ctx, X(e.lon!), Y(e.lat!), (2.2 + 1.6 * near01) * look.scale, kindColor(e.k, th.l), !!e.a);
      newHits.push({ x: X(e.lon!), y: Y(e.lat!), r: 6, pick: { type: 'event', q: e.q }, tip: `${P.name(e)} · ${fey(e)}` });
    }
    ctx.globalAlpha = 1;

    ripples.current = ripples.current.filter((r) => {
      const t = rippleProgress(r, now);
      if (t === null) return false;
      ctx.strokeStyle = hsl(r.hue, th.l, 72, 1 - t);
      ctx.lineWidth = 2.2 * (1 - t) + 0.4;
      ctx.beginPath(); ctx.arc(X(r.lon!), Y(r.lat!), 3 + t * 34, 0, Math.PI * 2); ctx.stroke();
      return true;
    });

    // stamp: which borders these are
    ctx.font = '600 11px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    const sw = ctx.measureText(P.stamp).width + 16;
    ctx.fillStyle = th.panel; ctx.globalAlpha = 0.92;
    ctx.fillRect(8, 8, sw, 22);
    ctx.globalAlpha = 1; ctx.fillStyle = th.text;
    ctx.fillText(P.stamp, 16, 19);
    hits.current = newHits;
  }

  // gestures: drag pans, the wheel zooms around the pointer, a double-click dives in, a still press clicks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const local = (ev: MouseEvent) => { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    const find = (ev: MouseEvent) => {
      const { x, y } = local(ev);
      let best = null as (typeof hits.current)[number] | null, bd = Infinity;
      for (const h of hits.current) { const dd = Math.hypot(h.x - x, h.y - y); if (dd <= h.r && dd < bd) { best = h; bd = dd; } }
      return { best, x, y };
    };
    let drag: { x: number; y: number; moved: number } | null = null;
    const down = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      drag = { x: ev.clientX, y: ev.clientY, moved: 0 };
      canvas.setPointerCapture(ev.pointerId);
    };
    const move = (ev: PointerEvent) => {
      if (drag) {
        const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        drag.moved += Math.hypot(dx, dy);
        drag.x = ev.clientX; drag.y = ev.clientY;
        if (drag.moved < 4) return;
        takeOver();
        const pr = proj.current;
        cam.current = panCam(cam.current, dx / (pr.kx * pr.s), dy / pr.s);
        camTarget.current = cam.current;
        setTip(null);
        canvas.style.cursor = 'grabbing';
        props.current.scene.wake();
        return;
      }
      const { best, x, y } = find(ev);
      setTip(best ? { x, y, text: best.tip } : null);
      canvas.style.cursor = best ? 'pointer' : 'grab';
    };
    const up = (ev: PointerEvent) => {
      if (!drag) return;
      const still = drag.moved < 4;
      drag = null;
      if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
      canvas.style.cursor = 'grab';
      if (still) { const { best } = find(ev); if (best) props.current.onPick(best.pick); }
    };
    const zoom = (ev: MouseEvent, factor: number) => {
      takeOver();
      const { x, y } = local(ev);
      const pr = proj.current;
      camTarget.current = zoomCam(camTarget.current, toLon(pr, x), toLat(pr, y), factor);
      if (props.current.reduceMotion) cam.current = camTarget.current;
      props.current.scene.wake();
    };
    const wheel = (ev: WheelEvent) => { ev.preventDefault(); zoom(ev, Math.exp(ev.deltaY * 0.0018)); };
    const dbl = (ev: MouseEvent) => { if (!find(ev).best) zoom(ev, 0.45); };
    const leave = () => setTip(null);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('dblclick', dbl);
    canvas.addEventListener('pointerleave', leave);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('dblclick', dbl);
      canvas.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <div ref={wrapRef} className="clio-map">
      <canvas ref={canvasRef} aria-label="map" style={{ touchAction: 'none' }} />
      {!follow && (
        <button type="button" className="clio-follow" onClick={() => { followRef.current = true; setFollow(true); aim(); p.scene.wake(); }}>
          ⌖ {p.followLabel}
        </button>
      )}
      {tip && <div className="clio-tip" style={{ left: Math.min(tip.x + 12, (wrapRef.current?.clientWidth ?? 400) - 240), top: tip.y + 12 }}>{tip.text}</div>}
    </div>
  );
}

export function bbOf(pts: number[]): [number, number, number, number] {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { a = Math.min(a, pts[i]!); b = Math.max(b, pts[i]!); c = Math.min(c, pts[i + 1]!); d = Math.max(d, pts[i + 1]!); }
  return [a, b, c, d];
}

/** Ray casting on a flat ring [x0, y0, x1, y1, …]. */
export function inRing(x: number, y: number, p: number[]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i]!, yi = p[i + 1]!, xj = p[j]!, yj = p[j + 1]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
