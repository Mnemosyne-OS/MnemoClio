/**
 * useFactCard.ts — MnemoClio's side of the fact card on the board (doc 110, doc 137 §5decies).
 *
 * The host owns the ONE fact of what is pinned: every answer of `cockpit.pin` / `unpin` /
 * `publish` carries the pinned ids, and the button is drawn from that. `cockpit.state` (ungated)
 * asks at start, so a card pinned yesterday gets today's fact without a gesture. A refused
 * publish pauses publishing until the next press (a revoked permission must not raise the
 * host's dialog on every change). Outside the shell there is no board: the hook says so and
 * the button is not drawn.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HOST_TIMEOUT_MS, OPENED_RECENT_MS, inShell, onCardOpened, sdk } from './host';
import type { Ev } from '../data/types';
import { FACT_CARD_ID, dayKey, factOfDay, factPool, type FactCard } from '../data/fact';

const STORE_KEY = 'mnemo-clio.fact';

interface Stored { q: string; day: string }
function readStored(): Stored | null {
  try {
    const o = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Stored> | null;
    return o && typeof o.q === 'string' && typeof o.day === 'string' ? { q: o.q, day: o.day } : null;
  } catch (e) { console.warn('[MnemoClio] fact not readable', e); return null; }
}
function writeStored(s: Stored): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { console.warn('[MnemoClio] fact not saved: tomorrow may show it again', e); }
}

export interface FactCardState {
  /** False outside the shell: there is no board to pin to. */
  available: boolean;
  /** Null until the host answered. */
  pinned: boolean | null;
  error: string | null;
  toggle: () => void;
  another: () => void;
}

/**
 * The fact card's state and its two presses. The host is asked what is pinned at start (no dialog
 * on nobody's gesture) and the button is drawn from each of its answers, never from a guess.
 */
export function useFactCard(events: readonly Ev[], build: (e: Ev) => FactCard, onOpen: (q: string) => void, complete = true): FactCardState {
  const available = inShell();
  const pool = useMemo(() => factPool(events), [events]);
  const byQ = useMemo(() => new Map(pool.map((e) => [e.q, e])), [pool]);
  const [pinned, setPinned] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState<Stored | null>(readStored);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  // Today's fact, unless a press chose another one today. 🚨 Only once EVERY subject is read
  // (`complete`): drawn from the first file to land, the fact depended on which file a machine
  // read first, so it was not the same for everyone the same day (verification 07/10, T2).
  const today = dayKey(new Date());
  const fact = useMemo(() => (complete ? (stored?.day === today ? byQ.get(stored.q) : undefined) ?? factOfDay(pool, today) : null), [complete, stored, today, byQ, pool]);
  // a press on the card waits for the fact (and so for the history): opened before, the card
  // showed the event's file while the cursor stayed in 1870 (verification 07/10, T1)
  const [openWanted, setOpenWanted] = useState(false);
  useEffect(() => {
    if (openWanted && fact) { setOpenWanted(false); openRef.current(fact.q); }
  }, [openWanted, fact]);

  const adopt = (res: { pinned?: unknown } | null | undefined) => {
    if (Array.isArray(res?.pinned)) setPinned(res.pinned.includes(FACT_CARD_ID));
  };

  // start: what is pinned, and was this window opened by a press on the card
  useEffect(() => {
    if (!available) return;
    let alive = true;
    sdk.invoke<{ pinned?: string[]; opened?: { id?: unknown; at?: unknown } | null }>('cockpit.state', undefined, HOST_TIMEOUT_MS)
      .then((res) => {
        if (!alive) return;
        adopt(res);
        const o = res?.opened;
        if (o?.id === FACT_CARD_ID && typeof o.at === 'string' && Date.now() - Date.parse(o.at) < OPENED_RECENT_MS) setOpenWanted(true);
      })
      .catch((err) => { if (alive) { console.warn('[MnemoClio] cockpit.state unavailable', err); setPinned(false); } });
    // a press on the card while this window is open
    const off = onCardOpened((id) => { if (id === FACT_CARD_ID) setOpenWanted(true); });
    return () => { alive = false; off(); };
  }, [available]);

  // the card on the board follows the fact (a new day, another press, another language)
  const card = useMemo(() => (fact ? build(fact) : null), [fact, build]);
  useEffect(() => {
    if (!available || !pinned || paused || !card || !fact) return;
    let alive = true;
    sdk.invoke<{ success?: boolean; pinned?: string[] }>('cockpit.publish', { cards: [card] }, HOST_TIMEOUT_MS)
      .then((res) => { if (!alive) return; adopt(res); if (res?.success === false) setPaused(true); })
      .catch((err) => { console.warn('[MnemoClio] cockpit.publish refused', err); if (alive) setPaused(true); });
    return () => { alive = false; };
  }, [available, pinned, paused, card, fact, today]);

  const toggle = useCallback(() => {
    if (!available || !card || !fact) return;
    setPaused(false);
    setError(null);
    const unpin = pinned === true;
    if (!unpin) { const s = { q: fact.q, day: today }; writeStored(s); setStored(s); }
    // The host read the manifests at start: a cartridge updated since (cockpit:pin is new on
    // 07/10) is refused until it reads them again. Ungated and cheap, so before every pin.
    const ready = unpin ? Promise.resolve() : sdk.invoke('permissions.refresh', { permissions: ['cockpit:pin'] }, HOST_TIMEOUT_MS)
      .then(() => undefined, (err) => console.warn('[MnemoClio] permissions.refresh unavailable', err));
    void ready
      .then(() => sdk.invoke<{ success?: boolean; pinned?: string[]; error?: string }>(unpin ? 'cockpit.unpin' : 'cockpit.pin', unpin ? { id: FACT_CARD_ID } : { id: FACT_CARD_ID, card, level: 'plane' }, HOST_TIMEOUT_MS))
      .then((res) => { adopt(res); if (res?.success === false) setError(res.error ?? 'refused'); })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [available, card, fact, pinned, today]);

  const another = useCallback(() => {
    if (pool.length < 2) return;
    let e = pool[Math.floor(Math.random() * pool.length)]!;
    if (e.q === fact?.q) e = pool[(pool.indexOf(e) + 1) % pool.length]!;
    const s = { q: e.q, day: today };
    writeStored(s);
    setStored(s);
    setPaused(false);
  }, [pool, fact, today]);

  return { available, pinned, error, toggle, another };
}
