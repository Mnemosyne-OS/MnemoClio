import fs from 'fs';
const L=JSON.parse(fs.readFileSync('labels.json'));const ids=Object.keys(L);
for(let i=0;i<ids.length;i+=50){const url=`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${ids.slice(i,i+50).join('|')}&languages=zh`;
 const j=await (await fetch(url,{headers:{'User-Agent':'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)'}})).json();
 for(const [k,e] of Object.entries(j.entities||{}))if(e.labels&&e.labels.zh)L[k].zh=e.labels.zh.value}
fs.writeFileSync('labels.json',JSON.stringify(L));
const c=JSON.parse(fs.readFileSync('countries.json'));for(const b of c.results.bindings)if(b.lang&&b.lang.value==='zh-cn')b.lang.value='zh';fs.writeFileSync('countries.json',JSON.stringify(c));console.log('ok');
