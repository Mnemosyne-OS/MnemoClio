import fs from 'fs';
const id=u=>u?u.split('/').pop():null, yr=v=>v?parseInt(String(v).replace(/^\+/,''),10):null;
const CB=JSON.parse(fs.readFileSync('../w/countries.json')).results.bindings;
const S=new Set(CB.map(b=>id(b.c.value)));const LANG=Object.fromEntries(CB.map(b=>[id(b.c.value),b.lang?b.lang.value:null]));
const M=JSON.parse(fs.readFileSync('countrymap.json'));
const res=c=>c&&(S.has(c)?c:M[c]||null);
const SRC={discovery:['discovery'],person:['person'],work:['work','work2'],knowledge:['knowledge'],building:['building'],treaty:['treaty'],disaster:['disaster'],exploration:['exploration'],society:['society'],movement:['movement'],sport:['sport'],subdivision:['subdivision'],election:['election'],law:['law'],city:['city'],company:['company'],violence:['violence']};
// caps: the N most-known by number of Wikipedias (sitelinks); per sub-type for works
const CAP={person:12000};const SUBCAP={Q11424:2500,Q7889:800};
const ev=[];const capInfo={};
for(const [k,files] of Object.entries(SRC)){const seen=new Map();
  for(const f of files)for(const o of JSON.parse(fs.readFileSync('k_'+f+'.json'))){if(seen.has(o.x))continue;
    const y=yr(o.d);if(y==null||y< -3500||y>2025)continue;
    const c=[o.c1,o.c2,o.c3].map(id).map(res).find(Boolean)||null;
    let lon=null,lat=null;if(o.coord){const m=o.coord.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);if(m){lon=+(+m[1]).toFixed(2);lat=+(+m[2]).toFixed(2)}}
    seen.set(o.x,{k,id:id(o.x),y,c,raw:[o.c1,o.c2,o.c3].map(id).filter(Boolean),lon,lat,sl:+o.sl,t:o.t?id(o.t):null,occ:o.occ?id(o.occ):null,...(o.a?{a:1}:{})})}
  let list=[...seen.values()].sort((a,b)=>b.sl-a.sl);
  const bySub={};list=list.filter(e=>{const cap=SUBCAP[e.t];if(!cap)return true;bySub[e.t]=(bySub[e.t]||0)+1;return bySub[e.t]<=cap});
  // the cap ranks by Wikipedias, where Antiquity always loses: it applies from 500 on only
  const total=list.length;if(CAP[k])list=[...list.filter(e=>e.y<500),...list.filter(e=>e.y>=500).slice(0,CAP[k])].sort((a,b)=>b.sl-a.sl);
  capInfo[k]={kept:list.length,total,minSl:list.length?list.at(-1).sl:0};
  ev.push(...list);}
fs.writeFileSync('events_raw.json',JSON.stringify(ev));fs.writeFileSync('capinfo.json',JSON.stringify(capInfo));
console.log('events',ev.length,JSON.stringify(capInfo));
// ids to label + the language of each
const need={};const add=(q,l)=>{(need[q]=need[q]||new Set()).add(l)};
for(const e of ev){add(e.id,e.c?LANG[e.c]:null);if(e.occ)add(e.occ,null);if(e.t)add(e.t,null)}
const L=fs.existsSync('labels_ev.json')?JSON.parse(fs.readFileSync('labels_ev.json')):{};
const groups={};for(const [q,ls] of Object.entries(need)){if(L[q])continue;const l=[...ls].filter(Boolean)[0]||'';(groups[l]=groups[l]||[]).push(q)}
let calls=0;const jobs=[];for(const [l,qs] of Object.entries(groups))for(let i=0;i<qs.length;i+=50)jobs.push([l,qs.slice(i,i+50)]);
console.log('label calls',jobs.length);
await Promise.all(Array.from({length:5},async()=>{while(jobs.length){const [l,qs]=jobs.shift();const langs=['fr','en',...(l?[l]:[]),...(l==='zh-cn'?['zh']:[])].join('|');
  const url=`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${qs.join('|')}&languages=${langs}`;
  for(let t=0;t<4;t++){try{const j=await (await fetch(url,{headers:{'User-Agent':'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)'},signal:AbortSignal.timeout(30000)})).json();
    for(const [k,e] of Object.entries(j.entities||{})){L[k]=L[k]||{};for(const [ll,v] of Object.entries(e.labels||{}))L[k][ll]=v.value}calls++;break}catch(e){await new Promise(r=>setTimeout(r,2000))}}}}));
fs.writeFileSync('labels_ev.json',JSON.stringify(L));console.log('calls ok',calls,'labelled',Object.keys(L).length);
