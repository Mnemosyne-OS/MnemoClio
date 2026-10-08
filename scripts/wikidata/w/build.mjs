import fs from 'fs';
const J=n=>JSON.parse(fs.readFileSync(n+'.json')).results.bindings;
const id=u=>u.split('/').pop(), yr=v=>v?parseInt(v.value.replace(/^\+/,''),10):null;
const L=JSON.parse(fs.readFileSync('labels.json'));
const counts=Object.fromEntries(J('counts').map(x=>[id(x.c.value),+x.n.value]));
const countries=J('countries').map(x=>({id:id(x.c.value),lang:x.lang?x.lang.value:null}));
const langOf=Object.fromEntries(countries.map(c=>[c.id,c.lang]));
// label pack: o = original language (country's own), f = French, e = English ; only what Wikidata has
const lab=(qid,cid)=>{const l=L[qid]||{};const lg=langOf[cid];const own=(lg&&l[lg])||l.mul;const o=own||l.en||l.fr||qid;return {o,ol:own?(lg||'en'):(l.en?'en':'fr'),f:l.fr||l.mul||null}};
const C=countries.map(c=>({id:c.id,lang:c.lang,...lab(c.id,c.id),n:counts[c.id]||0})).sort((a,b)=>b.n-a.n);
const S=new Set(C.map(c=>c.id));
// one battle -> the NEAREST war above it (the deepest one in its chain of "part of") and its
// direct parent (front, campaign). A war that contains other wars becomes a PERIOD instead.
const rows=J("battles2").filter(x=>S.has(id(x.c.value)));
const anc={};for(const x of J("warlinks")){const a=id(x.a.value),b=id(x.b.value);(anc[a]=anc[a]||new Set()).add(b)}
const warSize={};const seenWB=new Set();const warsOf={};const warDates={};
for(const x of rows){const b=id(x.b.value),w=id(x.w.value);warDates[w]=[yr(x.ws),yr(x.we)];const k=w+"|"+b;if(seenWB.has(k))continue;seenWB.add(k);warSize[w]=(warSize[w]||0)+1;(warsOf[b]=warsOf[b]||new Set()).add(w)}
const depth=(w,set)=>[...set].filter(o=>o!==w&&anc[w]&&anc[w].has(o)).length;
const pick={};
for(const x of rows){const b=id(x.b.value),w=id(x.w.value);const set=warsOf[b];const cur=pick[b];
  if(!cur){pick[b]={w,x};continue}
  const dw=depth(w,set),dc=depth(cur.w,set);
  if(dw>dc||(dw===dc&&warSize[w]<warSize[cur.w]))pick[b]={w,x}}
const wars={};
for(const [bid,{w,x}] of Object.entries(pick)){const c=id(x.c.value);
  wars[w]=wars[w]||{id:w,s:yr(x.ws),e:yr(x.we),b:{}};
  let lon=null,lat=null;if(x.coord){const m=x.coord.value.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);if(m){lon=+(+m[1]).toFixed(2);lat=+(+m[2]).toFixed(2)}}
  const p=id(x.p.value);
  wars[w].b[bid]={id:bid,y:yr(x.d),c,lon,lat,g:p===w?null:p};}
const W=Object.values(wars).map(w=>{const bs=Object.values(w.b).sort((a,b)=>a.y-b.y);const cnt={};for(const b of bs)cnt[b.c]=(cnt[b.c]||0)+1;
  const c=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
  const groups={};for(const b of bs)if(b.g&&!groups[b.g])groups[b.g]=lab(b.g,c);
  return {id:w.id,c,s:w.s??bs[0].y,e:w.e??bs.at(-1).y,...lab(w.id,c),groups,b:bs.map(b=>({...lab(b.id,b.c),q:b.id,y:b.y,c:b.c,lon:b.lon,lat:b.lat,g:b.g}))}});
// periods: a war that sits above at least two of the wars kept here
const kept=new Set(W.map(w=>w.id));const kids={};
for(const w of W)for(const a of (anc[w.id]||[]))(kids[a]=kids[a]||[]).push(w.id);
const P=Object.entries(kids).filter(([a,k])=>k.length>=2).map(([a,k])=>{const ch=W.filter(w=>k.includes(w.id));
  const [ds,de]=warDates[a]||[null,null];
  return {id:a,...lab(a,'Q0'),s:ds??Math.min(...ch.map(w=>w.s)),e:de??Math.max(...ch.map(w=>w.e)),kids:k,alsoWar:kept.has(a)}}).sort((a,b)=>a.s-b.s);
console.log('periods',P.length,P.map(p=>(p.f||p.o)+' '+p.s+'-'+p.e+' ['+p.kids.length+']').join(' ; '));
const seen=new Set();const ST=[];
for(const x of J('states')){const c=id(x.c.value);if(!S.has(c))continue;const k=id(x.st.value)+'|'+c+'|'+(x.next?x.next.value:'');if(seen.has(k))continue;seen.add(k);
  const nx=x.next?id(x.next.value):null;
  ST.push({id:id(x.st.value),c,s:yr(x.s),e:yr(x.e),next:nx,nl:nx?lab(nx,c):null,...lab(id(x.st.value),c)});}
const out={countries:C,wars:W,states:ST,periods:P};fs.writeFileSync('../data.json',JSON.stringify(out));
const noFr=[...W.flatMap(w=>[w,...w.b]),...ST].filter(x=>!x.f).length, tot=W.reduce((a,w)=>a+1+w.b.length,0)+ST.length;
console.log('size',JSON.stringify(out).length,'countries',C.length,'with data',new Set([...W.map(w=>w.c),...ST.map(s=>s.c)]).size,'wars',W.length,'states',ST.length,'items',tot,'sans fr',noFr);
console.log(C.slice(0,12).map(c=>c.o+'/'+c.f+':'+c.n).join(' '));
console.log(ST.filter(s=>s.c==='Q17').slice(0,4).map(s=>s.o+' | '+s.f).join(' ; '));
