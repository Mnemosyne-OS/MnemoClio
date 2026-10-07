/**
 * mapCam.ts — the map's camera, and the gestures that move it by hand.
 *
 * A camera is a window in degrees: longitudes a..b, latitudes c..d. Pure functions: the map
 * component keeps the projection of its last frame and asks these where to go.
 */

export interface Cam { a: number; b: number; c: number; d: number }

export const WORLD: Cam = { a: -170, b: 180, c: -56, d: 78 };
/** Closest: about 4 degrees across (a region). Farthest: the whole world. */
const MIN_W = 4;
const MAX_W = 380;

/** Keep the window a sensible size and over the Earth. */
export function clampCam(c: Cam): Cam {
  const w = Math.min(MAX_W, Math.max(MIN_W, c.b - c.a));
  const h = Math.min(170, Math.max(MIN_W * 0.6, c.d - c.c));
  const mx = Math.min(200, Math.max(-200, (c.a + c.b) / 2));
  const my = Math.min(80, Math.max(-60, (c.c + c.d) / 2));
  return { a: mx - w / 2, b: mx + w / 2, c: my - h / 2, d: my + h / 2 };
}

/** Zoom by `factor` (< 1 zooms in) keeping the point under the pointer where it is. */
export function zoomCam(c: Cam, lon: number, lat: number, factor: number): Cam {
  const w = c.b - c.a, h = c.d - c.c;
  const nw = Math.min(MAX_W, Math.max(MIN_W, w * factor));
  const k = nw / w;
  const tx = (lon - c.a) / w, ty = (c.d - lat) / h;
  const a = lon - tx * nw;
  const d = lat + ty * h * k;
  return clampCam({ a, b: a + nw, c: d - h * k, d });
}

/** Slide by degrees (a drag to the right moves the map right, so the window moves left). */
export const panCam = (c: Cam, dLon: number, dLat: number): Cam => clampCam({ a: c.a - dLon, b: c.b - dLon, c: c.c + dLat, d: c.d + dLat });

/** The projection of a frame: degrees to pixels and back (equirectangular, longitudes x cos of the mid latitude). */
export interface Projection { a: number; d: number; kx: number; s: number }
export const toLon = (p: Projection, x: number): number => p.a + x / (p.kx * p.s);
export const toLat = (p: Projection, y: number): number => p.d - y / p.s;
