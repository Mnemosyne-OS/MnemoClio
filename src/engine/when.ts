/**
 * when.ts — reading a moment typed in the search box: "va à la Révolution française",
 * "XVe siècle", "1789 à 1799", "44 av. J.-C.", "the 1960s".
 *
 * Field, 07/10: "ask for an event or a period and the map centres on it". No model: a year, a
 * range, a century or a decade is read here, in the seven languages of the app; a NAME is left
 * to the search, which already knows every event, war, regime and period by name. A leading
 * "go to" is taken off first, so "va à la Révolution française" searches "Révolution française".
 *
 * Years are historical (Wikidata's): no year 0, 44 BC is -44, the 15th century is 1401–1500.
 */
import { BOUNDS, CENTRE } from './view';

export type WhenKind = 'year' | 'range' | 'century' | 'decade';
/** A moment read in the text: the first and last years, both included. */
export interface When { kind: WhenKind; a: number; b: number }
export interface Asked {
  /** The text folded, with the "go to" and the article taken off: what the name search looks for. */
  rest: string;
  /** The moment the text names, or null when it names none. */
  when: When | null;
  /** The text names a moment, but outside the timeline (before 3600 BC, after 2025). */
  outside: boolean;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// "go to" in the seven languages, folded; longest first so "va a la" never stops at "va".
const VERBS = [
  'emmene-moi a', 'emmene moi a', 'montre-moi', 'montre moi', 'allons a', 'aller a', 'vas a', 'va a', 'allons', 'aller', 'vas', 'va', 'montre',
  'take me to', 'jump to', 'show me', 'go to', 'show',
  'llevame a', 'muestrame', 'vamos a', 've a', 'ir a',
  'springe zu', 'gehe zu', 'geh zu', 'zeig mir', 'zeige',
  'vai para', 'va para', 'ir para', 'mostre', 'mostra',
  'перейти к', 'перейди к', 'покажи',
  '跳到', '转到', '显示', '去',
].sort((x, y) => y.length - x.length);
// what may follow the verb: French contractions, articles
const LINKS = ['a la ', "a l'", 'aux ', 'au ', 'en ', 'a ', 'la ', 'le ', 'les ', "l'", 'the ', 'el ', 'los ', 'las ', 'die ', 'der ', 'das ', 'zur ', 'zum ', 'o ', 'os ', 'as '];

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };
function roman(s: string): number | null {
  if (!/^[ivxlc]+$/.test(s)) return null;
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]], next = ROMAN[s[i + 1]] ?? 0;
    n += v < next ? -v : v;
  }
  return n;
}
const ordinal = (s: string): number | null => (/^\d{1,2}$/.test(s) ? Number(s) : roman(s));

// "before Christ" written seven ways (folded); the text is read without it, then mirrored
const BC = /(?:^|\s)(?:av\.? ?j\.?-? ?c\.?|avant j\.?-? ?c\.?|avant notre ere|bce|b\.?c\.?|a\. ?de ?c\.?|a\.? ?c\.?|v\. ?chr\.?|vor christus|до н\.? ?э\.?)(?=\s|$)|公元前/;

const CENTURY_WORD = '(?:siecle|s\\.|century|siglo|seculo|jahrhundert|век|世纪)';

export function parseWhen(text: string): Asked {
  let f = fold(text);
  // take the "go to" and the article off (the name search folds the same way)
  for (const v of VERBS) {
    if (f.startsWith(v + ' ')) { f = f.slice(v.length + 1).trim(); break; }
    // Chinese writes no space after the verb
    if (/^[一-鿿]+$/.test(v) && f.startsWith(v) && f.length > v.length) { f = f.slice(v.length).trim(); break; }
  }
  for (const l of LINKS) if (f.startsWith(l) && f.length > l.length) { f = f.slice(l.length).trim(); break; }
  const rest = f;

  let bc = false;
  let g = f;
  const m = BC.exec(g);
  if (m) { bc = true; g = (g.slice(0, m.index) + ' ' + g.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); }
  const when = read(g, bc);
  if (!when) return { rest, when: null, outside: false };
  // a moment wholly past either end of the timeline is named, and refused
  if (when.b < BOUNDS.min || when.a > CENTRE.max) return { rest, when: null, outside: true };
  return { rest, when: { ...when, a: Math.max(BOUNDS.min, when.a), b: Math.min(CENTRE.max, when.b) }, outside: false };
}

function read(g: string, bc: boolean): When | null {
  const year = (s: string): number | null => {
    const n = Number(s);
    if (!Number.isInteger(n) || n === 0) return null;
    return bc && n > 0 ? -n : n;
  };
  let m: RegExpExecArray | null;
  // a century: "XVe siècle", "15e siècle", "15th century", "siglo XV", "XV. Jahrhundert", "XV век", "15世纪"
  m = new RegExp(`^([ivxlc]+|\\d{1,2})(?:e|eme|er|re|th|st|nd|rd|\\.|°|º|-?й)? ?${CENTURY_WORD}$`).exec(g)
    ?? new RegExp(`^(?:siglo|seculo) ([ivxlc]+|\\d{1,2})$`).exec(g);
  if (m) {
    const n = ordinal(m[1]);
    if (!n || n > 40) return null;
    return bc ? { kind: 'century', a: -n * 100, b: -((n - 1) * 100 + 1) } : { kind: 'century', a: (n - 1) * 100 + 1, b: n * 100 };
  }
  // a decade: "années 1960", "los años 1960", "the 1960s", "1960er", "1960-е", "1960年代"
  m = /^(?:annees|(?:los )?anos|decada de) (\d{3,4})$/.exec(g) ?? /^(\d{3,4})(?:s|er(?: jahre)?|-?е(?: годы)?|年代)$/.exec(g);
  if (m && !bc) {
    const d = Number(m[1]);
    return d % 10 === 0 ? { kind: 'decade', a: d, b: d + 9 } : null;
  }
  // a range: "1789-1799", "1789 à 1799", "from 1789 to 1799", "500 à 400 av. J.-C."
  m = /^(?:de |from |von |desde |от )?(-?\d{1,4}) ?(?:-|–|—|a|to|bis|ate|до|到|~|et|and|y|und|e) ?(-?\d{1,4})(?: ?年)?$/.exec(g);
  if (m) {
    const a = year(m[1]), b = year(m[2]);
    if (a === null || b === null || a === b) return null;
    return { kind: 'range', a: Math.min(a, b), b: Math.max(a, b) };
  }
  // a year: "1789", "-44", "44 av. J.-C.", "1789年"
  m = /^(?:(?:en|in|en el|im jahr|em|в) )?(-?\d{1,4})(?: ?(?:年|год|г\.))?$/.exec(g);
  if (m) {
    const y = year(m[1]);
    return y === null ? null : { kind: 'year', a: y, b: y };
  }
  return null;
}
