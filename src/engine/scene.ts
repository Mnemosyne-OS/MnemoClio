/**
 * scene.ts — the moving state the timeline and the map share, outside React.
 *
 * Sixty times a second is not a React state: the view, its target, the glide velocity, the
 * cursor and the play clock live here, and both canvases read them in their own frame.
 * React hears only what a panel shows (the cursor's whole year, the play state), through
 * `subscribe`, and only when it changes.
 */
import { BOUNDS, approach, centreOn, clampView, glide, settled, span, type View } from './view';

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

export class Scene {
  view: View;
  /** Where the view is easing to; equal to `view` when nothing animates. */
  target: View;
  velocity = 0;
  cursor: number;
  playing = false;
  /** Years per second while playing. */
  speed = 5;
  /** Width of the timeline in px, kept by the timeline, read by the follow logic. */
  width = 1000;
  sparks: Spark[] = [];
  private listeners = new Set<Listener>();
  private wakers = new Set<Listener>();
  private lastYear: number;

  constructor(cursor = 1870, spanYears = 180) {
    this.cursor = cursor;
    this.view = centreOn(cursor, spanYears);
    this.target = this.view;
    this.lastYear = Math.floor(cursor);
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
  private emit(): void { for (const fn of this.listeners) fn(); }

  setTarget(v: View, immediate = false): void {
    this.target = clampView(v);
    this.velocity = 0;
    if (immediate) this.view = this.target;
    this.wake();
  }

  /** A drag moves the view directly (no easing: it must stay glued to the finger). */
  dragTo(v: View): void {
    this.view = clampView(v);
    this.target = this.view;
    this.wake();
  }

  fling(velocityYearsPerSecond: number): void {
    this.velocity = velocityYearsPerSecond;
    this.wake();
  }

  setCursor(year: number): void {
    const y = Math.min(BOUNDS.max - 10, Math.max(BOUNDS.min + 10, year));
    this.cursor = y;
    const whole = Math.floor(y);
    if (whole !== this.lastYear) { this.lastYear = whole; this.emit(); }
    this.wake();
  }

  setPlaying(on: boolean): void {
    if (this.playing === on) return;
    this.playing = on;
    // Pressing play at the very end starts again from the first year on screen.
    if (on && this.cursor >= 2024) this.setCursor(Math.max(BOUNDS.min + 10, this.view.y0));
    this.emit();
    this.wake();
  }

  setSpeed(yearsPerSecond: number): void { this.speed = yearsPerSecond; this.emit(); }

  addSparks(qs: string[], now: number): void {
    if (!qs.length) return;
    // the same item filed under two subjects arrives twice in one frame: one spark
    this.sparks = [...[...new Set(qs)].map((q) => ({ q, at: now })), ...this.sparks].slice(0, 12);
    this.emit();
  }

  /**
   * One frame of motion. Returns true while something still moves, so the caller keeps its loop
   * alive only then: a still timeline draws nothing (doc 37: nothing moves by itself).
   */
  step(dt: number): boolean {
    let moving = false;
    if (this.playing) {
      const next = this.cursor + this.speed * dt;
      if (next >= 2025) { this.setCursor(2025); this.setPlaying(false); }
      else this.setCursor(next);
      // Follow: the cursor rides at 62 % of the width, the view easing behind it.
      const s = span(this.target);
      const t = (this.cursor - this.target.y0) / s;
      if (t > 0.62 || t < 0.1) this.target = clampView({ y0: this.cursor - 0.62 * s, y1: this.cursor + 0.38 * s });
      moving = true;
    }
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
    return moving;
  }
}
