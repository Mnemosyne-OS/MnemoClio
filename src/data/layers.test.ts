import { describe, expect, it } from 'vitest';
import { isOn, only, toggled, type LayerState } from './layers';
import type { Kind } from './types';

const all: LayerState = { wars: true, clouds: true, leaders: true, epi: true, rel: false, kinds: new Set<Kind>(['person', 'work']) };

describe('layers', () => {
  it('« only » leaves one layer on, every other off', () => {
    const s = only(all, 'epi', all.kinds);
    expect([isOn(s, 'epi'), isOn(s, 'wars'), isOn(s, 'leaders'), isOn(s, 'rel'), isOn(s, 'events')]).toEqual([true, false, false, false, false]);
  });

  it('Events off keeps its subjects to give them back as they were', () => {
    const off = toggled(all, 'events', all.kinds);
    expect(off.kinds.size).toBe(0);
    expect([...toggled(off, 'events', all.kinds).kinds].sort()).toEqual(['person', 'work']);
  });

  it('« only events » with no subject remembered brings every subject', () => {
    const none = { ...all, kinds: new Set<Kind>() };
    expect(only(none, 'events', new Set()).kinds.size).toBeGreaterThan(10);
  });

  it('switching one layer touches no other', () => {
    const s = toggled(all, 'rel', all.kinds);
    expect([s.rel, s.wars, s.epi, s.kinds.size]).toEqual([true, true, true, 2]);
  });
});
