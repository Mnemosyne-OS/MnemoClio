/**
 * layers.ts — the five layers of MnemoClio and the two moves on them (switch one, keep only one).
 * Pure, out of the menu component (a .tsx with mixed exports reloads whole under Fast Refresh).
 */
import { KINDS, type Kind } from './types';

export type LayerId = 'wars' | 'leaders' | 'epi' | 'rel' | 'events';
export interface LayerState { wars: boolean; clouds: boolean; leaders: boolean; epi: boolean; rel: boolean; kinds: ReadonlySet<Kind> }

export const ICON: Record<LayerId, string> = { wars: '⚔', leaders: '👑', epi: '☣', rel: '✦', events: '📜' };
export const LAYER_ORDER: LayerId[] = ['events', 'wars', 'leaders', 'epi', 'rel'];

/** Is this layer on? Events is on while any subject is. */
export const isOn = (s: LayerState, id: LayerId): boolean => (id === 'events' ? s.kinds.size > 0 : s[id]);

/** The state with only `id` on (Events restores its subjects, or all of them). */
export function only(s: LayerState, id: LayerId, lastKinds: ReadonlySet<Kind>): LayerState {
  return {
    ...s,
    wars: id === 'wars', leaders: id === 'leaders', epi: id === 'epi', rel: id === 'rel',
    kinds: id === 'events' ? (s.kinds.size ? s.kinds : lastKinds.size ? lastKinds : new Set(KINDS)) : new Set(),
  };
}

/** One layer switched; Events off keeps its subjects to give them back. */
export function toggled(s: LayerState, id: LayerId, lastKinds: ReadonlySet<Kind>): LayerState {
  if (id === 'events') return { ...s, kinds: s.kinds.size ? new Set() : lastKinds.size ? lastKinds : new Set(KINDS) };
  return { ...s, [id]: !s[id] };
}

