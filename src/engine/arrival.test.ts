import { describe, expect, it } from 'vitest';
import { Arrivals, RIPPLE_MS, easeOutBack, rippleProgress } from './arrival';

const opts = { stagger: 10, maxDelay: 50, grow: 100, fade: 40, reduce: false };

describe('arrivals', () => {
  it('newcomers arrive as a wave: each starts after its left neighbour', () => {
    const a = new Arrivals(opts);
    a.update(['a', 'b', 'c'], 0);
    expect(a.look('a', 5).alpha).toBeGreaterThan(0);
    expect(a.look('c', 5).alpha).toBe(0);
    expect(a.look('c', 30).alpha).toBeGreaterThan(0);
  });

  it('a wave never takes longer than maxDelay to start its last member', () => {
    const a = new Arrivals(opts);
    a.update(Array.from({ length: 100 }, (_, i) => 'e' + i), 0);
    expect(a.look('e99', 51).alpha).toBeGreaterThan(0);
  });

  it('what is already there does not arrive again', () => {
    const a = new Arrivals(opts);
    a.update(['a'], 0);
    a.update(['a', 'b'], 500);
    expect(a.look('a', 500).alpha).toBe(1);
    expect(a.look('b', 500).alpha).toBe(0);
  });

  it('a leaver fades, then is forgotten', () => {
    const a = new Arrivals(opts);
    a.update(['a'], 0);
    a.update([], 200);
    expect(a.leaving()).toEqual(['a']);
    expect(a.look('a', 220).alpha).toBeCloseTo(0.5, 5);
    a.update([], 260);
    expect(a.leaving()).toEqual([]);
    expect(a.busy(260)).toBe(false);
  });

  it('a leaver that comes back resumes from where its fade was, never from zero', () => {
    const a = new Arrivals(opts);
    a.update(['a'], 0);
    a.update([], 200);
    a.update(['a'], 220);
    expect(a.look('a', 220).alpha).toBeGreaterThan(0.5);
  });

  it('with reduced motion everything is simply there, and leaves at once', () => {
    const a = new Arrivals({ ...opts, reduce: true });
    a.update(['a', 'b', 'c'], 0);
    expect(a.look('c', 0)).toEqual({ alpha: 1, scale: 1 });
    a.update([], 1);
    expect(a.leaving()).toEqual([]);
    expect(a.busy(1)).toBe(false);
  });

  it('the dot lands: it overshoots a little then settles at its size', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(easeOutBack))).toBeGreaterThan(1);
  });

  it('a ripple runs once and is then dropped', () => {
    const r = { x: 0, y: 0, hue: 0, born: 0, map: false };
    expect(rippleProgress(r, RIPPLE_MS / 2)).toBeCloseTo(0.5, 5);
    expect(rippleProgress(r, RIPPLE_MS)).toBeNull();
  });
});
