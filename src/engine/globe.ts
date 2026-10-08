/**
 * globe.ts — the map as a globe (orthographic projection), turned by the same camera.
 *
 * Field, 07/10: "a rotating world map view". The camera stays the flat map's window in degrees
 * (mapCam.ts): its centre is the point of the globe facing the person, its width the zoom. So
 * the globe turns toward the places of the cursor's year exactly as the flat map glides to them,
 * and a drag turns it. Nothing turns by itself (doc 59 §6.10: a motion nobody started is a
 * nuisance).
 */
import { clampCam, type Cam } from './mapCam';

const RAD = Math.PI / 180;

export interface Globe { lon0: number; lat0: number; r: number; cx: number; cy: number }

/** Wrap a longitude into [-180, 180). */
export const wrapLon = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;

/** The globe a camera shows in a W x H frame: the whole disc at the world view, closer as the window narrows. */
export function globeOf(cam: Cam, W: number, H: number): Globe {
  const base = Math.min(W, H) * 0.46;
  const zoom = Math.min(14, Math.max(1, 180 / Math.max(1, cam.b - cam.a)));
  return { lon0: wrapLon((cam.a + cam.b) / 2), lat0: Math.max(-80, Math.min(80, (cam.c + cam.d) / 2)), r: base * zoom, cx: W / 2, cy: H / 2 };
}

export interface Pt { x: number; y: number; front: boolean }

/**
 * A place on the screen. A place on the far side is pushed to the rim (`front: false`), so a
 * country cut by the horizon is filled up to the edge of the disc instead of across it.
 */
export function project(g: Globe, lon: number, lat: number): Pt {
  const l = (lon - g.lon0) * RAD, p = lat * RAD, p0 = g.lat0 * RAD;
  const cosp = Math.cos(p);
  const x = cosp * Math.sin(l);
  const y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * cosp * Math.cos(l);
  const front = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * cosp * Math.cos(l) >= 0;
  if (front) return { x: g.cx + g.r * x, y: g.cy - g.r * y, front };
  const n = Math.hypot(x, y) || 1;
  return { x: g.cx + (g.r * x) / n, y: g.cy - (g.r * y) / n, front };
}

/** Degrees to turn the globe for a drag of dx, dy pixels (to the right shows what was on the left). */
export const dragDegrees = (g: Globe, dx: number, dy: number): { dLon: number; dLat: number } => ({ dLon: dx / g.r / RAD, dLat: dy / g.r / RAD });

/**
 * Turn the globe: the drag, then the centre brought back into [-180, 180) so the globe can
 * turn round and round (the flat map stops at the date line, a globe has none).
 */
export function turnCam(c: Cam, dLon: number, dLat: number): Cam {
  // wrapped BEFORE the clamp: the flat clamp stops the centre at 200 degrees and would eat the turn
  const a = c.a - dLon, b = c.b - dLon;
  const k = Math.round((a + b) / 2 / 360) * 360;
  return clampCam({ a: a - k, b: b - k, c: c.c + dLat, d: c.d + dLat });
}
