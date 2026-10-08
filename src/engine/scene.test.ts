import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scene, YEAR_EMIT_MS } from './scene';
import { panBy, span, yearToX } from './view';

afterEach(() => { vi.useRealTimers(); });

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

  it('the cursor is the centre of the view: a drag moves the year, never the cursor on screen', () => {
    const s = new Scene(1870, 100);
    s.dragTo(panBy(s.view, 30));
    expect(s.cursor).toBeCloseTo(1900, 6);
    expect(yearToX(s.view, 1000, s.cursor)).toBeCloseTo(500, 6);
  });

  it('pressing play at the end starts again from the first year that was on screen', () => {
    const s = new Scene(2025, 100);
    s.setPlaying(true);
    expect(s.cursor).toBeCloseTo(1975, 6);
  });

  it('a loop wraps to its first year when the cursor reaches its last', () => {
    const s = new Scene(1789, 30);
    expect(s.setLoop({ a: 1789, b: 1799 })).toBe(true);
    s.setSpeed(5);
    s.setPlaying(true);
    for (let i = 0; i < 150; i++) s.step(1 / 60); // 2.5 s: 12.5 years, past 1799
    expect(s.playing).toBe(true);
    expect(s.cursor).toBeGreaterThanOrEqual(1789);
    expect(s.cursor).toBeLessThan(1792);
  });

  it('play starts a loop at its first year when the cursor stands outside it', () => {
    const s = new Scene(1900, 30);
    s.setLoop({ a: 1789, b: 1799 });
    s.setPlaying(true);
    expect(s.cursor).toBeCloseTo(1789, 6);
  });

  it('a loop that ends at the last year still wraps; cleared, play stops at the end again', () => {
    const s = new Scene(2020, 30);
    s.setLoop({ a: 2010, b: 2100 });
    expect(s.loop).toEqual({ a: 2010, b: 2025 });
    s.setSpeed(60);
    s.setPlaying(true);
    for (let i = 0; i < 30; i++) s.step(1 / 60);
    expect(s.playing).toBe(true);
    expect(s.cursor).toBeLessThan(2025);
    s.setLoop(null);
    for (let i = 0; i < 60; i++) s.step(1 / 60);
    expect(s.playing).toBe(false);
  });

  it('a loop under one year is refused, and the previous one stays', () => {
    const s = new Scene(1900, 30);
    s.setLoop({ a: 1900, b: 1950 });
    expect(s.setLoop({ a: 1900, b: 1900.5 })).toBe(false);
    expect(s.loop).toEqual({ a: 1900, b: 1950 });
  });

  it('a fast drag tells React at most every YEAR_EMIT_MS, and always the last year', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    const s = new Scene(1870.5, 100);
    const fn = vi.fn();
    s.subscribe(fn);
    for (let y = 1871; y < 1901; y++) s.setCursor(y + 0.5); // 30 years in the same instant
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(YEAR_EMIT_MS);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(Math.floor(s.cursor)).toBe(1900);
    s.dispose();
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
