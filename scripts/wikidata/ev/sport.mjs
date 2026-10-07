import fs from 'fs';import {sparql} from './q2.mjs';
const r=await sparql(`SELECT ?x ?t (MIN(?d0) AS ?d) (MAX(?sl0) AS ?sl) (SAMPLE(?a1) AS ?c1) (SAMPLE(?co) AS ?coord) WHERE {
 { VALUES ?t { wd:Q135976384 wd:Q137592217 wd:Q106043413 } ?x wdt:P31 ?t } UNION { VALUES ?t { wd:Q19317 wd:Q33881 } ?x wdt:P3450 ?t }
 ?x wikibase:sitelinks ?sl0 . ?x wdt:P580|wdt:P585|wdt:P571 ?d0 . FILTER(YEAR(?d0) >= -3500 && YEAR(?d0) <= 2025)
 OPTIONAL { ?x wdt:P17 ?a1 } OPTIONAL { ?x wdt:P276 ?loc . ?loc wdt:P625 ?co } } GROUP BY ?x ?t`);
const out=r.map(b=>({...Object.fromEntries(Object.entries(b).map(([n,v])=>[n,v.value])),t:b.t.value.split('/').pop()}));
fs.writeFileSync('k_sport.json',JSON.stringify(out));const c={};for(const o of out)c[o.t]=(c[o.t]||0)+1;console.log(out.length,c);
