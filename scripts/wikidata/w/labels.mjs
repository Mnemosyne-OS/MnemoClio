import fs from 'fs';
const J=n=>JSON.parse(fs.readFileSync(n+'.json')).results.bindings;
const id=u=>u.split('/').pop();
const countries=J('countries').map(x=>({id:id(x.c.value),lang:x.lang?x.lang.value:null}));
const C=new Set(countries.map(c=>c.id));
const ids=new Set(countries.map(c=>c.id));
for(const x of J('battles')){if(!C.has(id(x.c.value)))continue;ids.add(id(x.b.value));ids.add(id(x.w.value))}
for(const x of J('states')){if(!C.has(id(x.c.value)))continue;ids.add(id(x.st.value));if(x.next)ids.add(id(x.next.value))}
const langs=[...new Set(['fr','en',...countries.map(c=>c.lang).filter(Boolean)])];
console.log('ids',ids.size,'langs',langs.length);
const all=[...ids];const out={};
const batches=[];for(let i=0;i<all.length;i+=50)batches.push(all.slice(i,i+50));
let done=0;
async function run(b){
  // language list may be long; split langs in chunks of 40
  for(let li=0;li<langs.length;li+=40){
    const url=`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${b.join('|')}&languages=${langs.slice(li,li+40).join('|')}`;
    for(let t=0;t<3;t++){try{const r=await fetch(url,{headers:{'User-Agent':'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)'}});const j=await r.json();
      for(const [k,e] of Object.entries(j.entities||{})){out[k]=out[k]||{};for(const [l,v] of Object.entries(e.labels||{}))out[k][l]=v.value}break}catch(e){await new Promise(r=>setTimeout(r,1500))}}
  }
  done++;
}
const queue=[...batches];await Promise.all(Array.from({length:4},async()=>{while(queue.length)await run(queue.shift())}));
fs.writeFileSync('labels.json',JSON.stringify(out));console.log('labelled',Object.keys(out).length,'batches',done);
