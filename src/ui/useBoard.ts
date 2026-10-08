/**
 * useBoard.ts — « Exploded view » and « Single view » (doc 137 §5unvicies).
 *
 * The press asks the host to lay MnemoClio's three windows out on the desktop named after it
 * (`canvas.openBoard`, found or created empty, the camera framing them), and the way back asks
 * for the desktop the press came from (`canvas.leaveBoard`). The moment and the choices travel
 * by themselves (sync.ts): the windows that open ask the one that pressed.
 * Outside the shell there is no board: the hook says so and the button is not drawn.
 */
import { useCallback, useState } from 'react';
import type { Key } from '../i18n/strings';
import { HOST_TIMEOUT_MS, inShell, sdk } from './host';

/**
 * Where the three windows go, in SHARES of the view (field, 08/10): the timeline down the whole
 * left side, the map top right, the panel under it. The host sizes them to fill the screen at
 * BOARD_ZOOM and puts the camera there (« force the % »).
 */
export const BOARD_LAYOUT = [
  { id: 'mnemo-clio-timeline', x: 0, y: 0, w: 0.5, h: 1 },
  { id: 'mnemo-clio-map', x: 0.5, y: 0, w: 0.5, h: 0.58 },
  { id: 'mnemo-clio-panel', x: 0.5, y: 0.58, w: 0.5, h: 0.42 },
] as const;
/** The board's zoom: windows a fifth larger than the screen shows them, text still read at a glance. */
export const BOARD_ZOOM = 0.8;

/** The host's refusal, in the person's words; an unknown code keeps its raw text, never a guess. */
export function boardWhy(message: string): { key: Key; why?: string } {
  if (message.includes('BOARD_AMBIGUOUS')) return { key: 'board.why.ambiguous' };
  if (message.includes('BOARD_FULL')) return { key: 'board.why.full' };
  if (message.includes('BOARD_NOWHERE')) return { key: 'board.why.nowhere' };
  if (message.includes('BOARD_UNHEARD')) return { key: 'board.why.unheard' };
  if (message.includes('TOO_SOON')) return { key: 'board.why.soon' };
  return { key: 'board.why.other', why: message };
}

export interface BoardState {
  /** False outside the shell. */
  available: boolean;
  busy: boolean;
  /** The last refusal, already in words; null when the last press worked. */
  error: string | null;
  /** The last press was refused because the pager is full: « Open here » is offered. */
  full: boolean;
  open: () => void;
  /** The same three windows on the ACTIVE desktop, around what the person is looking at. */
  openHere: () => void;
  leave: () => void;
}

export function useBoard(t: (k: Key, v?: Record<string, string | number>) => string): BoardState {
  const available = inShell();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);

  const run = useCallback((action: 'canvas.openBoard' | 'canvas.leaveBoard', payload?: unknown) => {
    if (!available || busy) return;
    setBusy(true);
    setError(null);
    setFull(false);
    sdk.invoke(action, payload, HOST_TIMEOUT_MS)
      .then(() => undefined, (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        const w = boardWhy(msg);
        if (w.key === 'board.why.full') setFull(true);
        console.warn('[MnemoClio]', action, 'refused:', err);
        setError(t(w.key, w.why ? { why: w.why } : undefined));
      })
      .finally(() => setBusy(false));
  }, [available, busy, t]);

  const open = useCallback(() => run('canvas.openBoard', { windows: BOARD_LAYOUT, fill: true, zoom: BOARD_ZOOM }), [run]);
  // here, the single window closes while the board is open (« Single view » brings it back)
  const openHere = useCallback(() => run('canvas.openBoard', { windows: BOARD_LAYOUT, fill: true, zoom: BOARD_ZOOM, here: true, replace: true }), [run]);
  const leave = useCallback(() => run('canvas.leaveBoard'), [run]);
  return { available, busy, error, full, open, openHere, leave };
}
