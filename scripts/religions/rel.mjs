// rel.mjs — where religions built, year by year, and when their currents were founded.
//
// Field, 07/10: "religious currents and beliefs, and their influence" — and "the Israel part, where
// I will be watched on how it is handled". The rule (doc 137 §5quaterdecies) governs this file:
// POINTS only, never a territory, never a country attached to a place; a place carrying several
// religions keeps them all; what is shown is the places of worship Wikidata KNOWS, not believers.
//
// ⛔ Not the "official religion" (P3075): 6 statements of 511 are dated, so a tint built on it
// would apply an undated value to all of history.
//
// Sources (Wikidata, CC0):
//  - places of worship (Q1370598 and its 1 271 subclasses), ≥ 5 Wikipedias, founding year
//    (P571, year precision at least), coordinates, religion (P140, every value), demolition (P576);
//  - a place with no P140 takes its religion from its CLASS only when the class says it (mosque →
//    Islam, synagogue → Judaism…), and the tooltip says it was inferred;
//  - each religion climbs to one of twelve families (or `other`, kept and counted, never dropped);
//  - currents: religions, denominations, movements with a founding year.
//
// Writes public/data/religions.json. Caches in scripts/religions/*.json.
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { sparql } from '../wikidata/ev/q2.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const UA = 'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)';
const pub = join(here, '..', '..', 'public', 'data');
const LANGS = ['en', 'fr', 'es', 'de', 'pt', 'ru', 'zh'];
const id = (u) => u.split('/').pop();
const yearOf = (iso) => { const m = /^([+-]?\d+)-/.exec(iso); if (!m) return null; const y = parseInt(m[1], 10); return y === 0 ? null : y; };

/** The twelve families, in a FIXED order (the legend never sorts by count). */
const FAMILIES = ['Q9268', 'Q5043', 'Q432', 'Q9089', 'Q748', 'Q9232', 'Q9316', 'Q9598', 'Q9581', 'Q812767', 'Q9601', 'Q22679'];
// Judaism, Christianity, Islam, Hinduism, Buddhism, Jainism, Sikhism, Taoism, Confucianism, Shinto, Zoroastrianism, Baháʼí
/** Classes that SAY their religion (a mosque is Islamic): used only when the place has no P140. */
const SAYS = { Q32815: 'Q432', Q34627: 'Q9268', Q16970: 'Q5043', Q5393308: 'Q748', Q842402: 'Q9089', Q275004: 'Q9316', Q845945: 'Q812767', Q1418063: 'Q9601', Q1371385: 'Q9598' };

const cache = (name) => join(here, name + '.json');
const readCache = (name) => (fs.existsSync(cache(name)) ? JSON.parse(fs.readFileSync(cache(name), 'utf8')) : null);
const writeCache = (name, v) => fs.writeFileSync(cache(name), JSON.stringify(v));

// 1. the classes of places of worship, and which of them say their religion
const classes = (await sparql(`SELECT ?c WHERE { ?c wdt:P279* wd:Q1370598 }`)).map((b) => id(b.c.value));
const saysRows = await sparql(`SELECT ?c ?k WHERE { VALUES ?k { ${Object.keys(SAYS).map((k) => 'wd:' + k).join(' ')} } ?c wdt:P279* ?k }`);
const classSays = new Map();
for (const b of saysRows) { const c = id(b.c.value), fam = SAYS[id(b.k.value)]; const s = classSays.get(c) ?? new Set(); s.add(fam); classSays.set(c, s); }
console.log('classes', classes.length, 'that say their religion', classSays.size);

// 2. the places, chunked by class (one query over all of them times out)
let rows = readCache('places-raw2');
if (!rows) {
  rows = [];
  for (let i = 0; i < classes.length; i += 400) {
    const vals = classes.slice(i, i + 400).map((c) => 'wd:' + c).join(' ');
    // EVERY P140 statement that is not deprecated, with its dates: the best-ranked value alone gave
    // Hagia Sophia Islam only, erasing its nine Christian centuries (rule 5)
    const r = await sparql(`SELECT ?e ?cls ?sl ?y ?c ?r ?ra ?rb ?x WHERE { VALUES ?cls { ${vals} } ?e wdt:P31 ?cls . ?e wikibase:sitelinks ?sl . FILTER(?sl >= 5)
      ?e wdt:P625 ?c . ?e p:P571/psv:P571 [ wikibase:timeValue ?y; wikibase:timePrecision ?p ] . FILTER(?p >= 9)
      OPTIONAL { ?e p:P140 ?st . ?st ps:P140 ?r . FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank } OPTIONAL { ?st pq:P580 ?ra } OPTIONAL { ?st pq:P582 ?rb } }
      OPTIONAL { ?e wdt:P576 ?x } }`);
    for (const b of r) rows.push([id(b.e.value), id(b.cls.value), Number(b.sl.value), b.y.value, b.c.value, b.r ? id(b.r.value) : null, b.x ? b.x.value : null, b.ra ? b.ra.value : null, b.rb ? b.rb.value : null]);
    console.log('places: classes', Math.min(i + 400, classes.length), 'of', classes.length, 'rows', rows.length);
  }
  writeCache('places-raw2', rows);
}
const places = new Map();
for (const [q, cls, sl, y, c, r, x, ra, rb] of rows) {
  const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(c);
  const yr = yearOf(y);
  if (!m || yr === null) continue;
  // rel: value → its dated spans ([from, to], null = not dated on that side)
  const p = places.get(q) ?? { q, sl, y: yr, lon: Math.round(Number(m[1]) * 100) / 100, lat: Math.round(Number(m[2]) * 100) / 100, cls: new Set(), rel: new Map(), end: null };
  p.cls.add(cls);
  if (r) {
    const spans = p.rel.get(r) ?? [];
    const sp = [ra ? yearOf(ra) : null, rb ? yearOf(rb) : null];
    if (!spans.some((x) => x[0] === sp[0] && x[1] === sp[1])) spans.push(sp);
    p.rel.set(r, spans);
  }
  if (yr < p.y) p.y = yr; // the earliest founding Wikidata gives
  if (x) { const e = yearOf(x); if (e !== null && (p.end === null || e > p.end)) p.end = e; }
  places.set(q, p);
}

// 3. each religion value climbs to its families (a value can reach two: then the place keeps both)
const values = [...new Set([...places.values()].flatMap((p) => [...p.rel.keys()]))];
const famOf = new Map(FAMILIES.map((f) => [f, new Set([f])]));
// The climb is done HERE, one level at a time (direct parents only, at most 8 levels): every
// path query with * timed out (504), the engine walking down from the families instead of up.
// Parents: subclass of, part of, and its own religion / instance of (a church whose religion is
// "Catholic Church", itself of religion Catholicism).
const parents = new Map();
let frontier = values.filter((v) => !FAMILIES.includes(v));
const seen = new Set(frontier);
for (let depth = 0; depth < 8 && frontier.length; depth++) {
  const next = [];
  for (let i = 0; i < frontier.length; i += 200) {
    const r = await sparql(`SELECT ?v ?p WHERE { VALUES ?v { ${frontier.slice(i, i + 200).map((v) => 'wd:' + v).join(' ')} } ?v wdt:P279|wdt:P361|wdt:P140|wdt:P31 ?p }`);
    for (const b of r) {
      const v = id(b.v.value), par = id(b.p.value);
      (parents.get(v) ?? parents.set(v, new Set()).get(v)).add(par);
      if (!seen.has(par) && !FAMILIES.includes(par)) { seen.add(par); next.push(par); }
    }
  }
  frontier = next;
  console.log('climb level', depth + 1, 'next', next.length);
}
// memoised: without it every place re-walked thousands of paths through generic classes and the
// run hung for half an hour; an item met again while being walked (a loop) answers nothing
const memo = new Map();
const reach = (v) => {
  if (FAMILIES.includes(v)) return new Set([v]);
  const known = memo.get(v);
  if (known) return known;
  memo.set(v, new Set());
  const out = new Set();
  for (const par of parents.get(v) ?? []) for (const f of reach(par)) out.add(f);
  memo.set(v, out);
  return out;
};
for (const v of values) { const f = reach(v); if (f.size) famOf.set(v, f); }
console.log('religion values', values.length, 'reaching a family', [...famOf.keys()].filter((k) => !FAMILIES.includes(k) || values.includes(k)).length);

// 4. one row per (place, family)
const out = [];
const perFamily = Object.fromEntries([...FAMILIES, 'other'].map((f) => [f, 0]));
let inferred = 0, multi = 0;
for (const p of places.values()) {
  if (p.y > 2025) continue;
  // (family, from, to) spans; a place with no dated statement keeps its families for all its life
  const spans = [];
  for (const [r, list] of p.rel) for (const f of famOf.get(r) ?? []) for (const [a0, b0] of list) spans.push({ f, a: a0, b: b0 });
  let inf = 0;
  if (p.rel.size > 0 && spans.length === 0) spans.push({ f: 'other', a: null, b: null });
  if (p.rel.size === 0) {
    for (const c of p.cls) for (const f of classSays.get(c) ?? []) if (!spans.some((x) => x.f === f)) spans.push({ f, a: null, b: null });
    if (spans.length) inf = 1; else spans.push({ f: 'other', a: null, b: null });
  }
  if (inf) inferred++;
  if (new Set(spans.map((x) => x.f)).size > 1) multi++;
  // A demolition BEFORE a religion dated later is an earlier building on the same item (Hagia
  // Sophia: the basilica burnt in 532, the mosque of 1453): the place stood, the demolition is not
  // applied. Otherwise the 532 cut the next fifteen centuries.
  const end = p.end !== null && spans.some((x) => x.a !== null && x.a >= p.end) ? null : p.end;
  for (const sp of spans) {
    const from = Math.max(p.y, sp.a ?? p.y);
    const to = [end, sp.b].filter((v) => v !== null).reduce((m, v) => (m === null || v < m ? v : m), null);
    if (to !== null && to <= from) continue;
    out.push({ q: p.q, f: sp.f, y: from, lon: p.lon, lat: p.lat, end: to, inf, sl: p.sl });
    perFamily[sp.f]++;
  }
}

// 5. currents: religions, denominations, movements, and the twelve families themselves, with a founding year
const cur = await sparql(`SELECT ?r ?sl ?y ?p ?loc WHERE {
  { VALUES ?k { wd:Q9174 wd:Q13414953 wd:Q2061186 wd:Q879146 } ?r wdt:P31 ?k . } UNION { VALUES ?r { ${FAMILIES.map((f) => 'wd:' + f).join(' ')} } }
  ?r wikibase:sitelinks ?sl . FILTER(?sl >= 20)
  ?r p:P571/psv:P571 [ wikibase:timeValue ?y; wikibase:timePrecision ?p ] . FILTER(?p >= 7)
  OPTIONAL { ?r wdt:P740/wdt:P625 ?loc } }`);
const currents = new Map();
for (const b of cur) {
  const q = id(b.r.value), y = yearOf(b.y.value), prec = Number(b.p.value);
  if (y === null || y > 2025) continue;
  const prev = currents.get(q);
  // the most precise founding Wikidata gives, then the earliest
  if (prev && (prev.prec > prec || (prev.prec === prec && prev.y <= y))) continue;
  const m = b.loc ? /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.loc.value) : null;
  currents.set(q, { q, y, prec, sl: Number(b.sl.value), lon: m ? Math.round(Number(m[1]) * 100) / 100 : null, lat: m ? Math.round(Number(m[2]) * 100) / 100 : null });
}

// 6. names in the seven languages (places, currents, families)
const labels = readCache('labels') ?? {};
const need = [...new Set([...out.map((r) => r.q), ...currents.keys(), ...FAMILIES])].filter((q) => !(q in labels));
for (let i = 0; i < need.length; i += 50) {
  const chunk = need.slice(i, i + 50);
  let ents = null;
  for (let t = 0; t < 4 && !ents; t++) {
    try {
      const r = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=labels&languages=${[...LANGS, 'zh-hans', 'zh-cn', 'mul'].join('|')}&format=json`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (r.ok) ents = (await r.json()).entities ?? {};
      else if (r.status !== 429 && r.status < 500) throw new Error('labels: HTTP ' + r.status);
    } catch (e) { if (t === 3) throw e; }
    if (!ents) await new Promise((res) => setTimeout(res, (t + 1) * 10000));
  }
  for (const q of chunk) {
    const l = ents[q]?.labels ?? {};
    const n = {};
    for (const k of LANGS) { const v = (k === 'zh' ? l['zh-hans'] ?? l['zh-cn'] ?? l.zh : l[k])?.value; if (v) n[k] = v; }
    if (!n.en && l.mul) n.en = l.mul.value;
    labels[q] = n;
  }
  if ((i / 50) % 40 === 0) { writeCache('labels', labels); console.log('labels', i + chunk.length, 'of', need.length); }
}
writeCache('labels', labels);

// a place or a current with no name in any language is not shown (nothing to call it)
const named = (q) => Object.keys(labels[q] ?? {}).length > 0;
const placeRows = out.filter((r) => named(r.q)).sort((a, b) => a.y - b.y);
const curList = [...currents.values()].filter((c) => named(c.q)).sort((a, b) => a.y - b.y);
// names stored once per item
const names = {};
for (const q of new Set([...placeRows.map((r) => r.q), ...curList.map((c) => c.q), ...FAMILIES])) names[q] = labels[q];
const fIdx = new Map([...FAMILIES, 'other'].map((f, i) => [f, i]));
fs.writeFileSync(join(pub, 'religions.json'), JSON.stringify({
  read: new Date().toISOString().slice(0, 10),
  families: FAMILIES,
  // [year, lon, lat, family index (12 = other), demolished year or null, inferred from its class 0/1, Q number]
  p: placeRows.map((r) => [r.y, r.lon, r.lat, fIdx.get(r.f), r.end, r.inf, Number(r.q.slice(1))]),
  // [year, approximate 0/1 (decade or century), lon, lat, Q number]
  c: curList.map((c) => [c.y, c.prec < 9 ? 1 : 0, c.lon, c.lat, Number(c.q.slice(1))]),
  n: names,
}));
console.log('places', places.size, 'rows', placeRows.length, 'several religions', multi, 'inferred from the class', inferred, 'currents', curList.length, (fs.statSync(join(pub, 'religions.json')).size / 1e3).toFixed(0), 'kB');
console.log('per family', JSON.stringify(Object.fromEntries(Object.entries(perFamily).map(([f, n]) => [labels[f]?.en ?? f, n]))));
const hs = out.filter((r) => r.q === 'Q12506').map((r) => `${labels[r.f]?.en ?? r.f} ${r.y}–${r.end ?? ''}`);
console.log('Hagia Sophia', hs.join(', ') || '(not in)');
