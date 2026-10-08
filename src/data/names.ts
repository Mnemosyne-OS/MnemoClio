/**
 * names.ts — what a country, an event, a war or a person is called on screen.
 *
 * Field, 07/10: "if I am in Spanish I want the titles in my language, do it for everyone".
 * A country is always named in the app's language. Everything else follows the names toggle:
 * the original language, or the person's language when the data has a name in it. Never a
 * guessed translation: no name in that language = the original name.
 */
import type { Country, Named } from './types';

/** Wikidata's label in the app's language (French is the `f` every country already had), else English, else French, else the original. */
export function countryName(c: Pick<Country, 'o' | 'f' | 'en' | 'nl'>, lang: string, mapEnglish?: string | null): string {
  return (lang === 'fr' ? c.f : c.nl[lang]) ?? c.nl.en ?? mapEnglish ?? c.en ?? c.f ?? c.o;
}

/** The Wikidata id an item is known by (events, people, battles: `q`; wars, regimes, offices, periods: `id`). */
export function itemKey(x: Named): string | null {
  const r = x as Named & { q?: unknown; id?: unknown };
  return typeof r.q === 'string' ? r.q : typeof r.id === 'string' ? r.id : null;
}

/**
 * An item's name in the person's language, or null when the data has none. French is the `f`
 * every item carries; the other languages come from that language's file (names-<lang>.json),
 * once it is read.
 */
export function translatedName(x: Named, lang: string, names: ReadonlyMap<string, string> | null): string | null {
  if (lang === 'fr') return x.f;
  const k = itemKey(x);
  return k && names ? names.get(k) ?? null : null;
}
