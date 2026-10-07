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
}

const FALLBACK = { bg: '#07090d', panel: '#10141c', text: '#e6e8ee', muted: '#8a93a6', line: '#232a37', accent: '#8b7cff' };

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
