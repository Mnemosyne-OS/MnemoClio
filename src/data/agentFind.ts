/**
 * agentFind — an event, a war, a regime, a period or a ruler named the way a person says it
 * (doc 149 §19). The orb plans a spoken sentence in ONE model call and never reads Clio first,
 * so « montre la Révolution française » reaches an action with the words « Révolution
 * française », never a Q id. An id still works (other agents call `search` first).
 *
 * Copied from Vitrine Studio's `data/agentFind.ts` (cartridges never import each other), the
 * fillers adapted: only articles and prepositions here, since « guerre », « bataille »,
 * « empire » are words of a name in history.
 *
 * 🚨 Several matches are REFUSED with their names (AMBIGUOUS), never the first one taken: the
 *    refusal is what the orb's second planner call reads to pick the right one. No match is
 *    refused with the names that exist.
 *
 * @module data/agentFind
 */

/** Lower case, accents off, œ/æ spelled out. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
}

/**
 * Words that carry no name: articles and prepositions in the app's first languages.
 * 🪤 Matched BEFORE the accents come off, as in Vitrine: folded, a filler could swallow a word.
 */
const FILLER = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'et', 'en', 'au', 'aux', 'à',
  'the', 'a', 'an', 'of', 'and',
  'el', 'los', 'las', 'del', 'y',
  'der', 'die', 'das', 'von',
]);

/** The words of a name, folded, fillers out, a plural « s »/« x » off so « croisades » finds « croisade ». */
export function nameWords(s: string): string[] {
  return s.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !FILLER.has(w))
    .map((w) => fold(w))
    .map((w) => (w.length > 3 ? w.replace(/[sx]$/, '') : w));
}

export interface Named<T> { item: T; id: string; names: string[]; label: string }

const LIST_MAX = 12;
export const listed = (labels: string[]): string => {
  const unique = [...new Set(labels)];
  return unique.length > LIST_MAX ? `${unique.slice(0, LIST_MAX).join(', ')} (+${unique.length - LIST_MAX})` : unique.join(', ');
};

/**
 * The one item `ref` names: its id; else the item whose whole name is `ref`; else the item whose
 * words hold every word of `ref`. `kind` names the error (NO_ITEM…) and the noun said.
 */
export function findNamed<T>(entries: ReadonlyArray<Named<T>>, ref: string, kind: { code: string; noun: string }): T {
  const raw = ref.trim();
  if (!raw) throw new Error(`BAD_ARG: name the ${kind.noun}`);
  const byId = entries.find((e) => e.id === raw);
  if (byId) return byId.item;
  const asked = nameWords(raw);
  const all = entries.map((e) => e.label);
  if (!asked.length) throw new Error(`${kind.code}: "${raw}" names no ${kind.noun}; ${kind.noun}s: ${listed(all) || 'none'}`);
  // The whole name said as written wins over a partial match (« Empire » against « Empire allemand »).
  const whole = entries.filter((e) => e.names.some((n) => nameWords(n).join(' ') === asked.join(' ')));
  if (whole.length === 1) return whole[0]!.item;
  if (whole.length > 1) throw new Error(`AMBIGUOUS: "${raw}" names several ${kind.noun}s: ${listed(whole.map((e) => e.label))}; say which`);
  const hits = entries.filter((e) => {
    const have = new Set(e.names.flatMap(nameWords));
    return asked.every((w) => have.has(w));
  });
  if (hits.length === 1) return hits[0]!.item;
  if (hits.length > 1) throw new Error(`AMBIGUOUS: "${raw}" names several ${kind.noun}s: ${listed(hits.map((e) => e.label))}; say which`);
  throw new Error(`${kind.code}: no ${kind.noun} named "${raw}"; ${kind.noun}s: ${listed(all) || 'none'}`);
}
