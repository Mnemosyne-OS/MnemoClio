/**
 * ClioAgentActions — serves MnemoClio's agent actions (doc 149) while this window is open.
 *
 * A CHILD that renders nothing, never a hook in App: App is mounted on the person's board while
 * the app runs, and a hook added to it breaks the order of its hooks under hot reload. The
 * handlers live in `clioAgent.ts`; this only keeps their view of the app fresh (a ref written
 * every render) and subscribes ONCE.
 *
 * Mounted with the header, so a single Clio serves from its one window and an exploded board
 * serves from its timeline window (the map and the panel follow through the sync).
 */
import { useEffect, useRef } from 'react';
import { inShell, sdk } from './host';
import { clioAgentHandlers, type ClioAgentContext } from './clioAgent';

export function ClioAgentActions(props: ClioAgentContext) {
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    // outside the shell nobody calls (a plain tab, the tests): no subscription, no timer
    if (!inShell()) return;
    if (typeof sdk.onAgentActions !== 'function') {
      // An iframe served an older SDK build: it must not take the window down.
      console.warn('[MnemoClio] this SDK build has no onAgentActions; reload the cartridge to serve agent actions');
      return undefined;
    }
    const sub = sdk.onAgentActions(clioAgentHandlers(() => latest.current));
    sub.ready.catch((err: unknown) => console.warn('[MnemoClio] agent actions not served:', err instanceof Error ? err.message : err));
    return () => sub.off();
  }, []);

  return null;
}
