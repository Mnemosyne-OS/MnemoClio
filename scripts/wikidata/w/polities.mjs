// polities.mjs — the countries that are not today's 197: states that ended (the Ottoman Empire,
// the USSR, Prussia…) and dependent territories (Greenland, Hong Kong, Puerto Rico…).
//
// One item, one span: the EARLIEST inception and the LATEST dissolution, each only at year
// precision (a date "to the century" is not a year). The language a name is shown in is the
// first official language (P37) that has labels, else the language of the country it became
// (P1366), else English: a choice, written in doc 137.
import fs from 'fs';
import { sparql } from '../ev/q2.mjs';

const id = (u) => u.split('/').pop();
const year = (v) => (v ? parseInt(String(v).replace(/^\+/, ''), 10) : null);
const dated = (p, v) => `OPTIONAL { ?x p:${p} ?${v}st . FILTER NOT EXISTS { ?${v}st wikibase:rank wikibase:DeprecatedRank } ?${v}st psv:${p} ?${v}v . ?${v}v wikibase:timeValue ?${v} ; wikibase:timePrecision ?${v}p . FILTER(?${v}p >= 9) }`;

const ended = await sparql(`SELECT ?x (MIN(?s) AS ?s0) (MAX(?e) AS ?e0) (MAX(?sl) AS ?sl0) WHERE {
  ?x wdt:P31/wdt:P279* wd:Q3024240 ; wikibase:sitelinks ?sl . FILTER(?sl >= 25)
  ${dated('P571', 's')} ${dated('P576', 'e')} } GROUP BY ?x`, 170000);
const territories = await sparql(`SELECT ?x (MIN(?s) AS ?s0) (MAX(?sl) AS ?sl0) WHERE {
  ?x wdt:P31/wdt:P279* wd:Q161243 ; wikibase:sitelinks ?sl . FILTER(?sl >= 40) FILTER NOT EXISTS { ?x wdt:P576 ?gone }
  ${dated('P571', 's')} } GROUP BY ?x`, 170000);

const current = new Set(JSON.parse(fs.readFileSync('countries.json')).results.bindings.map((b) => id(b.c.value)));
const list = [];
for (const b of ended) {
  const e = year(b.e0?.value);
  // a state that ended before the timeline starts has nothing to show on it
  if (e === null || e < -3500) continue;
  // 40 Wikipedias for a state that ended after 500, 25 for an ancient one (Urartu, Nabataea…)
  if (+b.sl0.value < 40 && e >= 500) continue;
  list.push({ id: id(b.x.value), kind: 'ended', s: year(b.s0?.value), e, sl: +b.sl0.value });
}
for (const b of territories) {
  const q = id(b.x.value);
  if (current.has(q)) continue;
  list.push({ id: q, kind: 'territory', s: year(b.s0?.value), e: null, sl: +b.sl0.value });
}
console.log('ended', list.filter((p) => p.kind === 'ended').length, 'territories', list.filter((p) => p.kind === 'territory').length);

// languages, successors, labels
const ids = list.map((p) => p.id);
const langs = {}, next = {};
for (let i = 0; i < ids.length; i += 200) {
  const v = ids.slice(i, i + 200).map((q) => 'wd:' + q).join(' ');
  const r = await sparql(`SELECT ?x ?code ?n WHERE { VALUES ?x { ${v} } { ?x wdt:P37 ?l . ?l wdt:P424 ?code } UNION { ?x wdt:P1366 ?n } }`);
  for (const b of r) {
    const x = id(b.x.value);
    if (b.code) (langs[x] ??= []).push(b.code.value);
    if (b.n) (next[x] ??= []).push(id(b.n.value));
  }
}
const UA = 'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)';
const L = {};
const want = [...new Set([...ids, ...Object.values(next).flat()])];
const allLangs = [...new Set(['fr', 'en', 'mul', ...Object.values(langs).flat().map((c) => (c === 'zh-cn' ? 'zh' : c))])];
for (let i = 0; i < want.length; i += 50) {
  for (let li = 0; li < allLangs.length; li += 40) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${want.slice(i, i + 50).join('|')}&languages=${allLangs.slice(li, li + 40).join('|')}`;
    for (let t = 0; t < 4; t++) {
      try {
        const j = await (await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json();
        for (const [q, e] of Object.entries(j.entities ?? {})) { L[q] ??= {}; for (const [l, v] of Object.entries(e.labels ?? {})) L[q][l] = v.value; }
        break;
      } catch { await new Promise((r) => setTimeout(r, 2000)); }
    }
  }
}
const countries = JSON.parse(fs.readFileSync('countries.json')).results.bindings;
const LANG = Object.fromEntries(countries.map((b) => [id(b.c.value), b.lang ? b.lang.value : null]));
const out = list.map((p) => {
  const l = L[p.id] ?? {};
  const own = (langs[p.id] ?? []).map((c) => (c === 'zh-cn' ? 'zh' : c)).find((c) => l[c]);
  const heir = (next[p.id] ?? []).find((n) => current.has(n));
  const lang = own ?? (heir && LANG[heir] && l[LANG[heir]] ? LANG[heir] : null);
  const o = (lang && l[lang]) || l.mul || l.en || l.fr || p.id;
  return { ...p, lang, o, ol: lang && l[lang] ? lang : l.en ? 'en' : 'fr', f: l.fr || l.mul || null, en: l.en ?? null, heir: heir ?? null };
});
fs.writeFileSync('../polities.json', JSON.stringify(out));
console.log('written', out.length, 'with an heir among today\'s states', out.filter((p) => p.heir).length);
