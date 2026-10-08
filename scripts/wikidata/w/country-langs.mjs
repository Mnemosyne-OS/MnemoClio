// country-langs.mjs — every country's name in each language of the app (field, 07/10: "add the
// country names in Spanish too, and in every language of the app").
//
// A country is named in the app's language everywhere; events and people keep their own. The
// names come from Wikidata labels, 50 ids per call. A language Wikidata has no label for is
// simply absent: the app then falls back to English, never to a guessed translation.
// Chinese: Wikidata keeps most names under zh-hans / zh-cn rather than zh.
// Writes country-langs.json next to this script; split.mjs merges it as `nl` on each country.
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const UA = 'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)';
const LANGS = ['en', 'es', 'de', 'pt', 'ru', 'zh', 'zh-hans', 'zh-cn'];

const read = (f) => JSON.parse(fs.readFileSync(join(here, '..', f), 'utf8'));
const ids = new Set(read('data.json').countries.map((c) => c.id));
if (fs.existsSync(join(here, '..', 'polities.json'))) for (const p of read('polities.json')) ids.add(p.id);
const all = [...ids];

async function labels(chunk) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${chunk.join('|')}&props=labels&languages=${LANGS.join('|')}&format=json`;
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return (await r.json()).entities ?? {};
      if (r.status !== 429 && r.status < 500) throw new Error('HTTP ' + r.status);
    } catch (e) { if (t === 3) throw e; }
    await new Promise((res) => setTimeout(res, (t + 1) * 10000));
  }
  throw new Error('labels: no answer');
}

const out = {};
for (let i = 0; i < all.length; i += 50) {
  const ents = await labels(all.slice(i, i + 50));
  for (const [q, e] of Object.entries(ents)) {
    const l = e.labels ?? {};
    const pick = (...ks) => ks.map((k) => l[k]?.value).find(Boolean);
    const names = { en: pick('en'), es: pick('es'), de: pick('de'), pt: pick('pt'), ru: pick('ru'), zh: pick('zh-hans', 'zh-cn', 'zh') };
    out[q] = Object.fromEntries(Object.entries(names).filter(([, v]) => v));
  }
}
fs.writeFileSync(join(here, 'country-langs.json'), JSON.stringify(out));
const per = Object.fromEntries(['en', 'es', 'de', 'pt', 'ru', 'zh'].map((k) => [k, Object.values(out).filter((n) => n[k]).length]));
console.log('countries', all.length, 'named per language', JSON.stringify(per));
