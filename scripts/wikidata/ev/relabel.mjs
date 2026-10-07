import fs from 'fs';
const ev=JSON.parse(fs.readFileSync('events_raw.json'));const L=JSON.parse(fs.readFileSync('labels_ev.json'));
const LANG=Object.fromEntries(JSON.parse(fs.readFileSync('../w/countries.json')).results.bindings.map(b=>[b.c.value.split('/').pop(),b.lang?b.lang.value:null]));
const groups={};for(const e of ev){const l=e.c&&LANG[e.c];if(!l)continue;const have=L[e.id]||{};if(have[l]||have['_'+l])continue;(groups[l]=groups[l]||[]).push(e.id)}
const jobs=[];for(const [l,qs] of Object.entries(groups))for(let i=0;i<qs.length;i+=50)jobs.push([l,qs.slice(i,i+50)]);
console.log('appels',jobs.length);let ok=0;
await Promise.all(Array.from({length:4},async()=>{while(jobs.length){const [l,qs]=jobs.shift();
  const url=`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${qs.join('|')}&languages=${l}${l==='zh'?'|zh-cn|zh-hans':''}`;
  for(let t=0;t<4;t++){try{const j=await (await fetch(url,{headers:{'User-Agent':'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)'},signal:AbortSignal.timeout(30000)})).json();
    for(const q of qs){L[q]=L[q]||{};const e=j.entities&&j.entities[q];const v=e&&e.labels&&(e.labels[l]||e.labels['zh-hans']||e.labels['zh-cn']);if(v)L[q][l]=v.value;else L[q]['_'+l]=1}ok++;break}catch(e){await new Promise(r=>setTimeout(r,2000))}}}}));
fs.writeFileSync('labels_ev.json',JSON.stringify(L));console.log('ok',ok);
