import fs from 'fs';
const L=JSON.parse(fs.readFileSync('labels.json'));const qs=Object.keys(L);let n=0;
for(let i=0;i<qs.length;i+=50){const b=qs.slice(i,i+50);
  for(let t=0;t<4;t++){try{const j=await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${b.join('|')}&languages=mul`,{headers:{'User-Agent':'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)'},signal:AbortSignal.timeout(30000)})).json();
    for(const q of b){const v=j.entities?.[q]?.labels?.mul;if(v){L[q].mul=v.value;n++}}break}catch(e){await new Promise(r=>setTimeout(r,2000))}}}
fs.writeFileSync('labels.json',JSON.stringify(L));console.log('mul',n,'sur',qs.length);
