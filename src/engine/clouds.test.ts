import { describe, expect, it } from 'vitest';
import type { Battle, Period, War } from '../data/types';
import { MAX_BLOBS, hueOf, rootsOf, warClouds } from './clouds';

const bt = (y: number, lon: number | null, lat: number | null): Battle => ({ o: 'b', ol: 'en', f: null, y, c: 'Q1', lon, lat, g: null });
const war = (id: string, s: number, e: number, b: Battle[]): War => ({ id, o: id, ol: 'en', f: null, c: 'Q1', s, e, groups: {}, b });
const period = (id: string, kids: string[]): Period => ({ id, o: id, ol: 'en', f: null, s: 0, e: 0, kids, alsoWar: true });

describe('warClouds: where a war is felt', () => {
  it('a battle of the cursor year weighs fully, an older one fades, a future one is not there', () => {
    const w = war('W', 1940, 1945, [bt(1940, 10, 50), bt(1942, 20, 50), bt(1944, 30, 50)]);
    const [c] = warClouds([w], new Map(), 1942.5, 2);
    expect(c!.blobs.map((b) => b.lon)).toEqual([10, 20]);
    expect(c!.blobs[1]!.w).toBe(1);
    expect(c!.blobs[0]!.w).toBeCloseTo(Math.exp(-1.5 / 2), 6);
  });

  it('past the horizon a battle is gone, and a war with nothing left has no cloud', () => {
    const w = war('W', 1914, 1918, [bt(1914, 10, 50)]);
    expect(warClouds([w], new Map(), 1930, 2)).toEqual([]);
  });

  it('a battle with no place is never drawn', () => {
    const w = war('W', 1940, 1945, [bt(1940, null, null)]);
    expect(warClouds([w], new Map(), 1940, 2)).toEqual([]);
  });

  it('a front joins the world war that lists it: one cloud, one colour, the strongest first', () => {
    const roots = rootsOf([period('WW2', ['EAST'])]);
    const ww2 = war('WW2', 1939, 1945, [bt(1941, 0, 50)]);
    const east = war('EAST', 1941, 1945, [bt(1941, 40, 50), bt(1941, 30, 50)]);
    const other = war('X', 1941, 1941, [bt(1941, -100, 20)]);
    const cs = warClouds([ww2, east, other], roots, 1941.5, 2);
    expect(cs.map((c) => c.id)).toEqual(['WW2', 'X']);
    expect(cs[0]!.blobs.length).toBe(3);
    expect(cs[0]!.hue).toBe(hueOf('WW2'));
  });

  it('a nested front climbs to the top, and a loop in the data does not hang', () => {
    const roots = rootsOf([period('A', ['B']), period('B', ['C', 'A'])]);
    expect(roots.get('C')).toBeDefined();
  });

  it('too many battles: the most recent are kept', () => {
    const many = Array.from({ length: MAX_BLOBS + 50 }, (_, i) => bt(i < 50 ? 1940 : 1942, 0, 0));
    const [c] = warClouds([war('W', 1940, 1942, many)], new Map(), 1942, 5);
    expect(c!.blobs.length).toBe(MAX_BLOBS);
    expect(c!.blobs.every((b) => b.w === 1)).toBe(true);
  });

  it('the name is written where the war is felt most, not between two far fronts', () => {
    const w = war('W', 1940, 1945, [bt(1942, 10, 50), bt(1942, 12, 52), bt(1942, 14, 51), bt(1942, 150, 0)]);
    const [c] = warClouds([w], new Map(), 1942, 2);
    expect(c!.lon).toBeCloseTo(12, 6);
    expect(c!.lat).toBeCloseTo(51, 6);
  });

  it('the colour of a war is the same every time', () => {
    expect(hueOf('Q362')).toBe(hueOf('Q362'));
    expect(hueOf('Q362')).not.toBe(hueOf('Q361'));
  });
});
