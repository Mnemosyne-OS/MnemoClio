/**
 * theme.ts — the host's colours, read for the canvas.
 *
 * A canvas cannot use `var(--…)`, so the values the shell broadcasts (onHostConfig writes them
 * on :root) are read here and handed to the drawing code. Outside the shell nothing is set,
 * and the fallbacks are a dark theme close to the shell's own default.
 */

export interface Theme {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  dark: boolean;
  /** Lightness to draw subject and country hues at, so they read on this background. */
  l: number;
  /** The map's sea, unclaimed land and borders; text on an accent pill; a lane's faint band. */
  ocean: string;
  land: string;
  border: string;
  onAccent: string;
  laneTint: string;
}

/** The canvas colours the shell does not broadcast, per mode; a page may set --clio-ocean etc. to change them. */
const CANVAS = {
  dark: { ocean: '#0b1220', land: '#1b2333', border: 'rgba(255,255,255,0.12)', onAccent: '#0b0d12', laneTint: 'rgba(255,255,255,0.025)' },
  light: { ocean: '#dfe8f3', land: '#f5f2ea', border: 'rgba(0,0,0,0.18)', onAccent: '#ffffff', laneTint: 'rgba(0,0,0,0.025)' },
};

const FALLBACK = { bg: '#07090d', panel: '#10141c', text: '#e6e8ee', muted: '#8a93a6', line: '#232a37', accent: '#8b7cff' };

/**
 * A theme with every field, whatever it was made from. 🪤 A canvas whose `fillStyle` is set to
 * `undefined` KEEPS the previous colour: a theme object made before a field existed (kept across a
 * hot reload, or sent by an older host) painted the whole timeline lane with the last colour used —
 * the gutter's white text, or the last dot's violet or green, flashing as it played (field, 07/10).
 * The canvases draw with this, never with the raw object.
 */
export function completeTheme(t: Partial<Theme>): Theme {
  const dark = t.dark ?? true;
  const k = CANVAS[dark ? 'dark' : 'light'];
  return {
    bg: t.bg ?? FALLBACK.bg, panel: t.panel ?? FALLBACK.panel, text: t.text ?? FALLBACK.text, muted: t.muted ?? FALLBACK.muted,
    line: t.line ?? FALLBACK.line, accent: t.accent ?? FALLBACK.accent, dark, l: t.l ?? (dark ? 64 : 42),
    ocean: t.ocean ?? k.ocean, land: t.land ?? k.land, border: t.border ?? k.border, onAccent: t.onAccent ?? k.onAccent, laneTint: t.laneTint ?? k.laneTint,
  };
}

/** The host's colours (and the canvas's own, per mode), read now: called again when the shell changes theme. */
export function readTheme(el: Element = document.documentElement): Theme {
  const css = getComputedStyle(el);
  const v = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
  const bg = v('--bg-void', FALLBACK.bg);
  const dark = luminance(bg) < 0.5;
  return {
    bg,
    panel: v('--bg-panel', FALLBACK.panel),
    text: v('--text-primary', FALLBACK.text),
    muted: v('--text-muted', FALLBACK.muted),
    line: v('--border-subtle', FALLBACK.line),
    accent: v('--accent', FALLBACK.accent),
    dark,
    l: dark ? 64 : 42,
    ocean: v('--clio-ocean', CANVAS[dark ? 'dark' : 'light'].ocean),
    land: v('--clio-land', CANVAS[dark ? 'dark' : 'light'].land),
    border: v('--clio-border', CANVAS[dark ? 'dark' : 'light'].border),
    onAccent: v('--clio-on-accent', CANVAS[dark ? 'dark' : 'light'].onAccent),
    laneTint: v('--clio-lane-tint', CANVAS[dark ? 'dark' : 'light'].laneTint),
  };
}

/** 0 (black) .. 1 (white) for #rgb, #rrggbb and rgb()/rgba(); anything unreadable counts as dark. */
export function luminance(color: string): number {
  let r = 0, g = 0, b = 0;
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split('').map((c) => c + c).join('') : hex[1]!;
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = color.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    if (!m) return 0;
    r = +m[1]!; g = +m[2]!; b = +m[3]!;
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
