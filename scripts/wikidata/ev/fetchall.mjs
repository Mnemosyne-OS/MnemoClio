import fs from 'fs';import {sparql} from './q2.mjs';
// kind -> [types], date props, floor of sitelinks, extra country path
const K={
 work2:{types:['Q105543609','Q7889','Q5398426'],date:'wdt:P577|wdt:P571',floor:18,creator:'wdt:P170|wdt:P50|wdt:P86|wdt:P57|wdt:P175|wdt:P178'},
 work:{types:['Q3305213','Q7725634','Q8261','Q25379','Q1344','Q207628','Q11424','Q860861','Q482994'],date:'wdt:P577|wdt:P571',floor:18,creator:'wdt:P170|wdt:P50|wdt:P86|wdt:P57|wdt:P175'},
 knowledge:{types:['Q3918','Q7075','Q33506','Q207694','Q11032','Q1254933','Q16917','Q5633421','Q5292','Q172754','Q1664720'],date:'wdt:P571',floor:8},
 building:{types:['Q2977','Q16560','Q12280','Q12518','Q11303','Q23413','Q32815','Q44539','Q4989906','Q12323','Q483110','Q12284','Q839954','Q16970'],date:'wdt:P571|wdt:P1619',floor:10},
 treaty:{types:['Q131569','Q625298','Q7755','Q1464916','Q1219394'],date:'wdt:P585|wdt:P571|wdt:P577',floor:3},
 disaster:{types:['Q7944','Q44512','Q12184','Q168247','Q8065','Q8070','Q3839081','Q168983'],date:'wdt:P585|wdt:P580',floor:5},
 exploration:{types:['Q2401485','Q752783','Q2133344'],date:'wdt:P580|wdt:P585|wdt:P619',floor:4},
 society:{types:['Q10931','Q124734','Q45382','Q49776','Q273120','Q175331','Q49773'],date:'wdt:P580|wdt:P585|wdt:P571',floor:6},
 movement:{types:['Q968159','Q1826286'],date:'wdt:P571|wdt:P580',floor:8},
 // sport comes from sport.mjs alone (editions of the Games and the World Cups)
};
const out={};
const q=(k,t,cfg)=>`SELECT ?x (MIN(?d0) AS ?d) (MAX(?sl0) AS ?sl) (SAMPLE(?a1) AS ?c1) (SAMPLE(?a2) AS ?c2) (SAMPLE(?a3) AS ?c3) (SAMPLE(?co) AS ?coord) WHERE {
 ?x ${cfg.sub?'wdt:P31/wdt:P279?':'wdt:P31'} wd:${t} ; wikibase:sitelinks ?sl0 . FILTER(?sl0 >= ${cfg.floor})
 ?x ${cfg.date.replace(/wdt:/g,'p:')} ?st0 . FILTER NOT EXISTS { ?st0 wikibase:rank wikibase:DeprecatedRank } ?st0 ${cfg.date.replace(/wdt:/g,'psv:')} ?dv . ?dv wikibase:timeValue ?dt ; wikibase:timePrecision ?pr . OPTIONAL { ?st0 pq:P580 ?qs } BIND(IF(?pr >= 9, ?dt, ?qs) AS ?d0) FILTER(BOUND(?d0)) FILTER(YEAR(?d0) >= -3500 && YEAR(?d0) <= 2025)
 OPTIONAL { ?x wdt:P17 ?a1 } OPTIONAL { ?x wdt:P495 ?a2 } OPTIONAL { ?x wdt:P625 ?co }
 ${cfg.creator?`OPTIONAL { ?x ${cfg.creator} ?cr . ?cr wdt:P27 ?a3 }`:''}
} GROUP BY ?x`;
const only=process.argv.slice(2);
for(const [k,cfg] of Object.entries(K)){if(only.length&&!only.includes(k))continue;out[k]=[];
  for(const t of cfg.types){const t0=Date.now();
    try{const r=await sparql(q(k,t,cfg));for(const b of r)out[k].push({...Object.fromEntries(Object.entries(b).map(([n,v])=>[n,v.value])),t});console.log(k,t,r.length,((Date.now()-t0)/1000).toFixed(1)+'s')}
    catch(e){console.log(k,t,'FAIL',e.message.slice(0,80))}}
  fs.writeFileSync('k_'+k+'.json',JSON.stringify(out[k]));}
