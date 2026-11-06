/**
 * picked.ts — what the person clicked in MnemoClio: an event, a war, a regime, a period, a
 * decade or a leader. History's own vocabulary, so it stays in the cartridge; the shared
 * scene (`@mnemosyne_os/timeline-map/scene`) never reads it.
 */
export type Picked =
  | { type: 'event'; q: string }
  | { type: 'war'; id: string }
  | { type: 'regime'; id: string; c: string }
  | { type: 'period'; id: string }
  | { type: 'decade'; key: string; decade: number; size?: number }
  | { type: 'leader'; q: string; of: number; s: number };
