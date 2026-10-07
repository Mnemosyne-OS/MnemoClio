import fs from 'fs';import {sparql} from './q2.mjs';
const out=JSON.parse(fs.readFileSync('k_work.json'));const have=new Set(out.map(o=>o.x));
for(const t of ['Q3305213','Q7725634']){const t0=Date.now();
  const ids=(await sparql(`SELECT ?x WHERE { ?x wdt:P31 wd:${t} ; wikibase:sitelinks ?sl . FILTER(?sl >= 18) }`)).map(b=>b.x.value.split('/').pop());
  let n=0;
  for(let i=0;i<ids.length;i+=200){const v=ids.slice(i,i+200).map(q=>'wd:'+q).join(' ');
    const r=await sparql(`SELECT ?x (MIN(?d0) AS ?d) (MAX(?sl0) AS ?sl) (SAMPLE(?a1) AS ?c1) (SAMPLE(?a2) AS ?c2) (SAMPLE(?a3) AS ?c3) (SAMPLE(?co) AS ?coord) WHERE { VALUES ?x { ${v} }
      ?x wikibase:sitelinks ?sl0 ; p:P577|p:P571 ?st0 . FILTER NOT EXISTS { ?st0 wikibase:rank wikibase:DeprecatedRank }
      ?st0 psv:P577|psv:P571 ?dv . ?dv wikibase:timeValue ?dt ; wikibase:timePrecision ?pr . OPTIONAL { ?st0 pq:P580 ?qs } BIND(IF(?pr >= 9, ?dt, ?qs) AS ?d0) FILTER(BOUND(?d0))
      FILTER(YEAR(?d0) >= -3500 && YEAR(?d0) <= 2025)
      OPTIONAL { ?x wdt:P17 ?a1 } OPTIONAL { ?x wdt:P495 ?a2 } OPTIONAL { ?x wdt:P625 ?co } OPTIONAL { ?x wdt:P170|wdt:P50|wdt:P86 ?cr . ?cr wdt:P27 ?a3 } } GROUP BY ?x`);
    for(const b of r){const o={...Object.fromEntries(Object.entries(b).map(([k,v])=>[k,v.value])),t};if(!have.has(o.x)){out.push(o);have.add(o.x);n++}}}
  console.log(t,'candidats',ids.length,'datés gardés',n,((Date.now()-t0)/1000).toFixed(0)+'s')}
fs.writeFileSync('k_work.json',JSON.stringify(out));
console.log('proust',out.filter(o=>o.x.endsWith('/Q464928')).map(o=>o.d),'total',out.length);
