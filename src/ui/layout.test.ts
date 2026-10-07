import { afterEach, describe, expect, it } from 'vitest';
import { LAYOUTS, clampLayout, readLayout, saveLayout } from './layout';

afterEach(() => { localStorage.clear(); });

describe('layout', () => {
  it('a splitter cannot squeeze the timeline or the map to nothing', () => {
    expect(clampLayout({ timeline: 0.01, map: 0.99 })).toEqual({ timeline: 0.2, map: 0.85 });
  });

  it('remembers the chosen layout in this browser', () => {
    saveLayout(LAYOUTS.map);
    expect(readLayout()).toEqual(LAYOUTS.map);
  });

  it('an unreadable or absent value gives the balanced layout, never NaN', () => {
    expect(readLayout()).toEqual(LAYOUTS.balanced);
    localStorage.setItem('mnemo-clio.layout', '{"timeline":"x"}');
    expect(readLayout()).toEqual({ timeline: LAYOUTS.balanced.timeline, map: LAYOUTS.balanced.map });
    localStorage.setItem('mnemo-clio.layout', 'not json');
    expect(readLayout()).toEqual(LAYOUTS.balanced);
  });

  it('the map preset gives the map most of the room', () => {
    expect(LAYOUTS.map.timeline).toBeLessThan(LAYOUTS.balanced.timeline);
    expect(LAYOUTS.map.map).toBeGreaterThan(LAYOUTS.balanced.map);
  });
});
