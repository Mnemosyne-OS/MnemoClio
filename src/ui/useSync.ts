/**
 * useSync.ts — this window's moment and choices, shared with MnemoClio's other windows (sync.ts).
 *
 * Only inside the shell or in a window opened as one view (`?widget=`): a test or a plain tab of
 * the single view stays alone, so two test files never talk to each other through the channel.
 *
 * 🚨 The echo guard for choices: a peer's choices are remembered by their key BEFORE they are
 * applied, and this window's choices go out only when their key differs from the last one sent
 * or received. Without it, applying A's choices in B made B send them back, and so on.
 */
import { useEffect, useRef, useState } from 'react';
import type { Scene } from '../engine/scene';
import { inShell } from './host';
import { broadcastPort, choicesKey, linkWindows, type Choices } from './sync';

export function useSync(scene: Scene, choices: Choices | null, apply: (c: Choices) => void, solo: boolean): void {
  const choicesRef = useRef(choices);
  choicesRef.current = choices;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const lastKey = useRef<string | null>(null);
  const linkRef = useRef<ReturnType<typeof linkWindows> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!inShell() && !solo) return;
    const port = broadcastPort();
    if (!port) { console.warn('[MnemoClio] no BroadcastChannel here: this window stands alone'); return; }
    const link = linkWindows(scene, port, {
      choices: () => choicesRef.current,
      onChoices: (c) => { lastKey.current = choicesKey(c); applyRef.current(c); },
      onReady: () => setReady(true),
    });
    linkRef.current = link;
    return () => { link.unlink(); linkRef.current = null; setReady(false); };
  }, [scene, solo]);

  const key = choices ? choicesKey(choices) : null;
  useEffect(() => {
    if (!ready || !key || !choicesRef.current || key === lastKey.current) return;
    lastKey.current = key;
    linkRef.current?.sendChoices(choicesRef.current);
  }, [ready, key]);
}
