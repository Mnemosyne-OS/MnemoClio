/**
 * sync.ts — the windows of one MnemoClio share one moment and one set of choices (the exploded
 * view, doc 137 §5vicies: the map, the timeline and the panel as separate windows on the board).
 *
 * Over a BroadcastChannel. When the cartridge is installed every cartridge shares one origin, so
 * the channel is named after MnemoClio and EVERY message is read as untrusted: a field that does
 * not read is dropped, never repaired into a value nobody sent.
 *
 * - `scene`: the moment, from the window that owns the motion (scene.ts says who).
 * - `sparks`: what a play cursor passed, from any window that has a timeline (a panel alone has
 *   none, and its feed would stay empty).
 * - `choices`: countries, layers, names, borders, what is picked.
 * - `hello`: a window that opens asks; every other one answers with its moment and its choices,
 *   so a window opened on 1492 does not start at 1870.
 */
import { KINDS, type Kind } from '../data/types';
import type { Picked, PeerScene, Scene } from '../engine/scene';

export const SYNC_CHANNEL = 'mnemo-clio.sync.v1';
/** A new window waits this long for an answer before its own choices may go out. */
export const JOIN_WAIT_MS = 400;
/** Play whose clock went silent this long stops here (the window that ran it closed). */
export const CLOCK_SILENCE_MS = 1500;

/** The four windows MnemoClio can be. */
export type Role = 'main' | 'map' | 'timeline' | 'panel';

/** `?widget=mnemo-clio-map` → 'map'; anything else (a plain browser, the single window) → 'main'. */
export function roleOf(search: string): Role {
  const w = new URLSearchParams(search).get('widget');
  return w === 'mnemo-clio-map' ? 'map' : w === 'mnemo-clio-timeline' ? 'timeline' : w === 'mnemo-clio-panel' ? 'panel' : 'main';
}

/** What a person chose, as it travels. Arrays, in a fixed key order, so two equal choices are one string. */
export interface Choices {
  shown: string[];
  kinds: Kind[];
  wars: boolean;
  clouds: boolean;
  leaders: boolean;
  epi: boolean;
  rel: boolean;
  tr: boolean;
  borders: 'now' | 'era';
  picked: Picked | null;
}

/** The one spelling of a set of choices: what is compared, what is sent. */
export function choicesKey(c: Choices): string {
  return JSON.stringify({
    shown: c.shown, kinds: [...c.kinds].sort(), wars: c.wars, clouds: c.clouds, leaders: c.leaders,
    epi: c.epi, rel: c.rel, tr: c.tr, borders: c.borders, picked: c.picked,
  });
}

const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function readPicked(o: unknown): Picked | null | undefined {
  if (o === null) return null;
  const p = o as Record<string, unknown> | null;
  if (!p || typeof p !== 'object') return undefined;
  switch (p.type) {
    case 'event': return isStr(p.q) ? { type: 'event', q: p.q } : undefined;
    case 'war': return isStr(p.id) ? { type: 'war', id: p.id } : undefined;
    case 'period': return isStr(p.id) ? { type: 'period', id: p.id } : undefined;
    case 'regime': return isStr(p.id) && isStr(p.c) ? { type: 'regime', id: p.id, c: p.c } : undefined;
    case 'decade': return isStr(p.key) && isNum(p.decade) && (p.size === undefined || isNum(p.size))
      ? { type: 'decade', key: p.key, decade: p.decade, ...(p.size === undefined ? {} : { size: p.size }) } : undefined;
    case 'leader': return isStr(p.q) && isNum(p.of) && isNum(p.s) ? { type: 'leader', q: p.q, of: p.of, s: p.s } : undefined;
    default: return undefined;
  }
}

/** Choices from a message, or null when one field does not read (the whole message is dropped). */
export function readChoices(o: unknown): Choices | null {
  const c = o as Record<string, unknown> | null;
  if (!c || typeof c !== 'object') return null;
  const shown = Array.isArray(c.shown) && c.shown.length <= 400 && c.shown.every((x) => typeof x === 'string' && /^Q\d{1,12}$/.test(x)) ? c.shown as string[] : null;
  const kinds = Array.isArray(c.kinds) && c.kinds.every((x) => (KINDS as readonly unknown[]).includes(x)) ? c.kinds as Kind[] : null;
  const bools = ['wars', 'clouds', 'leaders', 'epi', 'rel', 'tr'] as const;
  const picked = readPicked(c.picked);
  if (!shown || !kinds || picked === undefined || !bools.every((k) => typeof c[k] === 'boolean') || (c.borders !== 'now' && c.borders !== 'era')) return null;
  return {
    shown, kinds, wars: c.wars as boolean, clouds: c.clouds as boolean, leaders: c.leaders as boolean,
    epi: c.epi as boolean, rel: c.rel as boolean, tr: c.tr as boolean, borders: c.borders, picked,
  };
}

/** A moment from a message, or null. */
export function readPeerScene(o: unknown): PeerScene | null {
  const s = o as Record<string, unknown> | null;
  const v = s?.view as Record<string, unknown> | undefined;
  if (!s || !v || !isNum(v.y0) || !isNum(v.y1) || !(v.y1 > v.y0)) return null;
  if (typeof s.playing !== 'boolean' || !isNum(s.speed) || s.speed <= 0 || s.speed > 1000) return null;
  let loop: PeerScene['loop'] = null;
  if (s.loop !== null) {
    const l = s.loop as Record<string, unknown> | undefined;
    if (!l || !isNum(l.a) || !isNum(l.b)) return null;
    loop = { a: l.a, b: l.b };
  }
  return { view: { y0: v.y0, y1: v.y1 }, playing: s.playing, speed: s.speed, loop };
}

/** The channel, as the link needs it (a BroadcastChannel, or a fake in tests). */
export interface Port {
  post(m: unknown): void;
  listen(fn: (m: unknown) => void): () => void;
  close(): void;
}

/** The real channel, or null where there is none (then every window stands alone, and says so). */
export function broadcastPort(name = SYNC_CHANNEL): Port | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const ch = new BroadcastChannel(name);
  return {
    post: (m) => {
      try { ch.postMessage(m); } catch (e) { console.warn('[MnemoClio] a sync message could not go out', e); }
    },
    listen: (fn) => {
      const on = (ev: MessageEvent) => fn(ev.data);
      ch.addEventListener('message', on);
      return () => ch.removeEventListener('message', on);
    },
    close: () => ch.close(),
  };
}

export interface LinkHooks {
  /** This window's choices now; null while it has nothing to say (its data is not read). */
  choices: () => Choices | null;
  /** Another window's choices, already read. */
  onChoices: (c: Choices) => void;
  /** The first answer arrived, or nobody answered in time: this window's own choices may go out. */
  onReady: () => void;
}

interface Clock { now(): number; every(ms: number, fn: () => void): () => void; after(ms: number, fn: () => void): () => void }
const realClock: Clock = {
  now: () => performance.now(),
  every: (ms, fn) => { const h = setInterval(fn, ms); return () => clearInterval(h); },
  after: (ms, fn) => { const h = setTimeout(fn, ms); return () => clearTimeout(h); },
};

/**
 * Links one window's scene and choices to the others'. Returns the function that unlinks it.
 * `sendChoices` is how this window's own choices go out (the hook calls it on a change that was
 * not a peer's).
 */
export function linkWindows(scene: Scene, port: Port, hooks: LinkHooks, id = Math.random().toString(36).slice(2), clock: Clock = realClock) {
  let lastScene = clock.now();
  const send = (t: string, body: Record<string, unknown>) => port.post({ v: 1, from: id, t, ...body });
  const sendScene = () => send('scene', { s: scene.peerState(), clock: scene.playing && !scene.peerClock });
  const sendChoices = (c: Choices) => send('choices', { c });

  let ready = false;
  const becomeReady = () => { if (!ready) { ready = true; hooks.onReady(); } };

  const off = port.listen((raw) => {
    const m = raw as { v?: unknown; from?: unknown; t?: unknown; s?: unknown; clock?: unknown; qs?: unknown; c?: unknown } | null;
    if (!m || m.v !== 1 || typeof m.from !== 'string' || m.from === id) return;
    if (m.t === 'hello') {
      sendScene();
      const c = hooks.choices();
      if (c && ready) sendChoices(c);
    } else if (m.t === 'scene') {
      const s = readPeerScene(m.s);
      if (!s) return;
      lastScene = clock.now();
      scene.applyPeer(s, m.clock === true);
    } else if (m.t === 'sparks') {
      if (Array.isArray(m.qs) && m.qs.length <= 50 && m.qs.every((q) => isStr(q, 20))) scene.mergeSparks(m.qs as string[], clock.now());
    } else if (m.t === 'choices') {
      const c = readChoices(m.c);
      if (!c) return;
      hooks.onChoices(c);
      becomeReady();
    }
  });
  const offMotion = scene.onMotion(sendScene);
  const offSparks = scene.onSparks((qs) => send('sparks', { qs }));
  // the window that ran the clock went away: play stops here rather than standing still forever
  const offWatch = clock.every(500, () => {
    if (scene.playing && scene.peerClock && clock.now() - lastScene > CLOCK_SILENCE_MS) scene.applyPeer({ ...scene.peerState(), playing: false }, false);
  });
  const offJoin = clock.after(JOIN_WAIT_MS, becomeReady);
  send('hello', {});

  return {
    sendChoices: (c: Choices) => { if (ready) sendChoices(c); },
    isReady: () => ready,
    unlink: () => { off(); offMotion(); offSparks(); offWatch(); offJoin(); port.close(); },
  };
}
