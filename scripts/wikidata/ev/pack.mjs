import fs from 'fs';
const ev=JSON.parse(fs.readFileSync('events_raw.json'));const L=JSON.parse(fs.readFileSync('labels_ev.json'));
const D=JSON.parse(fs.readFileSync('../data.json'));const CI=Object.fromEntries(D.countries.map((c,i)=>[c.id,i]));
// polities (ended states, territories) come after today's states, in polities.json order: the index split.mjs gives them
const POL=fs.existsSync('../polities.json')?JSON.parse(fs.readFileSync('../polities.json')):[];const PI=Object.fromEntries(POL.map((p,i)=>[p.id,D.countries.length+i]));
const LANG=Object.fromEntries(D.countries.map(c=>[c.id,c.lang]));
const KINDS=['person','discovery','work','knowledge','building','treaty','disaster','exploration','society','movement','sport','subdivision','election','law','city','company','violence'];
const langs=[];const li=l=>{let i=langs.indexOf(l);if(i<0){i=langs.length;langs.push(l)}return i};
const subs=[];const si=s=>{if(!s)return -1;let i=subs.indexOf(s);if(i<0){i=subs.length;subs.push(s)}return i};
const out=[];let noLabel=0,noFr=0;
for(const e of ev){const l=L[e.id];if(!l){noLabel++;continue}
  const cl=e.c?LANG[e.c]:null;const zh=cl==='zh'||cl==='zh-cn';
  const own=cl&&(l[cl]||(zh&&(l.zh||l['zh-cn']))||l.mul);
  const o=own||l.en||l.mul||l.fr;if(!o){noLabel++;continue}
  const ol=own?cl:(l.en?'en':'fr');const f=l.fr||l.mul||0;if(!f)noFr++;
  const subQ=e.k==='person'?e.occ:e.t;const sub=subQ&&L[subQ]?(L[subQ].fr||L[subQ].en):null;
  const h=(e.raw||[]).map((r)=>PI[r]).find((v)=>v!==undefined);
  out.push([KINDS.indexOf(e.k),e.y,e.c!=null&&CI[e.c]!=null?CI[e.c]:-1,e.lon,e.lat,e.sl,o,li(ol),f===o?1:f,si(sub),+e.id.slice(1),h??-1,...(e.a?[1]:[])]);}
const cap=JSON.parse(fs.readFileSync('capinfo.json'));
fs.writeFileSync('../events.json',JSON.stringify({kinds:KINDS,langs,subs,cap,e:out}));
const per={};for(const x of out){const k=KINDS[x[0]];per[k]=per[k]||[0,0,0];per[k][0]++;if(x[2]<0)per[k][1]++;if(x[8]===0)per[k][2]++}
console.log('events',out.length,'no label',noLabel,'no fr',noFr,'size',fs.statSync('../events.json').size);console.log(per);
