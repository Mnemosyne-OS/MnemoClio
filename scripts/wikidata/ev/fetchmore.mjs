// fetchmore.mjs — the subjects added on 05/10 after "there is nothing on the United States":
// (cities: 15 Wikipedias, 8 for one founded before 500)
// subdivisions (states, provinces, regions), elections, laws, cities, companies, political violence.
// Same rules as fetchall.mjs: one item per row (GROUP BY), a date counts only at year precision
// (else its start-time qualifier, else the item is left out), deprecated statements ignored.
import fs from 'fs';
import { sparql } from './q2.mjs';

const date = (props) => `?x ${props.map((p) => 'p:' + p).join('|')} ?st0 . FILTER NOT EXISTS { ?st0 wikibase:rank wikibase:DeprecatedRank }
  ?st0 ${props.map((p) => 'psv:' + p).join('|')} ?dv . ?dv wikibase:timeValue ?dt ; wikibase:timePrecision ?pr .
  OPTIONAL { ?st0 pq:P580 ?qs } BIND(IF(?pr >= 9, ?dt, ?qs) AS ?d0) FILTER(BOUND(?d0))
  FILTER(YEAR(?d0) >= -3500 && YEAR(?d0) <= 2025)`;
const tail = 'OPTIONAL { ?x wdt:P17 ?a1 } OPTIONAL { ?x wdt:P495 ?a2 } OPTIONAL { ?x wdt:P625 ?co }';
const head = '?x (MIN(?d0) AS ?d) (MAX(?sl0) AS ?sl) (SAMPLE(?a1) AS ?c1) (SAMPLE(?a2) AS ?c2) (SAMPLE(?a3) AS ?c3) (SAMPLE(?co) AS ?coord) (SAMPLE(?t0) AS ?t)';

const K = {
  // a country's own first-level divisions, dated by their creation (a US state: its admission)
  subdivision: [`SELECT ${head} WHERE { ?a3 wdt:P31 wd:Q3624078 ; wdt:P150 ?x . ?x wikibase:sitelinks ?sl0 . OPTIONAL { ?x wdt:P31 ?t0 } ${date(['P571'])} OPTIONAL { ?x wdt:P625 ?co } } GROUP BY ?x`],
  // any kind of election, by its class tree; the well-known ones only
  election: [`SELECT ${head} WHERE { ?x wdt:P31/wdt:P279* wd:Q40231 ; wikibase:sitelinks ?sl0 . FILTER(?sl0 >= 5) OPTIONAL { ?x wdt:P31 ?t0 } ${date(['P585'])} ${tail} } GROUP BY ?x`],
  law: [`SELECT ${head} WHERE { ?x wdt:P31/wdt:P279? wd:Q820655 ; wikibase:sitelinks ?sl0 . FILTER(?sl0 >= 4) OPTIONAL { ?x wdt:P31 ?t0 } ${date(['P571', 'P577', 'P585'])} ${tail} } GROUP BY ?x`],
  city: [`SELECT ${head} WHERE { ?x wdt:P31 wd:Q515 ; wikibase:sitelinks ?sl0 . FILTER(?sl0 >= 8) BIND(wd:Q515 AS ?t0) ${date(['P571'])} FILTER(?sl0 >= 15 || YEAR(?d0) < 500) ${tail} } GROUP BY ?x`],
  company: [`SELECT ${head} WHERE { ?x wdt:P31/wdt:P279? wd:Q4830453 ; wikibase:sitelinks ?sl0 . FILTER(?sl0 >= 15) OPTIONAL { ?x wdt:P31 ?t0 } ${date(['P571'])} ${tail} OPTIONAL { ?x wdt:P159 ?hq . ?hq wdt:P17 ?a3 } } GROUP BY ?x`],
  violence: ['Q3882219', 'Q2223653', 'Q217327', 'Q3199915'].map((t) =>
    `SELECT ${head} WHERE { ?x wdt:P31 wd:${t} ; wikibase:sitelinks ?sl0 . FILTER(?sl0 >= 3) BIND(wd:${t} AS ?t0) ${date(['P585', 'P580'])} ${tail} } GROUP BY ?x`),
};

const only = process.argv.slice(2);
for (const [k, queries] of Object.entries(K)) {
  if (only.length && !only.includes(k)) continue;
  const seen = new Map();
  for (const q of queries) {
    const t0 = Date.now();
    try {
      const rows = await sparql(q, 170000);
      for (const b of rows) {
        const o = Object.fromEntries(Object.entries(b).map(([n, v]) => [n, v.value]));
        if (o.t) o.t = o.t.split('/').pop();
        if (!seen.has(o.x)) seen.set(o.x, o);
      }
      console.log(k, rows.length, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    } catch (e) {
      console.log(k, 'FAIL', String(e.message).slice(0, 80));
    }
  }
  if (seen.size) fs.writeFileSync('k_' + k + '.json', JSON.stringify([...seen.values()]));
}
