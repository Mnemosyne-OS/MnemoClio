/**
 * types.ts — what MnemoClio knows, once decoded from public/data.
 *
 * Every name keeps the language of its country (`o`, written in `ol`). The French label `f`
 * is only what Wikidata already holds (a `mul` label counts: it is valid in every language);
 * `null` means Wikidata has none, never that the thing has no name.
 */

export const KINDS = [
  'person', 'discovery', 'work', 'knowledge', 'building', 'treaty',
  'disaster', 'exploration', 'society', 'movement', 'sport',
  'subdivision', 'election', 'law', 'city', 'company', 'violence',
] as const;
export type Kind = (typeof KINDS)[number];

export interface Named {
  o: string;
  ol: string;
  f: string | null;
}

export interface Country extends Named {
  id: string;
  lang: string | null;
  /** Dated events Wikidata attaches to this country (wars, battles, revolutions, treaties, disasters). */
  n: number;
  /** Hue of the country's lane, stable for the life of the data. */
  h: number;
  /** The year the country exists from (Wikidata inception), null when Wikidata gives none. */
  s: number | null;
  /** 'state' = one of today's 197; 'ended' = a state that no longer exists; 'territory' = a dependent territory. */
  kind: 'state' | 'ended' | 'territory';
  /** The year an ended state ceased to exist, null for the others. */
  e: number | null;
  /** English name: the key to the era maps, whose names are in English. */
  en: string | null;
  /** Its name in each language of the app Wikidata has a label for (en, es, de, pt, ru, zh); French is `f`. */
  nl: Partial<Record<string, string>>;
}

export interface Ev extends Named {
  k: Kind;
  y: number;
  /** Current country it is attached to, or null when Wikidata names none we could resolve. */
  c: string | null;
  /** The ended state or territory Wikidata ties it to DIRECTLY (the Ottoman Empire), shown on that polity's own lane. */
  h: string | null;
  lon: number | null;
  lat: number | null;
  /** How many Wikipedias have an article on it: the measure of "known" used for every cap. */
  sl: number;
  sub: string | null;
  q: string;
  /** Known only to the decade or century (Antiquity): drawn at that year, written "c. 400 BC". */
  a?: boolean;
}

export interface Regime extends Named {
  id: string;
  c: string;
  s: number;
  e: number;
  /** No end and no successor in Wikidata: drawn faded, never presented as still running. */
  open: boolean;
  next: string | null;
  nl: Named | null;
}

export interface Battle extends Named {
  /** Wikidata id (data written from 07/10 on): the key to its name in another language. */
  q?: string;
  y: number;
  c: string;
  lon: number | null;
  lat: number | null;
  /** The front or campaign it belongs to, when that is not the war itself. */
  g: string | null;
}

export interface War extends Named {
  id: string;
  c: string;
  s: number;
  e: number;
  groups: Record<string, Named>;
  b: Battle[];
}

export interface Period extends Named {
  id: string;
  s: number;
  e: number;
  kids: string[];
  alsoWar: boolean;
}

/** A head of state or of government, one term. */
export interface Office extends Named { id: string; k: 'state' | 'gov' }
export interface Leader extends Named {
  /** Today's state the office belongs to, null when the polity that held it left no heir among them. */
  c: string | null;
  /** The ended state that held the office (the Ottoman Empire for a sultan), shown on its own lane. */
  h: string | null;
  /** Index into History.offices. */
  of: number;
  s: number;
  e: number;
  /** No end on Wikidata and no next holder: drawn faded, never "still in office". */
  open: boolean;
  q: string;
  sl: number;
}

export interface History {
  countries: Country[];
  regimes: Regime[];
  wars: War[];
  periods: Period[];
  leaders: Leader[];
  offices: Office[];
}

export interface MetaFile {
  file: string;
  what: string;
  count?: number;
  bytes: number;
  cap?: { kept: number; total: number; minSl: number } | null;
}

export interface Meta {
  readAt: string;
  source: string;
  countries: number;
  wars: number;
  regimes: number;
  files: MetaFile[];
}

/** Today's borders (Natural Earth): Wikidata id, English and French names, label point, rings. */
export interface WorldCountry {
  w: string;
  n: string;
  f: string;
  l: [number, number];
  r: number[][];
}
