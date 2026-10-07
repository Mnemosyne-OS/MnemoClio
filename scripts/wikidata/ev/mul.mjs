import fs from 'fs';
const ev=JSON.parse(fs.readFileSync('events_raw.json'));const L=JSON.parse(fs.readFileSync('labels_ev.json'));
// "mul" = one label valid in every language (most person names); it counts as fr AND as the original language
const qs=[...new Set(ev.map(e=>e.id))].filter(q=>L[q]&&!L[q].mul_checked);
for(let i=0;i<qs.length;i+=50){const b=qs.slice(i,i+50);
  for(let t=0;t<4;t++){try{const j=await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${b.join('|')}&languages=mul`,{headers:{'User-Agent':'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)'},signal:AbortSignal.timeout(30000)})).json();
    for(const q of b){const v=j.entities?.[q]?.labels?.mul;if(v)L[q].mul=v.value;L[q].mul_checked=1}break}catch(e){await new Promise(r=>setTimeout(r,2000))}}}
fs.writeFileSync('labels_ev.json',JSON.stringify(L));console.log('avec mul',qs.filter(q=>L[q].mul).length,'sur',qs.length);
