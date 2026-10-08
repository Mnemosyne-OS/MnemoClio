/**
 * usePourHistory.ts — pouring a country's history into memory (lot 2, doc 137 §5quindecies).
 *
 * One press = one country: its Memory Pack is asked first (`vault.pack.ensure`, one pack per
 * country under the knowledge folder the person chose in the Hub, doc 135 §6.6), then every
 * chronicle goes in by `mnemosyne.ingest`, one at a time, with its progress, a Stop, and the
 * refusals COUNTED (a partial pour is said, never shown as done). The same moment poured again
 * is the same text: the core keeps it once (its checksum), so pouring again costs nothing twice.
 *
 * A knowledge answers in the chat only when the person names it in the chat's scope (doc 135
 * §6.4): the end of a pour says which vault to pick. Outside the shell there is no memory: the
 * hook says so and no button is drawn.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { HOST_TIMEOUT_MS, inShell, sdk } from './host';
import type { Chronicle } from '../data/chronicle';

const INGEST_TIMEOUT_MS = 30000;
const STORE_KEY = 'mnemo-clio.poured';
/** The spine the chat can find a history by (one kind of chronicle, like MnemoLaw's LAW_ARTICLE). */
export const HISTORY_SPINE = 'HISTORY_MOMENT';


export interface Poured { at: string; n: number; vault: string }
export type PourState =
  | { kind: 'idle'; last: Poured | null }
  | { kind: 'pouring'; done: number; total: number; refused: number; startedAt: number; why: string | null }
  | { kind: 'done'; poured: Poured; refused: number; stopped: boolean; why: string | null }
  | { kind: 'failed'; why: string };

function readPoured(): Record<string, Poured> {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, Poured>; } catch (e) { console.warn('[MnemoClio] pour record not readable', e); return {}; }
}
function writePoured(m: Record<string, Poured>): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(m)); } catch (e) { console.warn('[MnemoClio] pour record not saved: the button will offer to pour again', e); }
}

/** What the panel needs: whether there is a memory at all, who is being poured, each country's state, the two presses. */
export interface PourHistory {
  available: boolean;
  /** The country being poured, if any (one at a time). */
  busy: string | null;
  stateOf: (country: string) => PourState;
  pour: (country: string, pack: string, chronicles: () => Chronicle[]) => void;
  stop: () => void;
}

/** One pour at a time, its progress per country, and what was poured before (remembered on this machine). */
export function usePourHistory(): PourHistory {
  const available = inShell();
  const [states, setStates] = useState<Record<string, PourState>>({});
  const [poured, setPoured] = useState<Record<string, Poured>>(readPoured);
  const [busy, setBusy] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const set = (c: string, s: PourState) => setStates((m) => ({ ...m, [c]: s }));

  const pour = useCallback((country: string, pack: string, chronicles: () => Chronicle[]) => {
    if (!available || abort.current) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(country);
    void (async () => {
      const list = chronicles();
      let done = 0, refused = 0;
      /** The last refusal's reason, said on screen next to the count. */
      let why: string | null = null;
      const startedAt = Date.now();
      set(country, { kind: 'pouring', done, total: list.length, refused, startedAt, why });
      try {
        // the host read the manifests at its start: vault:write is newer than that (07/10)
        await sdk.invoke('permissions.refresh', { permissions: ['vault:write'] }, HOST_TIMEOUT_MS).catch((e: unknown) => console.warn('[MnemoClio] permissions.refresh unavailable', e));
        const res = await sdk.invoke<{ vault?: string }>('vault.pack.ensure', { pack, lexicalOnly: true }, HOST_TIMEOUT_MS * 2);
        if (!res?.vault) throw new Error('ENSURE_PACK_FAILED');
        const vault = res.vault;
        for (const ch of list) {
          if (ctrl.signal.aborted) break;
          try {
            await sdk.invoke('mnemosyne.ingest', { vault, content: ch.content, spineType: HISTORY_SPINE, sourceRef: ch.sourceRef }, INGEST_TIMEOUT_MS);
            done++;
          } catch (e) {
            refused++;
            why = e instanceof Error ? e.message : String(e);
            console.warn('[MnemoClio] a chronicle was refused', ch.sourceRef, e);
          }
          if (!ctrl.signal.aborted) set(country, { kind: 'pouring', done, total: list.length, refused, startedAt, why });
        }
        const p: Poured = { at: new Date().toISOString().slice(0, 10), n: done, vault };
        if (done > 0) setPoured((m) => { const next = { ...m, [country]: p }; writePoured(next); return next; });
        set(country, { kind: 'done', poured: p, refused, stopped: ctrl.signal.aborted && done < list.length, why });
      } catch (e) {
        set(country, { kind: 'failed', why: e instanceof Error ? e.message : String(e) });
      } finally {
        abort.current = null;
        setBusy(null);
      }
    })();
  }, [available]);

  const stop = useCallback(() => abort.current?.abort(), []);
  const stateOf = useCallback((c: string): PourState => states[c] ?? { kind: 'idle', last: poured[c] ?? null }, [states, poured]);
  return { available, busy, stateOf, pour, stop };
}
