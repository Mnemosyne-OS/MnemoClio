import fs from 'fs';import {sparql} from './q2.mjs';
const keep=JSON.parse(fs.readFileSync('inv_keep.json'));const out=[];
for(let i=0;i<keep.length;i+=300){const ids=keep.slice(i,i+300).map(k=>'wd:'+k[0]).join(' ');
  const r=await sparql(`SELECT ?x (MIN(?d0) AS ?d) (MAX(?sl0) AS ?sl) (SAMPLE(?a1) AS ?c1) (SAMPLE(?a2) AS ?c2) (SAMPLE(?a3) AS ?c3) (SAMPLE(?co) AS ?coord) (SAMPLE(?t0) AS ?t) WHERE { VALUES ?x { ${ids} } ?x p:P575 ?st0 . ?st0 psv:P575 ?dv . ?dv wikibase:timeValue ?dt ; wikibase:timePrecision ?pr . OPTIONAL { ?st0 pq:P580 ?qs } BIND(IF(?pr >= 9, ?dt, ?qs) AS ?d0) FILTER(BOUND(?d0)) ?x wikibase:sitelinks ?sl0 ; wdt:P31 ?t0 . OPTIONAL { ?x wdt:P17 ?a1 } OPTIONAL { ?x wdt:P495 ?a2 } OPTIONAL { ?x wdt:P61 ?p . ?p wdt:P27 ?a3 } OPTIONAL { ?x wdt:P625 ?co } } GROUP BY ?x`);
  for(const b of r)out.push(Object.fromEntries(Object.entries(b).map(([n,v])=>[n,v.value.includes('entity/')?v.value:v.value])));}
for(const o of out)o.t=o.t.split('/').pop();
fs.writeFileSync('k_discovery.json',JSON.stringify(out));console.log('discoveries',out.length);
// country resolution: every country-ish value not in the 197 -> climb P17 / P1366 (replaced by) up to a current state
const id=u=>u.split('/').pop();
const S=new Set(JSON.parse(fs.readFileSync('../w/countries.json')).results.bindings.map(b=>id(b.c.value)));
const vals=new Set();
for(const f of fs.readdirSync('.').filter(f=>f.startsWith('k_')))for(const o of JSON.parse(fs.readFileSync(f)))for(const k of ['c1','c2','c3'])if(o[k])vals.add(id(o[k]));
let unknown=[...vals].filter(v=>!S.has(v));console.log('valeurs pays',vals.size,'hors 197',unknown.length);
const map={};let frontier=unknown.map(u=>[u,u]);
for(let round=0;round<4&&frontier.length;round++){const next=[];
  for(let i=0;i<frontier.length;i+=300){const chunk=frontier.slice(i,i+300);
    const r=await sparql(`SELECT ?h ?n WHERE { VALUES ?h { ${chunk.map(c=>'wd:'+c[1]).join(' ')} } { ?h wdt:P17 ?n } UNION { ?h wdt:P1366 ?n } }`);
    const nx={};for(const b of r)(nx[id(b.h.value)]=nx[id(b.h.value)]||[]).push(id(b.n.value));
    for(const [orig,cur] of chunk){const ns=nx[cur]||[];const hit=ns.find(n=>S.has(n));if(hit)map[orig]=hit;else if(ns.length)next.push([orig,ns[0]])}}
  frontier=next.filter(([o,c])=>c!==o);console.log('round',round,'resolved',Object.keys(map).length,'still',frontier.length)}
fs.writeFileSync('countrymap.json',JSON.stringify(map));
