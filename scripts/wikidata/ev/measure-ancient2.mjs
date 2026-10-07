// How much does Wikidata hold before 500, by date precision (9 = year, 8 = decade, 7 = century)?
import { sparql } from './q2.mjs';
const span = 'FILTER(YEAR(?dt) >= -3500 && YEAR(?dt) < 500)';
const prec = (prop, sel, sl) => `SELECT ?pr (COUNT(DISTINCT ?x) AS ?n) WHERE { ${sel} ?x wikibase:sitelinks ?sl . FILTER(?sl >= ${sl}) ?x p:${prop} ?st . ?st psv:${prop} ?dv . ?dv wikibase:timeValue ?dt ; wikibase:timePrecision ?pr . ${span} } GROUP BY ?pr`;
const Q = {
  'person sl>=10 birth': prec('P569', '?x wdt:P31 wd:Q5 .', 10),
  'person sl>=20 birth': prec('P569', '?x wdt:P31 wd:Q5 .', 20),
  'person sl>=10 death': prec('P570', '?x wdt:P31 wd:Q5 .', 10),
  'battle sl>=3': prec('P585', '?x wdt:P31 wd:Q178561 .', 3),
  'work sl>=5 P571': prec('P571', '?x wdt:P31/wdt:P279? wd:Q7725634 .', 5),
  'building sl>=5': prec('P571', 'VALUES ?t { wd:Q16560 wd:Q44539 wd:Q839954 wd:Q4989906 wd:Q23413 wd:Q12280 wd:Q2977 } ?x wdt:P31 ?t .', 5),
  'city sl>=8': prec('P571', '?x wdt:P31/wdt:P279? wd:Q515 .', 8),
  'state ended sl>=10': prec('P576', '?x wdt:P31/wdt:P279* wd:Q3024240 .', 10),
  'arch culture sl>=5': prec('P580', '?x wdt:P31 wd:Q465299 .', 5),
};
for (const [k, q] of Object.entries(Q)) { const t = Date.now(); try { const r = await sparql(q, 170000); console.log(k.padEnd(22), r.map((b) => b.pr.value + ':' + b.n.value).sort().join('  '), ((Date.now() - t) / 1000).toFixed(0) + 's'); } catch (e) { console.log(k.padEnd(22), 'FAIL', String(e.message).slice(0, 60)); } }
