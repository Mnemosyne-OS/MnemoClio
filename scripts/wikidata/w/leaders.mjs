// leaders.mjs — who led each country: heads of state (P1906) and of government (P1313), term by term.
//
// The offices come from the 197 current states AND from the historical states resolved to them
// (ev/countrymap.json): the King of France is an office of the Kingdom of France, not of France.
// A term is a "position held" (P39) statement with a start (pq:P580); its end is pq:P582, else
// the next term of the same office, else it is OPEN (drawn faded, never "still in office").
// Also reads each country's own inception (P571), so a country is drawn from the day it exists.
import fs from 'fs';
import { sparql } from '../ev/q2.mjs';

const id = (u) => u.split('/').pop();
const year = (v) => (v ? parseInt(String(v).replace(/^\+/, ''), 10) : null);
const countries = JSON.parse(fs.readFileSync('countries.json')).results.bindings.map((b) => ({ id: id(b.c.value), lang: b.lang ? b.lang.value : null }));
const S = new Set(countries.map((c) => c.id));
const M0 = fs.existsSync('../ev/countrymap.json') ? JSON.parse(fs.readFileSync('../ev/countrymap.json')) : {};
// 🪤 countrymap also resolves cities and provinces (it was built for citizenships): kept as is,
// it made the Mayor of New York and the Governor of Ohio "leaders of the United States". A
// historical holder counts only if it IS a state or a country, and only through a DIRECT link
// to a current state (its own country, or "replaced by"). A federated state (Ohio) or a first-level
// division is a state for Wikidata, and is left out too.
const M = {};
const hist = Object.keys(M0);
for (let i = 0; i < hist.length; i += 200) {
  const v = hist.slice(i, i + 200).map((q) => 'wd:' + q).join(' ');
  const r = await sparql(`SELECT DISTINCT ?h ?cur WHERE { VALUES ?h { ${v} }
    { ?h wdt:P31/wdt:P279* wd:Q3024240 } UNION { ?h wdt:P31/wdt:P279* wd:Q7275 } UNION { ?h wdt:P31/wdt:P279* wd:Q417175 }
    FILTER NOT EXISTS { ?h wdt:P31/wdt:P279* wd:Q107390 } FILTER NOT EXISTS { ?h wdt:P31/wdt:P279* wd:Q10864048 }
    { ?h wdt:P17 ?cur } UNION { ?h wdt:P1366 ?cur } }`, 170000);
  for (const b of r) { const h = id(b.h.value), cur = id(b.cur.value); if (S.has(cur) && h !== cur) M[h] = M[h] ?? cur; }
}
console.log('historical states kept', Object.keys(M).length, 'of', hist.length);
// ended states and territories hold offices too (the Sultan, the Tsar): their lane shows them,
// and today's state that took their place (P1366) shows them as well when there is one
const POL = fs.existsSync('../polities.json') ? JSON.parse(fs.readFileSync('../polities.json')) : [];
const heirOf = Object.fromEntries(POL.map((p) => [p.id, p.heir]));
const holders = [...new Set([...S, ...Object.keys(M), ...POL.map((p) => p.id)])];

// 1. inception of the current states
const inc = await sparql(`SELECT ?c (MIN(?d) AS ?s) WHERE { VALUES ?c { ${[...S].map((q) => 'wd:' + q).join(' ')} } ?c wdt:P571 ?d } GROUP BY ?c`);
const inception = Object.fromEntries(inc.map((b) => [id(b.c.value), year(b.s.value)]));
console.log('inceptions', Object.keys(inception).length);

// 2. the offices, and which current country each belongs to
const offices = new Map();
for (let i = 0; i < holders.length; i += 200) {
  const v = holders.slice(i, i + 200).map((q) => 'wd:' + q).join(' ');
  const r = await sparql(`SELECT ?c ?o ?k WHERE { VALUES ?c { ${v} } { ?c wdt:P1906 ?o BIND("state" AS ?k) } UNION { ?c wdt:P1313 ?o BIND("gov" AS ?k) } }`);
  for (const b of r) {
    const c = id(b.c.value);
    const cur = S.has(c) ? c : M[c] ?? heirOf[c] ?? null;
    const isPolity = c in heirOf;
    if (!cur && !isPolity) continue;
    // h: the polity that HELD the office (the Ottoman Empire for a sultan), kept for its own lane
    offices.set(id(b.o.value), { c: cur, k: b.k.value, h: c === cur ? null : c });
  }
}
console.log('offices', offices.size);

// 3. every dated term of those offices
const terms = [];
const ids = [...offices.keys()];
for (let i = 0; i < ids.length; i += 60) {
  const v = ids.slice(i, i + 60).map((q) => 'wd:' + q).join(' ');
  const r = await sparql(`SELECT ?o ?p ?s ?e ?sl WHERE { VALUES ?o { ${v} }
    ?p p:P39 ?st . ?st ps:P39 ?o ; pq:P580 ?s . FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
    OPTIONAL { ?st pq:P582 ?e } ?p wikibase:sitelinks ?sl . FILTER(YEAR(?s) >= -3500) }`, 170000);
  for (const b of r) {
    const o = id(b.o.value);
    terms.push({ o, p: id(b.p.value), s: year(b.s.value), e: b.e ? year(b.e.value) : null, sl: +b.sl.value, ...offices.get(o) });
  }
}
// one row per person and office and start, the latest end kept
const uniq = new Map();
for (const t of terms) {
  const k = `${t.o}|${t.p}|${t.s}`;
  const prev = uniq.get(k);
  if (!prev || (t.e ?? -1) > (prev.e ?? -1)) uniq.set(k, t);
}
const list = [...uniq.values()].sort((a, b) => a.s - b.s);
fs.writeFileSync('leaders-raw.json', JSON.stringify({ inception, list }));
const us = list.filter((t) => t.c === 'Q30');
console.log('terms', list.length, 'US', us.length, 'open', list.filter((t) => t.e === null).length);
