import fs from 'fs';import {sparql} from './q2.mjs';
const out=[];
// Windows of birth years. Antiquity and the Middle Ages are sparse (long windows); from 1450,
// 25-year windows, except the two densest quarter-centuries which time out whole (5-year windows).
const WIN=[[-3500,2500],[-1000,500],[-500,250],[-250,250],[0,250],[250,250],[500,250],[750,250],[1000,150],[1150,150],[1300,150]];
for(let y=1450;y<2010;y+=25){if(y===1925||y===1975)for(let k=0;k<25;k+=5)WIN.push([y+k,5]);else WIN.push([y,25])}
// an xsd:dateTime year has at least four digits and a sign before Christ: -0500 is 500 BC
const iso=(y)=>(y<0?'-':'')+String(Math.abs(y)).padStart(4,'0')+'-01-01T00:00:00Z';
// Before 500 the bar is 10 Wikipedias (45 after): an ancient figure is rarely in 45 languages,
// and the 45 cut kept 589 of ~3 000 known with a year. Same rule as every other subject: a birth
// counts only at year precision (Khufu "born -2700" is a century, not a year, and was shown as one).
// The precision is checked in a second pass by id: inside the window query it made 1925-1930 time out.
const bar=(y)=>(y<500?10:45);
for(const [y,span] of WIN){const t0=Date.now();
  const q=`SELECT ?x (SAMPLE(?d0) AS ?d) (MAX(?sl0) AS ?sl) (SAMPLE(?a1) AS ?c1) (SAMPLE(?o) AS ?occ) (SAMPLE(?co) AS ?coord) WHERE {
   ?x wdt:P569 ?d0 . hint:Prior hint:rangeSafe true . FILTER(?d0 >= "${iso(y)}"^^xsd:dateTime && ?d0 < "${iso(y+span)}"^^xsd:dateTime)
   ?x wikibase:sitelinks ?sl0 . FILTER(?sl0 >= ${bar(y)}) ?x wdt:P31 wd:Q5 .
   OPTIONAL { ?x wdt:P27 ?a1 } OPTIONAL { ?x wdt:P106 ?o } OPTIONAL { ?x wdt:P19 ?bp . ?bp wdt:P625 ?co } } GROUP BY ?x`;
  let ok=false;
  for(let tr=0;tr<2&&!ok;tr++){try{const r=await sparql(q);for(const b of r)out.push({...Object.fromEntries(Object.entries(b).map(([n,v])=>[n,v.value])),t:'Q5'});console.log(y,span,r.length,((Date.now()-t0)/1000).toFixed(1)+'s');ok=true}catch(e){console.log(y,span,'FAIL',e.message.slice(0,60))}}
  // a window that times out is read again in two halves (1950-1955 was lost once, in silence);
  // a single year that still fails stops the chain rather than ship a hole
  if(!ok){if(span<=1)throw new Error('births '+y+': Wikidata timed out on a single year');const h=Math.ceil(span/2);WIN.push([y,h],[y+h,span-h])}}
const precise=new Map();const ids=[...new Set(out.map(o=>o.x.split('/').pop()))];
// Before 500 a birth known only to the decade or century (precision 8 or 7) is kept too, marked
// approximate (a: 1): the app writes it "c. 400 BC", never as an exact year. After 500, year only.
const approx=new Map();
for(let i=0;i<ids.length;i+=300){const r=await sparql(`SELECT ?x ?dt ?pr WHERE { VALUES ?x { ${ids.slice(i,i+300).map(q=>'wd:'+q).join(' ')} }
  ?x p:P569 ?st . FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank } ?st psv:P569 ?dv . ?dv wikibase:timeValue ?dt ; wikibase:timePrecision ?pr . FILTER(?pr >= 7) }`);
  for(const b of r){const pr=+b.pr.value,d=b.dt.value,x=b.x.value;
    if(pr>=9){if(!precise.has(x)||parseInt(d,10)<parseInt(precise.get(x),10))precise.set(x,d)}
    else if(parseInt(d,10)<500&&!approx.has(x))approx.set(x,d)}}
// the year-precise birth replaces the sampled one; a person with none is left out
const kept=out.filter(o=>precise.has(o.x)||approx.has(o.x)).map(o=>precise.has(o.x)?{...o,d:precise.get(o.x)}:{...o,d:approx.get(o.x),a:1});
console.log('births at year precision',kept.filter(o=>!o.a).length,'approximate before 500',kept.filter(o=>o.a).length,'of',out.length);
fs.writeFileSync('k_person.json',JSON.stringify(kept));
