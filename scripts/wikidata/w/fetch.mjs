// The first reads of the chain: the 197 sovereign states and the language each is named in,
// regimes, battles with the war above them, how wars nest, and the event counts per country.
// Every query goes through ../ev/q2.mjs (POST, retries on 429/5xx, the last failure thrown).
import fs from 'fs';
import { sparql } from '../ev/q2.mjs';

const id = (u) => u.split('/').pop();
const save = (name, rows) => fs.writeFileSync(name + '.json', JSON.stringify({ results: { bindings: rows } }));

// Countries, with ALL their official languages: a SAMPLE once picked Spanish for the United States.
const countries = await sparql(`SELECT ?c (GROUP_CONCAT(DISTINCT ?code; separator=',') AS ?langs) WHERE {
  ?c wdt:P31 wd:Q3624078 . FILTER NOT EXISTS { ?c wdt:P576 ?x }
  OPTIONAL { ?c wdt:P37 ?l . ?l wdt:P424 ?code } } GROUP BY ?c`);
// The US has no federal official language in Wikidata's P37; English is what its names are written in.
const OVERRIDE = { Q30: 'en' };
const lang = (row) => {
  const q = id(row.c.value);
  if (OVERRIDE[q]) return OVERRIDE[q];
  const ls = row.langs.value ? row.langs.value.split(',') : [];
  // zh-cn labels are almost empty on Wikidata (7 of 54 regimes); the names live under zh.
  return (ls[0] || null) === 'zh-cn' ? 'zh' : ls[0] || null;
};
save('countries', countries.map((r) => ({ c: r.c, ...(lang(r) ? { lang: { value: lang(r) } } : {}) })));
console.log('countries', countries.length);

// A battle goes to EVERY war above it; build.mjs keeps the nearest one (doc 135 §8.5).
// WWI is a "world war" (Q103495), not a Q198, hence the subclass path on the war.
const battles = await sparql(`SELECT ?b ?c ?d ?coord ?p ?w ?ws ?we WHERE {
  ?b wdt:P31 wd:Q178561 ; wdt:P17 ?c ; wdt:P585|wdt:P580 ?d ; wdt:P361 ?p .
  FILTER(YEAR(?d) >= -3500 && YEAR(?d) <= 2025)
  ?p wdt:P361* ?w . ?w wdt:P31/wdt:P279* wd:Q198 .
  OPTIONAL { ?b wdt:P625 ?coord } OPTIONAL { ?w wdt:P580 ?ws } OPTIONAL { ?w wdt:P582 ?we } }`);
save('battles2', battles); save('battles', battles);
console.log('battle x war rows', battles.length);

const states = await sparql(`SELECT ?st ?c ?s ?e ?next WHERE {
  ?st wdt:P31 wd:Q3024240 ; wdt:P17 ?c ; wdt:P571 ?s .
  OPTIONAL { ?st wdt:P576 ?e } OPTIONAL { ?st wdt:P1366 ?next }
  FILTER(YEAR(?s) >= -3500 && YEAR(?s) <= 2025) }`);
save('states', states);
console.log('regimes', states.length);

const counts = await sparql(`SELECT ?c (COUNT(DISTINCT ?e) AS ?n) WHERE {
  VALUES ?t { wd:Q198 wd:Q178561 wd:Q10931 wd:Q131569 wd:Q13418847 wd:Q3839081 }
  ?e wdt:P31 ?t ; wdt:P17 ?c ; wdt:P585|wdt:P580 ?d } GROUP BY ?c`);
save('counts', counts);

// How wars nest: the Korean War is "part of" the Cold War. Read once, for the wars actually met.
const wars = [...new Set(battles.map((b) => id(b.w.value)))];
// One query for every pair timed out once Antiquity tripled the wars: walk from 100 wars at a time
// and keep only the targets that are wars we met.
const warSet = new Set(wars);
const links = [];
for (let i = 0; i < wars.length; i += 100) {
  const values = wars.slice(i, i + 100).map((w) => 'wd:' + w).join(' ');
  const rows = await sparql(`SELECT ?a ?b WHERE { VALUES ?a { ${values} } ?a wdt:P361+ ?b . FILTER(?a != ?b) }`);
  links.push(...rows.filter((r) => warSet.has(id(r.b.value))));
}
save('warlinks', links);
console.log('wars', wars.length, 'war-in-war links', links.length);
