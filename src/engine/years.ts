/**
 * years.ts — years before Christ, and how wide a "moment" is at each age.
 *
 * Wikidata counts years historically: -44 is 44 BC, and there is no year 0. The timeline is a
 * continuous axis (the missing year 0 is one year of width nobody can see); only the labels
 * change. A negative year reads "44 BC" in the app's language (setYearFormat, set by App).
 *
 * Antiquity is sparse: a decade of 300 BC holds almost nothing. So the panel's "moment" grows
 * with the distance (a decade from 1400, half a century from 500, a century before), and the
 * density bars of the timeline grow with the zoom.
 */

let bcTemplate = '{y} BC';
let aboutTemplate = 'c. {y}';

/** The app's way of writing a year before Christ ("{y} BC", "{y} av. J.-C.") and an approximate one ("c. {y}", "v. {y}"). */
export function setYearFormat(template: string, about?: string): void { bcTemplate = template; if (about) aboutTemplate = about; }

/** A year as a person reads it: 1870, or 44 BC. */
export const fy = (y: number): string => (y < 0 ? bcTemplate.replace('{y}', String(-y)) : String(y));

/** An event's year: exact (427 BC), or known only to the decade or century (c. 400 BC). */
export const fey = (e: { y: number; a?: boolean }): string => (e.a ? aboutTemplate.replace('{y}', fy(e.y)) : fy(e.y));

/** A span: 1861–1865, 27 BC – 14. */
export const fspan = (a: number, b: number | null | undefined, open = false): string =>
  `${fy(a)}${a < 0 || (b ?? 0) < 0 ? ' – ' : '–'}${open || b === null || b === undefined ? '?' : fy(b)}`;

/** The years one density bar covers at this zoom: the smallest that is at least 5 px wide. */
export function bucketYears(pxPerYear: number): number {
  for (const b of [10, 25, 50, 100, 250, 500]) if (b * pxPerYear >= 5) return b;
  return 1000;
}

/** The panel's moment around a year: a decade from 1400, fifty years from 500, a century before. */
export function periodOf(year: number): { start: number; size: number } {
  const size = year >= 1400 ? 10 : year >= 500 ? 50 : 100;
  return { start: Math.floor(year / size) * size, size };
}
