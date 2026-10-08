import { describe, expect, it } from 'vitest';
import { dragDegrees, globeOf, project, turnCam, wrapLon } from './globe';
import { WORLD } from './mapCam';

const g = { lon0: 0, lat0: 0, r: 100, cx: 200, cy: 150 };

describe('globe', () => {
  it('the point facing the person is the centre of the disc', () => {
    expect(project(g, 0, 0)).toEqual({ x: 200, y: 150, front: true });
  });

  it('north is up, east is right', () => {
    expect(project(g, 0, 90).y).toBeCloseTo(50, 6);
    expect(project(g, 90, 0).x).toBeCloseTo(300, 6);
  });

  it('the far side is hidden and pushed to the rim, never drawn across the disc', () => {
    const p = project(g, 170, 10);
    expect(p.front).toBe(false);
    expect(Math.hypot(p.x - 200, p.y - 150)).toBeCloseTo(100, 6);
  });

  it('the camera turns it: its centre faces the person, its width is the zoom', () => {
    const w = globeOf(WORLD, 800, 600);
    expect(w.r).toBeCloseTo(276, 6);
    const paris = globeOf({ a: -8, b: 22, c: 35, d: 60 }, 800, 600);
    expect(paris.lon0).toBe(7);
    expect(paris.r).toBeCloseTo(276 * 6, 6);
    expect(project(paris, 7, 47.5)).toEqual({ x: 400, y: 300, front: true });
  });

  it('a turn past the date line wraps', () => {
    expect(wrapLon(190)).toBe(-170);
    expect(wrapLon(-190)).toBe(170);
    expect(globeOf({ a: 170, b: 210, c: 0, d: 10 }, 400, 400).lon0).toBe(-170);
  });

  it('a drag of one radius turns the globe by one radian', () => {
    expect(dragDegrees(g, 100, 0).dLon).toBeCloseTo(180 / Math.PI, 6);
  });

  it('a globe turns round and round: past the date line its centre comes back into [-180, 180)', () => {
    let c = { a: 160, b: 200, c: 0, d: 20 };
    for (let i = 0; i < 10; i++) c = turnCam(c, -30, 0);
    const mx = (c.a + c.b) / 2;
    expect(mx).toBeGreaterThanOrEqual(-180);
    expect(mx).toBeLessThan(180);
    expect(((mx - 180 - 300) % 360 + 360) % 360).toBeCloseTo(0, 6);
  });
});
