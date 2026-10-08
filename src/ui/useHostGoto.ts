/**
 * useHostGoto.ts — the chat asked to see a moment (lot E, doc 137 §5sedecies).
 *
 * Under an answer that read a moment MnemoClio poured, the chat offers « 🕰 1780 in MnemoClio ».
 * Its press marks the intent `goto:<country Q>:<year>` through the cockpit's "opened by" path,
 * then launches this window: read at start from `cockpit.state` (when the press is recent), or
 * heard as `cockpit:card-opened` when the window is already open. Anything else is ignored.
 */
import { useEffect, useRef } from 'react';
import { inShell, onCardOpened, recentOpened } from './host';

const GOTO = /^goto:(Q\d+):(-?\d+)$/;

/** `goto:Q142:1780` → { country, year }, else null. */
export function parseGoto(id: unknown): { country: string; year: number } | null {
  const m = typeof id === 'string' ? GOTO.exec(id) : null;
  if (!m) return null;
  const year = Number(m[2]);
  return Number.isInteger(year) && year !== 0 ? { country: m[1]!, year } : null;
}

/** Calls `onGoto` when the chat asks for a moment. `ready` = the data the move needs is loaded. */
export function useHostGoto(ready: boolean, onGoto: (country: string, year: number) => void): void {
  const cb = useRef(onGoto);
  cb.current = onGoto;
  const pending = useRef<{ country: string; year: number } | null>(null);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    if (!inShell()) return;
    let alive = true;
    const deliver = (g: { country: string; year: number } | null) => {
      if (!g || !alive) return;
      if (readyRef.current) cb.current(g.country, g.year); else pending.current = g;
    };
    recentOpened().then((id) => deliver(parseGoto(id)), (e: unknown) => console.warn('[MnemoClio] cockpit.state unavailable', e));
    const off = onCardOpened((id) => deliver(parseGoto(id)));
    return () => { alive = false; off(); };
  }, []);

  // a request that arrived before the history was read is delivered once it is
  useEffect(() => {
    if (ready && pending.current) { const g = pending.current; pending.current = null; cb.current(g.country, g.year); }
  }, [ready]);
}
