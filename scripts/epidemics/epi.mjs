// epi.mjs — epidemics where they broke out: dated foci, never drawn spreads.
//
// Field, 07/10: "the spread of diseases". Wikidata knows the outbreaks (epidemic Q44512,
// pandemic Q12184, disease outbreak Q3241045, and their subclasses), their dates, their places
// and sometimes their dead; it does NOT know how a disease travelled from one to the next, except
// for a handful of pandemics studied in detail. So the cartridge draws FOCI — each one where and
// when Wikidata places it — and no invented cloud.
//
// An outbreak that is part of another one in the set (COVID-19 pandemic in France, P361) or filed
// as its subclass (Black Death in England, P279) is not an epidemic of its own: it becomes a focus
// of its parent, with its own place and date.
// Dates: year precision at least (P580 start / P585 point in time); an outbreak known only to the
// century is dropped, not placed at a guessed year.
//
// Writes public/data/epidemics.json (CC0, Wikidata). Cache: scripts/epidemics/*.json.
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { sparql } from '../wikidata/ev/q2.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const UA = 'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)';
const pub = join(here, '..', '..', 'public', 'data');
const LANGS = ['en', 'fr', 'es', 'de', 'pt', 'ru', 'zh'];
const MIN_SL = 2;

const yearOf = (iso) => { const m = /^([+-]?\d+)-/.exec(iso); if (!m) return null; const y = parseInt(m[1], 10); return y === 0 ? null : y; };
const id = (u) => u.split('/').pop();

console.log('outbreaks…');
// the subclasses first, then the instances of a fixed list: one query walking P31/P279* timed
// out (504), two short ones answer in two seconds each
const classes = (await sparql(`SELECT ?c WHERE { VALUES ?r { wd:Q44512 wd:Q12184 wd:Q3241045 } ?c wdt:P279* ?r }`)).map((b) => 'wd:' + id(b.c.value));
const base = await sparql(`SELECT DISTINCT ?e ?sl ?s ?sp ?t ?tp ?x ?xp ?d WHERE {
  VALUES ?cls { ${classes.join(' ')} }
  ?e wdt:P31 ?cls .
  ?e wikibase:sitelinks ?sl . FILTER(?sl >= ${MIN_SL})
  OPTIONAL { ?e p:P580/psv:P580 [ wikibase:timeValue ?s; wikibase:timePrecision ?sp ] }
  OPTIONAL { ?e p:P585/psv:P585 [ wikibase:timeValue ?t; wikibase:timePrecision ?tp ] }
  OPTIONAL { ?e p:P582/psv:P582 [ wikibase:timeValue ?x; wikibase:timePrecision ?xp ] }
  OPTIONAL { ?e wdt:P1120 ?d }
}`);
const items = new Map();
for (const b of base) {
  const q = id(b.e.value);
  const it = items.get(q) ?? { q, sl: Number(b.sl.value), s: null, e: null, dead: null };
  const take = (v, p) => (v && Number(p.value) >= 9 ? yearOf(v.value) : null);
  const s = take(b.s, b.sp ?? { value: 0 }) ?? take(b.t, b.tp ?? { value: 0 });
  if (s !== null && (it.s === null || s < it.s)) it.s = s;
  const x = take(b.x, b.xp ?? { value: 0 });
  if (x !== null && (it.e === null || x > it.e)) it.e = x;
  if (b.d) { const n = Math.round(Number(b.d.value)); if (Number.isFinite(n) && n > 0 && (it.dead === null || n > it.dead)) it.dead = n; }
  items.set(q, it);
}
const dated = [...items.values()].filter((it) => it.s !== null);
console.log('outbreaks', items.size, 'dated to the year', dated.length);

// places (P276 location, else P17 country) with coordinates, and "part of" (P361)
async function inChunks(ids, make) {
  const out = [];
  for (let i = 0; i < ids.length; i += 300) out.push(...(await sparql(make(ids.slice(i, i + 300).map((q) => 'wd:' + q).join(' ')))));
  return out;
}
const ids = dated.map((it) => it.q);
const placeRows = await inChunks(ids, (v) => `SELECT ?e ?p ?c WHERE { VALUES ?e { ${v} } { ?e wdt:P276 ?l } UNION { ?e wdt:P17 ?l } ?l wdt:P625 ?c . BIND(IF(EXISTS { ?e wdt:P276 ?l }, "loc", "country") AS ?p) }`);
const partRows = await inChunks(ids, (v) => `SELECT ?e ?parent WHERE { VALUES ?e { ${v} } ?e wdt:P361|wdt:P279 ?parent }`);
const places = new Map();
for (const b of placeRows) {
  const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.c.value);
  if (!m) continue;
  const q = id(b.e.value), pt = { lon: Math.round(Number(m[1]) * 100) / 100, lat: Math.round(Number(m[2]) * 100) / 100, loc: b.p.value === 'loc' };
  (places.get(q) ?? places.set(q, []).get(q)).push(pt);
}
// a precise location wins over the country's centre
for (const [q, ps] of places) { const loc = ps.filter((p) => p.loc); places.set(q, (loc.length ? loc : ps).slice(0, 12).map(({ lon, lat }) => ({ lon, lat }))); }
const parentOf = new Map();
const datedSet = new Set(ids);
for (const b of partRows) { const q = id(b.e.value), p = id(b.parent.value); if (datedSet.has(p) && p !== q && !parentOf.has(q)) parentOf.set(q, p); }
// climb to the top (COVID-19 in Lyon → in France → pandemic), refusing loops
const rootOf = (q) => { let r = q; const seen = new Set(); while (parentOf.has(r) && !seen.has(r)) { seen.add(r); r = parentOf.get(r); } return r; };

// labels in the seven languages of the app
const labelsFile = join(here, 'labels.json');
const labels = fs.existsSync(labelsFile) ? JSON.parse(fs.readFileSync(labelsFile, 'utf8')) : {};
const tops = [...new Set(ids.map(rootOf))];
const need = tops.filter((q) => !(q in labels));
for (let i = 0; i < need.length; i += 50) {
  const chunk = need.slice(i, i + 50);
  const r = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=labels&languages=${[...LANGS, 'zh-hans', 'zh-cn', 'mul'].join('|')}&format=json`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error('labels: HTTP ' + r.status);
  const ents = (await r.json()).entities ?? {};
  for (const q of chunk) {
    const l = ents[q]?.labels ?? {};
    const n = {};
    for (const k of LANGS) { const v = (k === 'zh' ? l['zh-hans'] ?? l['zh-cn'] ?? l.zh : l[k])?.value; if (v) n[k] = v; }
    if (!n.en && l.mul) n.en = l.mul.value;
    labels[q] = n;
  }
}
fs.writeFileSync(labelsFile, JSON.stringify(labels));

// one epidemic per top, its foci = its own place and its parts' places, each with its year
const out = new Map();
for (const it of dated) {
  const top = rootOf(it.q);
  const t = items.get(top);
  if (!t || t.s === null) continue;
  // 🎭 an end nobody dated stays null ("end not dated"), never the start year: HIV/AIDS ended in 1959 otherwise
  const ep = out.get(top) ?? { q: top, n: labels[top] ?? {}, s: t.s, e: t.e, sl: t.sl, dead: t.dead, f: [] };
  for (const p of places.get(it.q) ?? []) ep.f.push([it.s, p.lon, p.lat]);
  ep.s = Math.min(ep.s, it.s);
  if (it.e !== null) ep.e = ep.e === null ? it.e : Math.max(ep.e, it.e);
  out.set(top, ep);
}
// the timeline stops at 2025: an outbreak that starts later is not on it
const list = [...out.values()].filter((ep) => Object.keys(ep.n).length > 0 && ep.s <= 2025).sort((a, b) => a.s - b.s);
const placed = list.filter((ep) => ep.f.length > 0).length;
fs.writeFileSync(join(pub, 'epidemics.json'), JSON.stringify({ read: new Date().toISOString().slice(0, 10), e: list }));
console.log('epidemics', list.length, 'with a place', placed, 'foci', list.reduce((n, ep) => n + ep.f.length, 0), 'with the dead', list.filter((ep) => ep.dead).length, (fs.statSync(join(pub, 'epidemics.json')).size / 1e3).toFixed(0), 'kB');
console.log('most known:', list.slice().sort((a, b) => b.sl - a.sl).slice(0, 8).map((ep) => `${ep.n.en ?? ep.q} ${ep.s}–${ep.e ?? '?'} (${ep.f.length})`).join(' | '));
