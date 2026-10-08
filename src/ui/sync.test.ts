/**
 * Windows of one MnemoClio linked over a channel (sync.ts). A fake channel delivers every post to
 * the other ends at once, so the rules are read without a browser.
 */
import { describe, expect, it, vi } from 'vitest';
import { Scene } from '../engine/scene';
import { centreOn } from '../engine/view';
import { CLOCK_SILENCE_MS, JOIN_WAIT_MS, choicesKey, linkWindows, readChoices, readPeerScene, roleOf, type Choices, type Port } from './sync';

const tick = () => new Promise<void>((r) => queueMicrotask(r));

/** A channel: what one end posts, every other end hears. Counts what goes out. */
function hub() {
  const ends = new Set<(m: unknown) => void>();
  const sent: unknown[] = [];
  const port = (): Port => {
    let fn: ((m: unknown) => void) | null = null;
    const mine = (m: unknown) => fn?.(structuredClone(m));
    return {
      post: (m) => { sent.push(m); for (const e of ends) if (e !== mine) e(m); },
      listen: (f) => { fn = f; ends.add(mine); return () => { ends.delete(mine); }; },
      close: () => { ends.delete(mine); },
    };
  };
  return { port, sent };
}

/** A clock the test moves by hand. */
function fakeClock() {
  let t = 0;
  const every: Array<{ ms: number; fn: () => void; next: number }> = [];
  const after: Array<{ at: number; fn: () => void; done: boolean }> = [];
  return {
    now: () => t,
    every: (ms: number, fn: () => void) => { const e = { ms, fn, next: t + ms }; every.push(e); return () => { every.splice(every.indexOf(e), 1); }; },
    after: (ms: number, fn: () => void) => { const a = { at: t + ms, fn, done: false }; after.push(a); return () => { a.done = true; }; },
    advance(ms: number) {
      t += ms;
      for (const a of after) if (!a.done && a.at <= t) { a.done = true; a.fn(); }
      for (const e of [...every]) while (e.next <= t) { e.next += e.ms; e.fn(); }
    },
  };
}

const CH: Choices = { shown: ['Q142', 'Q17'], kinds: [], wars: true, clouds: true, leaders: true, epi: true, rel: false, tr: false, borders: 'now', picked: null };

function window2(h: ReturnType<typeof hub>, id: string, clock = fakeClock(), choices: Choices | null = CH) {
  const scene = new Scene(1870, 100);
  const got: Choices[] = [];
  let ready = false;
  const link = linkWindows(scene, h.port(), { choices: () => choices, onChoices: (c) => got.push(c), onReady: () => { ready = true; } }, id, clock);
  return { scene, got, link, clock, isReady: () => ready };
}

describe('roleOf', () => {
  it('reads the widget id, and anything else is the single view', () => {
    expect(roleOf('?widget=mnemo-clio-map&theme=dark')).toBe('map');
    expect(roleOf('?widget=mnemo-clio-timeline')).toBe('timeline');
    expect(roleOf('?widget=mnemo-clio-panel')).toBe('panel');
    expect(roleOf('?widget=mnemo-clio-main')).toBe('main');
    expect(roleOf('')).toBe('main');
  });
});

describe('reading a message', () => {
  it('drops a moment that does not read', () => {
    expect(readPeerScene({ view: { y0: 1800, y1: 1900 }, playing: false, speed: 5, loop: null })).not.toBeNull();
    expect(readPeerScene({ view: { y0: 1900, y1: 1800 }, playing: false, speed: 5, loop: null })).toBeNull();
    expect(readPeerScene({ view: { y0: Number.NaN, y1: 1900 }, playing: false, speed: 5, loop: null })).toBeNull();
    expect(readPeerScene({ view: { y0: 1800, y1: 1900 }, playing: 'yes', speed: 5, loop: null })).toBeNull();
  });

  it('drops choices with one field that does not read', () => {
    expect(readChoices(CH)).toEqual(CH);
    expect(readChoices({ ...CH, shown: ['<script>'] })).toBeNull();
    expect(readChoices({ ...CH, kinds: ['nope'] })).toBeNull();
    expect(readChoices({ ...CH, borders: 'ancient' })).toBeNull();
    expect(readChoices({ ...CH, picked: { type: 'war' } })).toBeNull();
    expect(readChoices({ ...CH, picked: { type: 'war', id: 'Q1' } })?.picked).toEqual({ type: 'war', id: 'Q1' });
  });

  it('spells equal choices the same, whatever the order of the subjects', () => {
    const a = { ...CH, kinds: ['b', 'a'] as never[] };
    const b = { ...CH, kinds: ['a', 'b'] as never[] };
    expect(choicesKey(a)).toBe(choicesKey(b));
  });
});

describe('linked windows', () => {
  it('a drag in one window moves the other, and nothing comes back', async () => {
    const h = hub();
    const a = window2(h, 'a');
    const b = window2(h, 'b');
    h.sent.length = 0;
    a.scene.dragTo(centreOn(1492, 100));
    await tick();
    await tick();
    expect(b.scene.cursor).toBeCloseTo(1492, 6);
    expect(h.sent).toHaveLength(1);
    a.link.unlink(); b.link.unlink();
  });

  it('a window that opens is answered with the moment and the choices', async () => {
    const h = hub();
    const a = window2(h, 'a');
    a.clock.advance(JOIN_WAIT_MS);
    a.scene.dragTo(centreOn(1492, 100));
    await tick();
    const b = window2(h, 'b', fakeClock(), null);
    expect(b.scene.cursor).toBeCloseTo(1492, 6);
    expect(b.got).toEqual([CH]);
    expect(b.isReady()).toBe(true);
    a.link.unlink(); b.link.unlink();
  });

  it("a new window's own choices wait for an answer, or for JOIN_WAIT_MS", () => {
    const h = hub();
    const b = window2(h, 'b');
    b.link.sendChoices(CH);
    expect(h.sent.filter((m) => (m as { t: string }).t === 'choices')).toHaveLength(0);
    b.clock.advance(JOIN_WAIT_MS);
    b.link.sendChoices(CH);
    expect(h.sent.filter((m) => (m as { t: string }).t === 'choices')).toHaveLength(1);
    b.link.unlink();
  });

  it('play runs in the window that pressed it; the other follows without a clock of its own', async () => {
    const h = hub();
    const a = window2(h, 'a');
    const b = window2(h, 'b');
    a.scene.setSpeed(20);
    a.scene.setPlaying(true);
    await tick();
    expect(b.scene.playing).toBe(true);
    expect(b.scene.peerClock).toBe(true);
    for (let i = 0; i < 30; i++) { a.scene.step(1 / 60); b.scene.step(1 / 60); await tick(); }
    expect(b.scene.cursor).toBeCloseTo(a.scene.cursor, 6);
    expect(a.scene.cursor).toBeCloseTo(1880, 0);
    a.link.unlink(); b.link.unlink();
  });

  it('play stops in a follower whose clock went silent', async () => {
    const h = hub();
    const a = window2(h, 'a');
    const b = window2(h, 'b');
    a.scene.setPlaying(true);
    await tick();
    a.link.unlink();
    b.clock.advance(CLOCK_SILENCE_MS + 600);
    expect(b.scene.playing).toBe(false);
    b.link.unlink();
  });

  it('sparks a timeline lit reach a panel alone', async () => {
    const h = hub();
    const a = window2(h, 'a');
    const b = window2(h, 'b');
    a.scene.addSparks(['Q7'], 1);
    expect(b.scene.sparks.map((s) => s.q)).toEqual(['Q7']);
    a.link.unlink(); b.link.unlink();
  });

  it('a message from another cartridge on the shared origin is ignored', () => {
    const h = hub();
    const b = window2(h, 'b');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.port().post({ v: 1, from: 'x', t: 'scene', s: { view: { y0: 'a' } } });
    h.port().post({ hello: true });
    expect(b.scene.cursor).toBeCloseTo(1870, 6);
    warn.mockRestore();
    b.link.unlink();
  });
});
