import { describe, expect, it } from 'vitest';
import { completeTheme, type Theme } from './theme';

describe('completeTheme', () => {
  it('🚨 a theme made before a field existed still gives every colour (a missing one repainted the lane)', () => {
    // the shape of a theme object kept across a hot reload, from before the canvas colours moved in
    const old = { bg: '#141416', panel: '#161619', text: '#f2eee9', muted: '#888', line: '#222', accent: '#8b7cff', dark: true, l: 64 } as Partial<Theme>;
    const th = completeTheme(old);
    for (const k of ['ocean', 'land', 'border', 'onAccent', 'laneTint'] as const) expect(typeof th[k]).toBe('string');
    // the lane's tint is a faint veil, never the text colour that a stale fillStyle painted
    expect(th.laneTint).not.toBe(old.text);
    expect(th.laneTint).toMatch(/^rgba\(/);
  });

  it('what the theme has is kept as it is', () => {
    const th = completeTheme({ dark: false, laneTint: 'red', bg: '#fff' });
    expect([th.laneTint, th.bg, th.l]).toEqual(['red', '#fff', 42]);
  });
});
