import { describe, expect, it } from 'vitest';
import { BOUNDS, CENTRE, MAX_SPAN, MIN_SPAN, approach, centreOn, clampView, glide, levelOf, panBy, settled, span, tickStep, xToYear, yearToX, zoomAt } from './view';

describe('view', () => {
  const v = { y0: 1800, y1: 1900 };

  it('maps years to pixels and back', () => {
    expect(yearToX(v, 1000, 1850)).toBe(500);
    expect(xToYear(v, 1000, 250)).toBe(1825);
  });

  it('zooms around the year under the pointer: that year stays at the same pixel', () => {
    const z = zoomAt(v, 1820, 0.5);
    expect(span(z)).toBe(50);
    expect(yearToX(z, 1000, 1820)).toBeCloseTo(yearToX(v, 1000, 1820), 6);
  });

  it('never zooms past its limits', () => {
    expect(span(zoomAt(v, 1850, 0.0001))).toBe(MIN_SPAN);
    expect(span(zoomAt(v, 1850, 1e6))).toBe(MAX_SPAN);
  });

  it('keeps the centre (the fixed cursor) between the first year and 2025, the window running past them', () => {
    const left = panBy(v, -100000);
    expect((left.y0 + left.y1) / 2).toBe(CENTRE.min);
    expect(span(left)).toBe(100);
    expect(left.y0).toBeLessThan(BOUNDS.min);
    const right = clampView({ y0: 2030, y1: 2130 });
    expect((right.y0 + right.y1) / 2).toBe(CENTRE.max);
  });

  it('a glide stops at the first year instead of pushing against it', () => {
    const edge = centreOn(CENTRE.min, 100);
    expect(glide(edge, -40, 1 / 60).velocity).toBe(0);
  });

  it('a glide slows down, ends, and travels the same distance whatever the frame rate', () => {
    let a = { view: v, velocity: 60 };
    let b = { view: v, velocity: 60 };
    for (let i = 0; i < 60; i++) a = glide(a.view, a.velocity, 1 / 60);
    for (let i = 0; i < 120; i++) b = glide(b.view, b.velocity, 1 / 120);
    expect(a.view.y0).toBeCloseTo(b.view.y0, 3);
    expect(a.velocity).toBeLessThan(60);
    let c = { view: v, velocity: 60 };
    for (let i = 0; i < 600 && c.velocity !== 0; i++) c = glide(c.view, c.velocity, 1 / 60);
    expect(c.velocity).toBe(0);
  });

  it('easing reaches its target and says when it is settled', () => {
    let c = v;
    const target = centreOn(1700, 50);
    for (let i = 0; i < 200; i++) c = approach(c, target, 1 / 60);
    expect(settled(c, target, 1000)).toBe(true);
    expect(settled(v, target, 1000)).toBe(false);
  });

  it('draws by pixels per year, not by span: the same century is a density on a phone and dots on a wide screen', () => {
    expect(levelOf(v, 300)).toBe('density');
    expect(levelOf(v, 1200)).toBe('dots');
    expect(levelOf({ y0: 1850, y1: 1870 }, 1200)).toBe('labels');
  });

  it('spaces ruler ticks so their labels do not collide', () => {
    expect(tickStep({ y0: 1450, y1: 2025 }, 1000) * (1000 / 575)).toBeGreaterThanOrEqual(70);
    expect(tickStep({ y0: 1860, y1: 1870 }, 1000)).toBe(1);
  });
});
