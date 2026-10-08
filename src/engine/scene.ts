/**
 * scene.ts — the moving state the timeline and the map share, outside React.
 *
 * Sixty times a second is not a React state: the view, its target, the glide velocity, the
 * cursor and the play clock live here, and both canvases read them in their own frame.
 * React hears only what a panel shows (the cursor's whole year, the play state), through
 * `subscribe`, and only when it changes.
 *
 * The cursor is the CENTRE of the view, always (field, 07/10: "lock the date cursor and make
 * the timeline scroll"). Dragging, the wheel, a fling and play all move the view; the year under
 * the fixed cursor follows. The view may run half its width past the first and last years so
 * the centre can reach them.
 *
 * Several windows can share one moment (the exploded view, doc 137 §5vicies). The window where
 * the person last acted OWNS the motion: its changes go out through `onMotion`, and the others
 * take them through `applyPeer`, which never goes out again (the echo guard). Play advances in
 * the owner only (`peerClock` elsewhere), or two clocks drift apart within seconds.
 */
import { CENTRE, approach, centreOn, clampView, glide, panBy, settled, span, type View } from './view';

export type Picked =
  | { type: 'event'; q: string }
  | { type: 'war'; id: string }
  | { type: 'regime'; id: string; c: string }
  | { type: 'period'; id: string }
  | { type: 'decade'; key: string; decade: number; size?: number }
  | { type: 'leader'; q: string; of: number; s: number };

/** Something the play cursor just passed, as the feed shows it. */
export interface Spark { q: string; at: number }

type Listener = () => void;

/** A period play repeats: the cursor runs from `a` to `b`, then starts again at `a`. */
export interface Loop { a: number; b: number }

/** What a window that owns the motion tells the others. */
export interface PeerScene { view: View; playing: boolean; speed: number; loop: Loop | null }

/**
 * The panel follows the year at most this often. A fast drag crosses dozens of years a second,
 * and each one re-filtered 60 000 events in React: the machine "went mad" (field, 07/10).
 * The last year is always delivered, after the gap.
 */
export const YEAR_EMIT_MS = 120;

export class Scene {
  view: View;
  /** Where the view is easing to; equal to `view` when nothing animates. */
  target: View;
  velocity = 0;
  /** The centre of `view`: the year the panel and the map show. Read it, never set it. */
  cursor: number;
  playing = false;
  /** Years per second while playing. */
  speed = 5;
  /** Width of the timeline in px, kept by the timeline. */
  width = 1000;
  sparks: Spark[] = [];
  /** The period play repeats, or null (play runs to the last year and stops). */
  loop: Loop | null = null;
  /** True while another window runs the play clock: play does not advance here, its view arrives. */
  peerClock = false;
  private listeners = new Set<Listener>();
  private motionFns = new Set<Listener>();
  private sparkFns = new Set<(qs: string[]) => void>();
  private applying = false;
  private motionQueued = false;
  private wakers = new Set<Listener>();
  private lastYear: number;
  private lastEmit = -Infinity;
  private pending: ReturnType<typeof setTimeout> | null = null;

  constructor(cursor = 1870, spanYears = 180) {
    this.view = centreOn(cursor, spanYears);
    this.target = this.view;
    this.cursor = (this.view.y0 + this.view.y1) / 2;
    this.lastYear = Math.floor(this.cursor);
  }

  /** React side: called when the whole year, the play state or the sparks change. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  /** Canvas side: called when something needs a frame (a loop that went to sleep wakes up). */
  onWake(fn: Listener): () => void {
    this.wakers.add(fn);
    return () => { this.wakers.delete(fn); };
  }
  wake(): void { for (const fn of this.wakers) fn(); }

  /**
   * Called after a change made in THIS window (a gesture, its own play clock), at most once per
   * task: a drag or a frame of play is one message, not one per field. Never after `applyPeer`.
   */
  onMotion(fn: Listener): () => void {
    this.motionFns.add(fn);
    return () => { this.motionFns.delete(fn); };
  }
  /** Called with the items this window's play cursor just passed (never with merged ones). */
  onSparks(fn: (qs: string[]) => void): () => void {
    this.sparkFns.add(fn);
    return () => { this.sparkFns.delete(fn); };
  }
  private moved(): void {
    if (this.applying || this.motionQueued || !this.motionFns.size) return;
    this.motionQueued = true;
    queueMicrotask(() => { this.motionQueued = false; for (const fn of this.motionFns) fn(); });
  }
  /** A gesture here: this window owns the motion from now on. */
  private own(): void { if (!this.applying) this.peerClock = false; }

  /** The moment as the other windows need it. */
  peerState(): PeerScene { return { view: this.view, playing: this.playing, speed: this.speed, loop: this.loop }; }

  /**
   * Another window's moment, taken as it is: the view at once (a follower easing behind the owner
   * would lag a frame and wobble), play without a clock of its own. Nothing goes out again.
   */
  applyPeer(s: PeerScene, clock: boolean): void {
    this.applying = true;
    try {
      this.view = this.target = clampView(s.view);
      this.velocity = 0;
      this.speed = s.speed;
      this.loop = s.loop;
      this.playing = s.playing;
      this.peerClock = clock && s.playing;
      this.sync();
      this.emit();
      this.wake();
    } finally { this.applying = false; }
  }
  private emit(): void { for (const fn of this.listeners) fn(); }

  /** The cursor follows the view; React hears the new year, at most every YEAR_EMIT_MS. */
  private sync(): void {
    this.cursor = (this.view.y0 + this.view.y1) / 2;
    const whole = Math.floor(this.cursor);
    if (whole === this.lastYear) return;
    this.lastYear = whole;
    const now = performance.now();
    if (now - this.lastEmit >= YEAR_EMIT_MS) { this.lastEmit = now; this.emit(); return; }
    if (this.pending) return;
    this.pending = setTimeout(() => { this.pending = null; this.lastEmit = performance.now(); this.emit(); }, YEAR_EMIT_MS - (now - this.lastEmit));
  }

  /** Stops the trailing year delivery (the component going away). */
  dispose(): void { if (this.pending) { clearTimeout(this.pending); this.pending = null; } }

  setTarget(v: View, immediate = false): void {
    this.own();
    this.target = clampView(v);
    this.velocity = 0;
    if (immediate) { this.view = this.target; this.sync(); }
    this.moved();
    this.wake();
  }

  /** A drag moves the view directly (no easing: it must stay glued to the finger). */
  dragTo(v: View): void {
    this.own();
    this.view = clampView(v);
    this.target = this.view;
    this.sync();
    this.moved();
    this.wake();
  }

  fling(velocityYearsPerSecond: number): void {
    this.own();
    this.velocity = velocityYearsPerSecond;
    this.wake();
  }

  /** Bring `year` under the cursor, keeping the zoom: eased, or at once. */
  goTo(year: number, immediate = false): void {
    this.setTarget(centreOn(year, span(this.target)), immediate);
  }

  /** Put `year` under the cursor at once (keys, tests). */
  setCursor(year: number): void { this.goTo(year, true); }

  setPlaying(on: boolean): void {
    if (on) this.own();
    if (this.playing === on) return;
    this.playing = on;
    // A loop starts at its first year when the cursor stands outside it; without a loop,
    // pressing play at the very end starts again from the first year that was on screen.
    if (on && this.loop && (this.cursor < this.loop.a || this.cursor >= this.loop.b)) this.goTo(this.loop.a, true);
    else if (on && this.cursor >= CENTRE.max - 1) this.goTo(this.view.y0, true);
    this.moved();
    this.emit();
    this.wake();
  }

  setSpeed(yearsPerSecond: number): void { this.speed = yearsPerSecond; this.moved(); this.emit(); }

  /**
   * Repeat a period (field, 07/10: "a play mode on a point or a period, loop, repeat"). Kept
   * inside where the cursor can stand; a period under one year is refused (returns false), never
   * stretched into one nobody asked for. null ends the loop.
   */
  setLoop(l: Loop | null): boolean {
    if (l) {
      const a = Math.max(CENTRE.min, Math.min(l.a, l.b)), b = Math.min(CENTRE.max, Math.max(l.a, l.b));
      if (!(b - a >= 1)) return false;
      this.loop = { a, b };
    } else this.loop = null;
    this.moved();
    this.emit();
    return true;
  }

  addSparks(qs: string[], now: number): void {
    if (!qs.length) return;
    // the same item filed under two subjects arrives twice in one frame: one spark
    this.sparks = [...[...new Set(qs)].map((q) => ({ q, at: now })), ...this.sparks].slice(0, 12);
    this.emit();
    for (const fn of this.sparkFns) fn(qs);
  }

  /** Items another window's cursor passed: the ones not already in the feed, and nothing goes out again. */
  mergeSparks(qs: string[], now: number): void {
    const have = new Set(this.sparks.map((x) => x.q));
    const fresh = [...new Set(qs)].filter((q) => !have.has(q));
    if (!fresh.length) return;
    this.sparks = [...fresh.map((q) => ({ q, at: now })), ...this.sparks].slice(0, 12);
    this.emit();
  }

  /**
   * One frame of motion. Returns true while something still moves, so the caller keeps its loop
   * alive only then: a still timeline draws nothing (doc 37: nothing moves by itself).
   */
  step(dt: number): boolean {
    if (this.playing && !this.peerClock) {
      // the timeline scrolls under the fixed cursor
      this.view = this.target = panBy(this.target, this.speed * dt);
      this.velocity = 0;
      this.sync();
      this.moved();
      // the loop wraps before the last year can stop play (a loop may end at the last year)
      if (this.loop && this.cursor >= this.loop.b) { this.goTo(this.loop.a, true); return true; }
      if (this.cursor >= CENTRE.max - 1e-6) this.setPlaying(false);
      return true;
    }
    let moving = false;
    if (this.velocity !== 0) {
      const g = glide(this.view, this.velocity, dt);
      this.view = g.view;
      this.target = g.view;
      this.velocity = g.velocity;
      moving = true;
    } else if (!settled(this.view, this.target, this.width)) {
      this.view = approach(this.view, this.target, dt);
      moving = true;
    } else {
      this.view = this.target;
    }
    this.sync();
    if (moving) this.moved();
    return moving;
  }
}
