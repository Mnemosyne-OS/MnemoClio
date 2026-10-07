import { describe, expect, it } from 'vitest';
import { WORLD, clampCam, panCam, toLat, toLon, zoomCam } from './mapCam';

describe('map camera', () => {
  it('zooms around the point under the pointer: that point stays where it is', () => {
    const c = { a: -10, b: 30, c: 35, d: 60 };
    const z = zoomCam(c, 2, 48, 0.5);
    expect(z.b - z.a).toBeCloseTo(20, 6);
    expect((2 - z.a) / (z.b - z.a)).toBeCloseTo((2 - c.a) / (c.b - c.a), 6);
    expect((z.d - 48) / (z.d - z.c)).toBeCloseTo((c.d - 48) / (c.d - c.c), 6);
  });

  it('never zooms closer than a region nor farther than the world', () => {
    const c = { a: -10, b: 30, c: 35, d: 60 };
    expect(zoomCam(c, 0, 45, 0.0001).b - zoomCam(c, 0, 45, 0.0001).a).toBe(4);
    expect(zoomCam(WORLD, 0, 0, 100).b - zoomCam(WORLD, 0, 0, 100).a).toBe(380);
  });

  it('a drag moves the map with the hand', () => {
    const c = { a: 0, b: 20, c: 40, d: 50 };
    const p = panCam(c, 5, 2);
    expect(p.a).toBeCloseTo(-5, 6);
    expect(p.c).toBeCloseTo(42, 6);
  });

  it('cannot be dragged off the Earth', () => {
    const p = clampCam({ a: 500, b: 520, c: 300, d: 310 });
    expect((p.a + p.b) / 2).toBeLessThanOrEqual(200);
    expect((p.c + p.d) / 2).toBeLessThanOrEqual(80);
  });

  it('converts a pixel back to the degrees it shows', () => {
    const proj = { a: -10, d: 60, kx: 0.7, s: 10 };
    expect(toLon(proj, 70)).toBeCloseTo(0, 6);
    expect(toLat(proj, 100)).toBeCloseTo(50, 6);
  });
});
