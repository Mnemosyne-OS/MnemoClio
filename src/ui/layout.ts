/**
 * layout.ts — how the window is shared: the timeline's share of the height, the map's share
 * of the bottom row. Three presets and two splitters; the choice is remembered in this
 * browser (a convenience: unreadable storage simply gives the balanced layout).
 */

export interface Layout {
  /** Share of the height given to the timeline, 0.2..0.85. */
  timeline: number;
  /** Share of the bottom row given to the map, 0.25..0.85. */
  map: number;
}

export const LAYOUTS = {
  timeline: { timeline: 0.7, map: 0.55 },
  balanced: { timeline: 0.5, map: 0.6 },
  map: { timeline: 0.28, map: 0.74 },
} as const satisfies Record<string, Layout>;

const KEY = 'mnemo-clio.layout';

export function clampLayout(l: Layout): Layout {
  const c = (v: number, lo: number, hi: number, fb: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);
  return { timeline: c(l.timeline, 0.2, 0.85, LAYOUTS.balanced.timeline), map: c(l.map, 0.25, 0.85, LAYOUTS.balanced.map) };
}

export function readLayout(): Layout {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return LAYOUTS.balanced;
    const v = JSON.parse(raw) as Partial<Layout>;
    return clampLayout({ timeline: Number(v.timeline), map: Number(v.map) });
  } catch (e) {
    console.warn('[MnemoClio] layout not readable, balanced layout used', e);
    return LAYOUTS.balanced;
  }
}

export function saveLayout(l: Layout): void {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { console.warn('[MnemoClio] layout not saved', e); }
}
