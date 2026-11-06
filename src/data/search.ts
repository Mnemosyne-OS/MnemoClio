/**
 * search.ts — finding things in MnemoClio's history by name: the search box under the header and
 * an agent's `search` (doc 149) read the SAME function, so an agent never finds what the person
 * cannot, nor the reverse. Pure, out of App.tsx.
 */
import type { Country, Ev, History, Named } from './types';

/** Accents off, lower case: how every name is compared. */
export const fold = (s: string | null | undefined): string => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface NameResults {
  events: Ev[];
  wars: History['wars'];
  regimes: History['regimes'];
  leaders: History['leaders'];
  periods: History['periods'];
}

/**
 * What a folded text names: events (best known first, each once), wars, regimes, leaders,
 * periods. Null under two characters, as the box offers nothing there.
 */
export function findByName(f: string, all: readonly Ev[], history: History): NameResults | null {
  if (f.length < 2) return null;
  const hit = (x: Named) => fold(x.o).includes(f) || fold(x.f).includes(f);
  // one item can sit in two subjects (a person who is also a discovery): offered once
  const seen = new Set<string>();
  return {
    events: all.filter(hit).sort((a, b) => b.sl - a.sl).filter((e) => !seen.has(e.q) && !!seen.add(e.q)).slice(0, 10),
    wars: history.wars.filter(hit).slice(0, 4),
    regimes: history.regimes.filter(hit).slice(0, 4),
    leaders: history.leaders.filter(hit).sort((a, b) => b.sl - a.sl).slice(0, 5),
    periods: history.periods.filter(hit).slice(0, 4),
  };
}

/** Does a country answer to this folded text (its own name, the French one, the English one)? */
export const countryMatches = (c: Country, f: string): boolean => fold(c.o).includes(f) || fold(c.f).includes(f) || fold(c.en).includes(f);
