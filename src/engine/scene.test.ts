import { describe, expect, it, vi } from 'vitest';
import { Scene } from './scene';
import { span, yearToX } from './view';

describe('scene', () => {
  it('play moves the cursor at its speed, and the view follows it so it never leaves the screen', () => {
    const s = new Scene(1870, 100);
    s.setSpeed(20);
    s.setPlaying(true);
    for (let i = 0; i < 180; i++) s.step(1 / 60); // 3 s of play: 60 years
    expect(s.cursor).toBeCloseTo(1930, 0);
    // without the follow, the cursor would be 10 years past the right edge by now
    const x = yearToX(s.view, 1000, s.cursor);
    expect(x).toBeGreaterThan(100);
    expect(x).toBeLessThan(900);
    expect(span(s.view)).toBeCloseTo(100, 0);
  });

  it('play stops by itself at the last year', () => {
    const s = new Scene(2020, 100);
    s.setSpeed(60);
    s.setPlaying(true);
    for (let i = 0; i < 60; i++) s.step(1 / 60);
    expect(s.playing).toBe(false);
    expect(s.cursor).toBe(2025);
  });

  it('pressing play at the end starts again from the first year on screen instead of doing nothing', () => {
    const s = new Scene(2025, 100);
    s.setPlaying(true);
    expect(s.cursor).toBeCloseTo(s.view.y0, 6);
    expect(s.cursor).toBeLessThan(2000);
  });

  it('tells React only when the whole year changes, not sixty times a second', () => {
    const s = new Scene(1870.1, 100);
    const fn = vi.fn();
    s.subscribe(fn);
    s.setCursor(1870.5);
    s.setCursor(1870.9);
    expect(fn).not.toHaveBeenCalled();
    s.setCursor(1871.05);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a still scene asks for no frame; a fling glides, then stops asking', () => {
    const s = new Scene(1870, 100);
    expect(s.step(1 / 60)).toBe(false);
    s.fling(80);
    expect(s.step(1 / 60)).toBe(true);
    let n = 0;
    while (s.step(1 / 60) && n < 2000) n++;
    expect(n).toBeLessThan(2000);
    expect(s.velocity).toBe(0);
  });

  it('the feed keeps the newest first and at most twelve', () => {
    const s = new Scene();
    for (let i = 0; i < 20; i++) s.addSparks(['Q' + i], i);
    expect(s.sparks).toHaveLength(12);
    expect(s.sparks[0]!.q).toBe('Q19');
  });

  it('an item that arrives twice in one frame (two subjects) is one spark', () => {
    const s = new Scene();
    s.addSparks(['Q1', 'Q1', 'Q2'], 5);
    expect(s.sparks.map((x) => x.q)).toEqual(['Q1', 'Q2']);
  });
});
