import { sparql } from './q2.mjs';
const span = 'FILTER(YEAR(?d) >= -3500 && YEAR(?d) < 1450)';
const Q = {
  persons45: `SELECT (COUNT(DISTINCT ?x) AS ?n) WHERE { ?x wdt:P31 wd:Q5 ; wdt:P569 ?d ; wikibase:sitelinks ?sl . FILTER(?sl >= 45) ${span} }`,
  battles: `SELECT (COUNT(DISTINCT ?x) AS ?n) WHERE { ?x wdt:P31 wd:Q178561 ; wdt:P585|wdt:P580 ?d . ${span} }`,
  polities40: `SELECT (COUNT(DISTINCT ?x) AS ?n) WHERE { ?x wdt:P31/wdt:P279* wd:Q3024240 ; wdt:P576 ?d ; wikibase:sitelinks ?sl . FILTER(?sl >= 40) ${span} }`,
  works18: `SELECT (COUNT(DISTINCT ?x) AS ?n) WHERE { VALUES ?t { wd:Q7725634 wd:Q3305213 wd:Q860861 } ?x wdt:P31 ?t ; wdt:P571|wdt:P577 ?d ; wikibase:sitelinks ?sl . FILTER(?sl >= 18) ${span} }`,
  buildings10: `SELECT (COUNT(DISTINCT ?x) AS ?n) WHERE { VALUES ?t { wd:Q2977 wd:Q16560 wd:Q23413 wd:Q32815 wd:Q44539 wd:Q4989906 wd:Q16970 wd:Q839954 } ?x wdt:P31 ?t ; wdt:P571 ?d ; wikibase:sitelinks ?sl . FILTER(?sl >= 10) ${span} }`,
  cities15: `SELECT (COUNT(DISTINCT ?x) AS ?n) WHERE { ?x wdt:P31 wd:Q515 ; wdt:P571 ?d ; wikibase:sitelinks ?sl . FILTER(?sl >= 15) ${span} }`,
  treaties3: `SELECT (COUNT(DISTINCT ?x) AS ?n) WHERE { VALUES ?t { wd:Q131569 wd:Q625298 } ?x wdt:P31 ?t ; wdt:P585|wdt:P571 ?d ; wikibase:sitelinks ?sl . FILTER(?sl >= 3) ${span} }`,
  leaders: `SELECT (COUNT(*) AS ?n) WHERE { ?p p:P39 ?st . ?st ps:P39 ?o ; pq:P580 ?d . ?x wdt:P1906|wdt:P1313 ?o . ?x wdt:P31/wdt:P279* wd:Q3024240 . ${span} }`,
};
for (const [k, q] of Object.entries(Q)) { const t = Date.now(); try { const r = await sparql(q, 170000); console.log(k.padEnd(12), r[0].n.value, ((Date.now() - t) / 1000).toFixed(1) + 's'); } catch (e) { console.log(k.padEnd(12), 'FAIL', String(e.message).slice(0, 50)); } }
