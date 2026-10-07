const UA='MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)';
// retries 429 / 5xx with a growing wait; the last failure is thrown, never swallowed
export async function sparql(q,ms=170000){let last;
  for(let t=0;t<4;t++){try{const r=await fetch('https://query.wikidata.org/sparql',{method:'POST',headers:{'User-Agent':UA,'Accept':'application/sparql-results+json','Content-Type':'application/x-www-form-urlencoded'},body:'query='+encodeURIComponent(q),signal:AbortSignal.timeout(ms)});
    const s=await r.text();if(r.ok)return JSON.parse(s).results.bindings;last=new Error('HTTP '+r.status+' '+s.slice(0,80));
    if(r.status!==429&&r.status<500)throw last;}catch(e){last=e}
    await new Promise(r=>setTimeout(r,(t+1)*15000))}
  throw last}
