import { describe, expect, it } from 'vitest';
import { placeLabels, rowOf } from './labels';
import { layoutLanes, packRows } from './lanes';

describe('labels', () => {
  it('the best known is written first; an overlapping name goes to another row', () => {
    const placed = placeLabels([
      { id: 'small', x: 10, width: 100, prio: 1 },
      { id: 'big', x: 20, width: 100, prio: 99 },
    ], 2, 500);
    expect(placed.find((p) => p.id === 'big')!.row).toBe(0);
    expect(placed.find((p) => p.id === 'small')!.row).toBe(1);
  });

  it('a name that fits nowhere is left out, never drawn over another', () => {
    const placed = placeLabels([
      { id: 'a', x: 0, width: 100, prio: 3 },
      { id: 'b', x: 10, width: 100, prio: 2 },
      { id: 'c', x: 20, width: 100, prio: 1 },
    ], 2, 500);
    expect(placed.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('a name running past the lane is not written', () => {
    expect(placeLabels([{ id: 'a', x: 450, width: 100, prio: 1 }], 1, 500)).toEqual([]);
  });

  it('gives the same answer for the same input, so names do not jump while the view is still', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ id: 'e' + i, x: (i * 37) % 400, width: 60, prio: i % 7 }));
    expect(placeLabels(items, 3, 500)).toEqual(placeLabels([...items].reverse(), 3, 500));
  });

  it('spreads ids over rows deterministically', () => {
    expect(rowOf('Q42', 5)).toBe(rowOf('Q42', 5));
    const rows = new Set(Array.from({ length: 200 }, (_, i) => rowOf('Q' + i, 5)));
    expect(rows.size).toBe(5);
  });
});

describe('lanes', () => {
  it('packs overlapping regimes on separate rows, and a follower on the same row', () => {
    const a = { s: 1800, e: 1850 }, b = { s: 1820, e: 1830 }, c = { s: 1850, e: 1900 };
    const rows = new Map();
    expect(packRows([a, b, c], rows)).toBe(2);
    expect(rows.get(c)).toBe(rows.get(a));
  });

  it('zooming in opens the lanes: names need more room than a density bar', () => {
    const specs = [{ key: 'Q142', kind: 'country' as const, bandRows: 1, hasWars: true, hasEvents: true }];
    expect(layoutLanes(specs, 'labels').height).toBeGreaterThan(layoutLanes(specs, 'density').height);
  });

  it('a lane without events or wars still has room for its name', () => {
    const { lanes } = layoutLanes([{ key: 'x', kind: 'country', bandRows: 0, hasWars: false, hasEvents: false }], 'dots');
    expect(lanes[0]!.h).toBeGreaterThanOrEqual(34);
  });
});
