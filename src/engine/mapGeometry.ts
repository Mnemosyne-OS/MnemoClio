/**
 * mapGeometry.ts — the map's pure geometry, out of the component file (a .tsx that exports both a
 * component and values is a file React Fast Refresh reloads whole, on every save).
 */

/** Years on each side of the cursor whose places are on the map: 6 when zoomed in, up to 80 when the timeline shows millennia. */
export const windowFor = (spanYears: number): number => Math.round(Math.min(80, Math.max(6, spanYears * 0.015)));

/** The box of a flat ring [x0, y0, x1, y1, …]: lon min, lon max, lat min, lat max. */
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
