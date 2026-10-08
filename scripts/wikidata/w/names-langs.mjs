// names-langs.mjs — the name of every item in each language of the app.
//
// Field, 07/10: "if I am in Spanish I want the titles in my language… do it for everyone, not
// for me". The data had the original name and the French one only, so "French names" was the
// one translation offered, to everyone. This reads Wikidata's labels of every item the
// cartridge names (events, wars, battles, fronts, regimes, periods, leaders, offices) in
// en/es/de/pt/ru/zh. A language with no label is absent: the app then shows the original name,
// never a guessed translation. Countries are named by country-langs.mjs.
//
// Reruns are cheap: what was read before is kept (names-langs.json is the cache).
// split.mjs writes one public file per language, loaded only when someone asks for it.
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const UA = 'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)';
const WANT = ['en', 'es', 'de', 'pt', 'ru', 'zh'];
const ASK = ['en', 'es', 'de', 'pt', 'ru', 'zh', 'zh-hans', 'zh-cn'];

const read = (f) => JSON.parse(fs.readFileSync(join(here, f), 'utf8'));
const ids = new Set();
const data = read('../data.json');
for (const w of data.wars ?? []) {
  ids.add(w.id);
  for (const b of w.b ?? []) if (b.q) ids.add(b.q);
  for (const g of Object.keys(w.groups ?? {})) ids.add(g);
}
for (const r of data.states ?? []) ids.add(r.id);
for (const p of data.periods ?? []) ids.add(p.id);
if (fs.existsSync(join(here, 'leaders.json'))) for (const l of read('leaders.json').leaders) { ids.add(l.q); ids.add(l.office); }
for (const r of read('../events.json').e) ids.add('Q' + r[10]);
const all = [...ids].filter((q) => /^Q\d+$/.test(q));

const cacheFile = join(here, 'names-langs.json');
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
const todo = all.filter((q) => !(q in cache));
console.log('items', all.length, 'already read', all.length - todo.length, 'to read', todo.length);

async function labels(chunk) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=labels&languages=${ASK.join('|')}&format=json`;
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return (await r.json()).entities ?? {};
      if (r.status !== 429 && r.status < 500) throw new Error('HTTP ' + r.status);
    } catch (e) { if (t === 4) throw e; }
    await new Promise((res) => setTimeout(res, (t + 1) * 10000));
  }
  throw new Error('labels: no answer');
}

let done = 0;
for (let i = 0; i < todo.length; i += 50) {
  const chunk = todo.slice(i, i + 50);
  const ents = await labels(chunk);
  for (const q of chunk) {
    const l = ents[q]?.labels ?? {};
    const pick = (...ks) => ks.map((k) => l[k]?.value).find(Boolean);
    const n = { en: pick('en'), es: pick('es'), de: pick('de'), pt: pick('pt'), ru: pick('ru'), zh: pick('zh-hans', 'zh-cn', 'zh') };
    // an item read and found with no label at all is kept as {}: read, not to be asked again
    cache[q] = Object.fromEntries(Object.entries(n).filter(([, v]) => v));
  }
  done += chunk.length;
  if ((i / 50) % 100 === 0) { fs.writeFileSync(cacheFile, JSON.stringify(cache)); console.log('read', done, 'of', todo.length); }
}
fs.writeFileSync(cacheFile, JSON.stringify(cache));
const per = Object.fromEntries(WANT.map((k) => [k, all.filter((q) => cache[q]?.[k]).length]));
console.log('items', all.length, 'named per language', JSON.stringify(per));
