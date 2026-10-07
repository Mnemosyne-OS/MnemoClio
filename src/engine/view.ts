/**
 * view.ts — the window of years the timeline shows, and every way a gesture moves it.
 *
 * A view is two years, [y0, y1]. Pixels are derived from it, never stored, so a resize can
 * never leave the timeline pointing at the wrong year. Pure functions only: the canvas
 * component owns the animation loop, these say where it should go.
 */

export interface View { y0: number; y1: number }

/** The timeline's outer edges: from 3600 BC (the first cities and writing) to a little past 2025. */
export const BOUNDS = { min: -3600, max: 2035 } as const;
/** Closest zoom: a few years across the screen. Farthest: the whole range. */
export const MIN_SPAN = 4;
export const MAX_SPAN = BOUNDS.max - BOUNDS.min;

export const span = (v: View): number => v.y1 - v.y0;

export const yearToX = (v: View, width: number, year: number): number => ((year - v.y0) / span(v)) * width;
export const xToYear = (v: View, width: number, x: number): number => v.y0 + (x / width) * span(v);

/** Keep the span inside its limits, then slide the window back inside the bounds. */
export function clampView(v: View): View {
  const s = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span(v)));
  const mid = (v.y0 + v.y1) / 2;
  let y0 = mid - s / 2;
  if (y0 < BOUNDS.min) y0 = BOUNDS.min;
  if (y0 + s > BOUNDS.max) y0 = BOUNDS.max - s;
  return { y0, y1: y0 + s };
}

/** Zoom by `factor` (< 1 zooms in) keeping `anchor` where it is on screen: the year under the pointer stays under the pointer. */
export function zoomAt(v: View, anchor: number, factor: number): View {
  const s = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span(v) * factor));
  const t = (anchor - v.y0) / span(v);
  return clampView({ y0: anchor - t * s, y1: anchor - t * s + s });
}

/** Slide by a number of years (positive = later). */
export const panBy = (v: View, years: number): View => clampView({ y0: v.y0 + years, y1: v.y1 + years });

/** A window of `s` years centred on `year`. */
export const centreOn = (year: number, s: number): View => clampView({ y0: year - s / 2, y1: year + s / 2 });

/**
 * One frame of glide after a fling: the velocity (years per second) decays exponentially,
 * so the glide length does not depend on the frame rate. Returns the next view and velocity;
 * a velocity under `stop` is zero, so a glide always ends.
 */
export function glide(v: View, velocity: number, dtSeconds: number, friction = 4.2, stop = 0.02): { view: View; velocity: number } {
  const decay = Math.exp(-friction * dtSeconds);
  const next = velocity * decay;
  // Distance travelled during the frame = integral of the decaying velocity.
  const moved = friction > 0 ? (velocity - next) / friction : velocity * dtSeconds;
  const view = panBy(v, moved);
  const hitEdge = view.y0 === v.y0 && moved !== 0;
  // `stop` is a share of the visible span per second, so a glide ends at the same visual speed at every zoom.
  return { view, velocity: Math.abs(next) < stop * span(v) || hitEdge ? 0 : next };
}

/** Ease a view toward a target: one step of a critically-damped approach (exponential smoothing on both edges). */
export function approach(current: View, target: View, dtSeconds: number, rate = 9): View {
  const k = 1 - Math.exp(-rate * dtSeconds);
  return { y0: current.y0 + (target.y0 - current.y0) * k, y1: current.y1 + (target.y1 - current.y1) * k };
}

/** Close enough to stop animating: under half a pixel on both edges. */
export function settled(a: View, b: View, width: number): boolean {
  const px = span(a) / Math.max(1, width);
  return Math.abs(a.y0 - b.y0) < px * 0.5 && Math.abs(a.y1 - b.y1) < px * 0.5;
}

/**
 * What the timeline draws at this zoom. It depends on pixels per year, not on the span alone:
 * the same 100 years are a density on a phone and individual dots on a wide screen.
 *  - `density`: one bar per decade per lane (a decade under 40 px);
 *  - `dots`: every event a dot (a year under 18 px);
 *  - `labels`: dots, and names where they fit.
 */
export type Level = 'density' | 'dots' | 'labels';
export function levelOf(v: View, width: number): Level {
  const pxPerYear = width / span(v);
  if (pxPerYear < 4) return 'density';
  if (pxPerYear < 18) return 'dots';
  return 'labels';
}

/** Ticks for the ruler: a step that leaves at least `minPx` between two labels. */
export function tickStep(v: View, width: number, minPx = 70): number {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const pxPerYear = width / span(v);
  return steps.find((s) => s * pxPerYear >= minPx) ?? 1000;
}
