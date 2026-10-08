/**
 * host.ts — MnemoClio's one line to the shell: the SDK client, the deadlines, and the "opened by"
 * press the cockpit relays (a fact card, a chat chip). One copy, not one per hook.
 */
import { MnemoCartridgeSDK } from '../sdk/mnemo-sdk';

export const sdk = new MnemoCartridgeSDK('@mnemosyne-plugins/mnemo-clio');
/** Rule 9: a host call that never answers ends in this. */
export const HOST_TIMEOUT_MS = 15000;
/** A press that launched this window counts if it is this recent; older, it is not replayed. */
export const OPENED_RECENT_MS = 30000;

/** Inside the shell? Outside it (a plain browser) there is no board and no memory. */
export const inShell = (): boolean => typeof window !== 'undefined' && window.parent !== window;

/** Calls `cb` with the id of every `cockpit:card-opened` the shell sends this window; returns the unsubscribe. */
export function onCardOpened(cb: (id: unknown) => void): () => void {
  const onMessage = (ev: MessageEvent) => {
    if (ev.source !== window.parent) return;
    const d = ev.data as { type?: unknown; event?: unknown; data?: { id?: unknown } } | null;
    if (d?.type === 'MNEMO_PLUGIN_EVENT' && d.event === 'cockpit:card-opened') cb(d.data?.id);
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

/** The press that launched this window, when it is recent enough to act on; null otherwise. */
export async function recentOpened(): Promise<unknown> {
  const res = await sdk.invoke<{ opened?: { id?: unknown; at?: unknown } | null }>('cockpit.state', undefined, HOST_TIMEOUT_MS);
  const o = res?.opened;
  return o && typeof o.at === 'string' && Date.now() - Date.parse(o.at) < OPENED_RECENT_MS ? o.id : null;
}
