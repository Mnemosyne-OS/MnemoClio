import fs from 'fs';
const id=u=>u.split('/').pop();
const L=JSON.parse(fs.readFileSync('labels.json'));
const countries=JSON.parse(fs.readFileSync('countries.json')).results.bindings;
const C=new Set(countries.map(x=>id(x.c.value)));
const langs=[...new Set(['fr','en','zh',...countries.map(c=>c.lang&&c.lang.value).filter(Boolean)])];
const need=new Set();
for(const x of JSON.parse(fs.readFileSync('battles2.json')).results.bindings){if(!C.has(id(x.c.value)))continue;for(const k of ['b','p','w'])if(!L[id(x[k].value)])need.add(id(x[k].value))}
console.log('missing labels',need.size);
const all=[...need];const q=[];for(let i=0;i<all.length;i+=50)q.push(all.slice(i,i+50));
await Promise.all(Array.from({length:4},async()=>{while(q.length){const b=q.shift();for(let li=0;li<langs.length;li+=40){
  const url=`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${b.join('|')}&languages=${langs.slice(li,li+40).join('|')}`;
  for(let t=0;t<3;t++){try{const j=await (await fetch(url,{headers:{'User-Agent':'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)'}})).json();
    for(const [k,e] of Object.entries(j.entities||{})){L[k]=L[k]||{};for(const [l,v] of Object.entries(e.labels||{}))L[k][l]=v.value}break}catch(e){await new Promise(r=>setTimeout(r,1500))}}}}}));
fs.writeFileSync('labels.json',JSON.stringify(L));console.log('labels',Object.keys(L).length);
