import fs from 'fs';
const ev=JSON.parse(fs.readFileSync('events_raw.json'));const L=JSON.parse(fs.readFileSync('labels_ev.json'));
const qs=[...new Set(ev.map(e=>e.id).filter(q=>!(L[q]&&(L[q].fr||L[q]._fr))))];console.log('sans fr à vérifier',qs.length);
for(let i=0;i<qs.length;i+=50){const b=qs.slice(i,i+50);
  const j=await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${b.join('|')}&languages=fr`,{headers:{'User-Agent':'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)'}})).json();
  for(const q of b){L[q]=L[q]||{};const v=j.entities?.[q]?.labels?.fr;if(v)L[q].fr=v.value;else L[q]._fr=1}}
fs.writeFileSync('labels_ev.json',JSON.stringify(L));console.log('vraiment sans fr',qs.filter(q=>L[q]._fr).length);
