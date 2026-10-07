import fs from 'fs';import {sparql} from './q2.mjs';
const t=Date.now();
const r=await sparql(`SELECT DISTINCT ?t WHERE { { ?t wdt:P279* wd:Q6999 } UNION { ?t wdt:P279* wd:Q23442 } UNION { ?t wdt:P279* wd:Q16521 } }`);
fs.writeFileSync('astro_classes.json',JSON.stringify(r.map(x=>x.t.value.split('/').pop())));console.log('classes exclues (astro, île, taxon)',r.length,(Date.now()-t)/1000+'s');
const inv=await sparql(`SELECT ?x ?t ?d ?sl WHERE { ?x wdt:P575 ?d . hint:Prior hint:rangeSafe true . FILTER(YEAR(?d) >= -3500 && YEAR(?d) <= 2025) ?x wikibase:sitelinks ?sl FILTER(?sl >= 8) ?x wdt:P31 ?t }`);
const ex=new Set(r.map(x=>x.t.value.split('/').pop()));const by={};
for(const b of inv){const x=b.x.value.split('/').pop(),t=b.t.value.split('/').pop();by[x]=by[x]||{t:new Set(),sl:+b.sl.value};by[x].t.add(t)}
const keep=Object.entries(by).filter(([x,v])=>![...v.t].some(t=>ex.has(t)));
console.log('P575 items',Object.keys(by).length,'hors astro/île/taxon',keep.length);
const tc={};for(const [,v] of keep)for(const t of v.t)tc[t]=(tc[t]||0)+1;
fs.writeFileSync('inv_keep.json',JSON.stringify(keep.map(([x,v])=>[x,[...v.t],v.sl])));
console.log(Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,30).map(x=>x.join(':')).join(' '));
