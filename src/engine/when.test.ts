import { describe, expect, it } from 'vitest';
import { parseWhen } from './when';

const w = (s: string) => parseWhen(s).when;

describe('parseWhen: the moment a text names', () => {
  it('a year, after Christ and before', () => {
    expect(w('1789')).toEqual({ kind: 'year', a: 1789, b: 1789 });
    expect(w('-44')).toEqual({ kind: 'year', a: -44, b: -44 });
    expect(w('44 av. J.-C.')).toEqual({ kind: 'year', a: -44, b: -44 });
    expect(w('44 BC')).toEqual({ kind: 'year', a: -44, b: -44 });
    expect(w('44 a. C.')).toEqual({ kind: 'year', a: -44, b: -44 });
    expect(w('44 v. Chr.')).toEqual({ kind: 'year', a: -44, b: -44 });
    expect(w('44 до н. э.')).toEqual({ kind: 'year', a: -44, b: -44 });
    expect(w('公元前44年')).toEqual({ kind: 'year', a: -44, b: -44 });
    expect(w('en 1492')).toEqual({ kind: 'year', a: 1492, b: 1492 });
  });

  it('there is no year 0', () => {
    expect(w('0')).toBeNull();
  });

  it('a century: 1401–1500 is the 15th, mirrored before Christ', () => {
    expect(w('XVe siècle')).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(w('15e siècle')).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(w('XVème siècle')).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(w('15th century')).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(w('siglo XV')).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(w('século XV')).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(w('15. Jahrhundert')).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(w('XV век')).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(w('15世纪')).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(w('Ier siècle')).toEqual({ kind: 'century', a: 1, b: 100 });
    expect(w('Ve siècle av. J.-C.')).toEqual({ kind: 'century', a: -500, b: -401 });
    expect(w('5th century BC')).toEqual({ kind: 'century', a: -500, b: -401 });
  });

  it('a decade', () => {
    expect(w('années 1960')).toEqual({ kind: 'decade', a: 1960, b: 1969 });
    expect(w('the 1960s')).toEqual({ kind: 'decade', a: 1960, b: 1969 });
    expect(w('los años 1960')).toEqual({ kind: 'decade', a: 1960, b: 1969 });
    expect(w('1960er')).toEqual({ kind: 'decade', a: 1960, b: 1969 });
    expect(w('1960年代')).toEqual({ kind: 'decade', a: 1960, b: 1969 });
  });

  it('a decade must start on a ten', () => {
    expect(w('1965s')).toBeNull();
  });

  it('a range, in either order, BC on both ends', () => {
    expect(w('1789-1799')).toEqual({ kind: 'range', a: 1789, b: 1799 });
    expect(w('1789 à 1799')).toEqual({ kind: 'range', a: 1789, b: 1799 });
    expect(w('from 1914 to 1918')).toEqual({ kind: 'range', a: 1914, b: 1918 });
    expect(w('de 1939 a 1945')).toEqual({ kind: 'range', a: 1939, b: 1945 });
    expect(w('1918 – 1914')).toEqual({ kind: 'range', a: 1914, b: 1918 });
    expect(w('500 à 400 av. J.-C.')).toEqual({ kind: 'range', a: -500, b: -400 });
  });

  it('the "go to" and the article are taken off: the name is left to the search', () => {
    expect(parseWhen('va à la Révolution française')).toEqual({ rest: 'revolution francaise', when: null, outside: false });
    expect(parseWhen('go to the French Revolution').rest).toBe('french revolution');
    expect(parseWhen('ve a la Revolución francesa').rest).toBe('revolucion francesa');
    expect(parseWhen('va au XVe siècle').when).toEqual({ kind: 'century', a: 1401, b: 1500 });
    expect(parseWhen('去1789').when).toEqual({ kind: 'year', a: 1789, b: 1789 });
  });

  it('a name is not a moment', () => {
    expect(w('Napoléon')).toBeNull();
    expect(w('Louis XIV')).toBeNull();
    expect(w('Apollo 11')).toBeNull();
  });

  it('a moment past either end of the timeline is named outside, and a range is cut to it', () => {
    expect(parseWhen('5000 av. J.-C.')).toEqual({ rest: '5000 av. j.-c.', when: null, outside: true });
    expect(parseWhen('2100').outside).toBe(true);
    expect(w('XXIe siècle')).toEqual({ kind: 'century', a: 2001, b: 2025 });
  });
});
