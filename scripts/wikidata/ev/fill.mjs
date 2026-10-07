import fs from 'fs';
const ev=JSON.parse(fs.readFileSync('events_raw.json'));const L=JSON.parse(fs.readFileSync('labels_ev.json'));
const miss=[...new Set(ev.map(e=>e.id).filter(q=>!L[q]||!(L[q].en||L[q].fr)))];console.log('missing',miss.length);
for(let i=0;i<miss.length;i+=50){const url=`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${miss.slice(i,i+50).join('|')}&languages=fr|en&languagefallback=1`;
  const j=await (await fetch(url,{headers:{'User-Agent':'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)'}})).json();
  if(j.error)console.log(j.error.info);
  for(const [k,e] of Object.entries(j.entities||{})){L[k]=L[k]||{};for(const [ll,v] of Object.entries(e.labels||{}))L[k][ll]=v.value}}
fs.writeFileSync('labels_ev.json',JSON.stringify(L));console.log('still',ev.filter(e=>!L[e.id]||!(L[e.id].en||L[e.id].fr)).length);
