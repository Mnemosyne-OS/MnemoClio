import fs from 'fs';import {sparql} from './q2.mjs';
const id=u=>u?u.split('/').pop():null;
const ev=JSON.parse(fs.readFileSync('events_raw.json'));
const S=new Set(JSON.parse(fs.readFileSync('../w/countries.json')).results.bindings.map(b=>id(b.c.value)));
const M=JSON.parse(fs.readFileSync('countrymap.json'));
const res=v=>S.has(v)?v:M[v]||null;
// persons are always re-resolved (one sampled citizenship is arbitrary); others only when they have no country
const todo=ev.filter(e=>e.k==='person'||!e.c);console.log('à résoudre',todo.length);
const src={};const add=(x,s,c)=>{(src[x]=src[x]||{})[s]=(src[x][s]||[]);src[x][s].push(c)};
for(let i=0;i<todo.length;i+=250){const ids=todo.slice(i,i+250).map(e=>'wd:'+e.id).join(' ');
  const r=await sparql(`SELECT ?x ?s ?c WHERE { VALUES ?x { ${ids} } {
    ?x wdt:P27 ?c BIND("cit" AS ?s) } UNION { ?x wdt:P19 ?l . ?l wdt:P17 ?c BIND("birth" AS ?s) } UNION { ?x wdt:P17 ?c BIND("country" AS ?s) } UNION { ?x wdt:P495 ?c BIND("origin" AS ?s) }
    UNION { ?x wdt:P170|wdt:P50|wdt:P86|wdt:P57|wdt:P61|wdt:P175 ?a . ?a wdt:P27 ?c BIND("author" AS ?s) } UNION { ?x wdt:P276 ?l . ?l wdt:P17 ?c BIND("place" AS ?s) } }`);
  for(const b of r)add(id(b.x.value),b.s.value,id(b.c.value))}
// climb values still unknown (historical states) to a current one
const unk=[...new Set(Object.values(src).flatMap(o=>Object.values(o).flat()))].filter(v=>!S.has(v)&&!M[v]);let frontier=unk.map(u=>[u,u]);
for(let round=0;round<4&&frontier.length;round++){const next=[];
  for(let i=0;i<frontier.length;i+=300){const chunk=frontier.slice(i,i+300);
    const r=await sparql(`SELECT ?h ?n WHERE { VALUES ?h { ${chunk.map(c=>'wd:'+c[1]).join(' ')} } { ?h wdt:P17 ?n } UNION { ?h wdt:P1366 ?n } }`);
    const nx={};for(const b of r)(nx[id(b.h.value)]=nx[id(b.h.value)]||[]).push(id(b.n.value));
    for(const [o,cur] of chunk){const ns=nx[cur]||[];const hit=ns.find(n=>S.has(n));if(hit)M[o]=hit;else if(ns.length)next.push([o,ns[0]])}}
  frontier=next.filter(([o,c])=>c!==o)}
fs.writeFileSync('countrymap.json',JSON.stringify(M));
const pick=x=>{const s=src[x]||{};const cits=(s.cit||[]).map(res).filter(Boolean);const births=new Set((s.birth||[]).map(res).filter(Boolean));
  const both=cits.find(c=>births.has(c));if(both)return both;
  if(cits.length){const n={};for(const c of cits)n[c]=(n[c]||0)+1;return Object.entries(n).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0]}
  for(const k of ['country','origin','author','birth','place']){const c=(s[k]||[]).map(res).find(Boolean);if(c)return c}
  return null};
let changed=0;for(const e of todo){const c=pick(e.id);if(c&&c!==e.c){e.c=c;changed++}
  // every raw value read for it, citizenships first: a polity lane looks for itself among them
  const s=src[e.id]||{};e.raw=[...new Set([...(s.cit||[]),...(s.country||[]),...(s.origin||[]),...(s.author||[]),...(e.raw||[])])]}
fs.writeFileSync('events_raw.json',JSON.stringify(ev));
const per={};for(const e of ev)if(!e.c)per[e.k]=(per[e.k]||0)+1;
console.log('changés',changed,'sans pays',ev.filter(e=>!e.c).length,JSON.stringify(per));
for(const q of ['Q937','Q7199','Q5582','Q1035','Q91'])console.log(q,ev.find(e=>e.id===q)?.c);
