/**
 * The scene shared by several windows (doc 137 §5vicies): who owns the motion, who runs the
 * play clock, and the echo guard (a peer's moment never goes out again).
 */
import { describe, expect, it } from 'vitest';
import { Scene } from './scene';
import { centreOn } from './view';

const tick = () => new Promise<void>((r) => queueMicrotask(r));

describe('scene between windows', () => {
  it('a gesture here goes out, once per task', async () => {
    const s = new Scene(1870, 100);
    let n = 0;
    s.onMotion(() => { n++; });
    s.dragTo(centreOn(1880, 100));
    s.dragTo(centreOn(1890, 100));
    await tick();
    expect(n).toBe(1);
  });

  it("a peer's moment is taken at once and never goes out again", async () => {
    const s = new Scene(1870, 100);
    let n = 0;
    s.onMotion(() => { n++; });
    s.applyPeer({ view: centreOn(1492, 100), playing: true, speed: 20, loop: null }, true);
    await tick();
    expect(n).toBe(0);
    expect(s.cursor).toBeCloseTo(1492, 6);
    expect(s.playing).toBe(true);
    expect(s.speed).toBe(20);
  });

  it('play does not advance here while its clock runs in another window', () => {
    const s = new Scene(1870, 100);
    s.applyPeer({ view: centreOn(1870, 100), playing: true, speed: 20, loop: null }, true);
    for (let i = 0; i < 60; i++) s.step(1 / 60);
    expect(s.cursor).toBeCloseTo(1870, 6);
  });

  it('pressing play here takes the clock back, and play advances', () => {
    const s = new Scene(1870, 100);
    s.applyPeer({ view: centreOn(1870, 100), playing: false, speed: 20, loop: null }, true);
    s.applyPeer({ view: centreOn(1870, 100), playing: true, speed: 20, loop: null }, true);
    s.setPlaying(false);
    s.setPlaying(true);
    expect(s.peerClock).toBe(false);
    for (let i = 0; i < 60; i++) s.step(1 / 60);
    expect(s.cursor).toBeCloseTo(1890, 0);
  });

  it('a drag here during a peer’s play takes the motion', () => {
    const s = new Scene(1870, 100);
    s.applyPeer({ view: centreOn(1870, 100), playing: true, speed: 20, loop: null }, true);
    s.dragTo(centreOn(1700, 100));
    expect(s.peerClock).toBe(false);
  });

  it('a play frame of the clock owner goes out', async () => {
    const s = new Scene(1870, 100);
    let n = 0;
    s.onMotion(() => { n++; });
    s.setPlaying(true);
    await tick();
    n = 0;
    s.step(1 / 60);
    await tick();
    expect(n).toBe(1);
  });

  it('merged sparks join the feed without going out, and an item already there is not doubled', () => {
    const s = new Scene();
    const out: string[][] = [];
    s.onSparks((qs) => out.push(qs));
    s.addSparks(['Q1'], 1);
    s.mergeSparks(['Q1', 'Q2'], 2);
    expect(s.sparks.map((x) => x.q)).toEqual(['Q2', 'Q1']);
    expect(out).toEqual([['Q1']]);
  });
});
