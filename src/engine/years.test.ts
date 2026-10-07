import { afterEach, describe, expect, it } from 'vitest';
import { bucketYears, fey, fspan, fy, periodOf, setYearFormat } from './years';

afterEach(() => setYearFormat('{y} BC', 'c. {y}'));

describe('years', () => {
  it('writes a year before Christ in the language of the app, and a year after as a number', () => {
    expect(fy(1870)).toBe('1870');
    expect(fy(-44)).toBe('44 BC');
    setYearFormat('{y} av. J.-C.');
    expect(fy(-44)).toBe('44 av. J.-C.');
  });

  it('writes a span that crosses or sits before Christ with spaces, and an open end as ?', () => {
    expect(fspan(1861, 1865)).toBe('1861–1865');
    expect(fspan(-27, 14)).toBe('27 BC – 14');
    expect(fspan(1299, null)).toBe('1299–?');
    expect(fspan(2025, 2030, true)).toBe('2025–?');
  });

  it('widens the density bars as the zoom goes out, never under 5 px', () => {
    expect(bucketYears(2)).toBe(10);
    expect(bucketYears(0.3)).toBe(25);
    expect(bucketYears(0.01)).toBe(500);
    for (const px of [5, 1, 0.2, 0.05]) expect(bucketYears(px) * px).toBeGreaterThanOrEqual(5);
  });

  it('a moment is a decade in modern times and a century in Antiquity, aligned on round years', () => {
    expect(periodOf(1874)).toEqual({ start: 1870, size: 10 });
    expect(periodOf(1066)).toEqual({ start: 1050, size: 50 });
    // Math.floor rounds BC years down, so 44 BC falls in the century -100..-1
    expect(periodOf(-44)).toEqual({ start: -100, size: 100 });
  });

  it('writes a date known only to the century with c. / v., and an exact one as it is', () => {
    expect(fey({ y: -400, a: true })).toBe('c. 400 BC');
    expect(fey({ y: -427 })).toBe('427 BC');
    setYearFormat('{y} av. J.-C.', 'v. {y}');
    expect(fey({ y: -400, a: true })).toBe('v. 400 av. J.-C.');
    expect(fey({ y: 1870, a: false })).toBe('1870');
  });
});
