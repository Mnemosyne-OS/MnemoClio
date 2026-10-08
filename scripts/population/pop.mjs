// pop.mjs — how many people lived on each country's land, from 10 000 BC to today.
//
// Field, 07/10: "add the world estimates, men women". Source: Our World in Data's long-run
// series, itself HYDE 3.3 (10 000 BC – 1799, CC BY 4.0), Gapminder v7 (1800–1949, CC BY 4.0)
// and the UN World Population Prospects 2024 (1950 on, CC BY 3.0 IGO); the share of women from
// the World Bank's World Development Indicators (1960 on, CC BY 4.0). All may be shipped with
// their attribution, which the cartridge shows under every figure.
//
// ⚠️ OWID counts every country on TODAY's borders: "France in 3000 BC" is the people who lived
// on today's France. The app says so. Only the 197 states of today are matched (their ISO code
// read on Wikidata, P298); former states (USSR, Yugoslavia) are left out.
//
// Writes public/data/population.json. Downloads ~2 MB; Wikidata codes cached in iso3.json.
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const UA = 'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)';
const POP = 'https://ourworldindata.org/grapher/population.csv?v=1&csvType=full&useColumnShortNames=true';
const FEM = 'https://ourworldindata.org/grapher/share-population-female.csv?v=1&csvType=full&useColumnShortNames=true';
const pub = join(here, '..', '..', 'public', 'data');

const history = JSON.parse(fs.readFileSync(join(pub, 'history.json'), 'utf8'));
const states = history.countries.filter((c) => c.kind === 'state').map((c) => c.id);

// ISO 3166-1 alpha-3 of each state, from Wikidata
const isoFile = join(here, 'iso3.json');
const iso = fs.existsSync(isoFile) ? JSON.parse(fs.readFileSync(isoFile, 'utf8')) : {};
const todo = states.filter((q) => !(q in iso));
if (todo.length) {
  // one SPARQL query (wbgetentities with claims is megabytes per country and was cut off);
  // wdt: is the best rank, so a deprecated code is never read
  const sparql = `SELECT ?c ?iso WHERE { VALUES ?c { ${todo.map((q) => 'wd:' + q).join(' ')} } ?c wdt:P298 ?iso }`;
  const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('Wikidata: HTTP ' + r.status);
  for (const q of todo) iso[q] = null;
  for (const b of (await r.json()).results.bindings) iso[b.c.value.split('/').pop()] ??= b.iso.value;
}
fs.writeFileSync(isoFile, JSON.stringify(iso, null, 1));
// OWID's own code for a state with no ISO code of its own
const byIso = new Map([...Object.entries(iso).filter(([, v]) => v).map(([q, v]) => [v, q]), ['OWID_KOS', 'Q1246']]);

async function csv(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('OWID: HTTP ' + r.status + ' ' + url);
  const lines = (await r.text()).trim().split('\n');
  // entity names may carry a comma inside quotes: the code, year and value are always the last three
  return lines.slice(1).map((l) => { const p = l.split(','); return { code: p[p.length - 3], year: Number(p[p.length - 2]), v: Number(p[p.length - 1]) }; });
}

const out = { world: [], c: {}, women: { world: [], c: {} } };
for (const r of await csv(POP)) {
  if (!Number.isFinite(r.v) || !Number.isFinite(r.year)) continue;
  if (r.code === 'OWID_WRL') { out.world.push(r.year, r.v); continue; }
  const q = byIso.get(r.code);
  if (q) (out.c[q] ??= []).push(r.year, r.v);
}
for (const r of await csv(FEM)) {
  if (!Number.isFinite(r.v) || !Number.isFinite(r.year)) continue;
  const v = Math.round(r.v * 10) / 10;
  if (r.code === 'OWID_WRL') { out.women.world.push(r.year, v); continue; }
  const q = byIso.get(r.code);
  if (q) (out.women.c[q] ??= []).push(r.year, v);
}
// OWID's series runs to 2100 (UN projections): the timeline stops at 2025 and shows no forecast
const cut = (a) => { const o = []; for (let i = 0; i < a.length; i += 2) if (a[i] <= 2025) o.push(a[i], a[i + 1]); return o; };
out.world = cut(out.world);
for (const k of Object.keys(out.c)) out.c[k] = cut(out.c[k]);
out.read = new Date().toISOString().slice(0, 10);
fs.writeFileSync(join(pub, 'population.json'), JSON.stringify(out));
const missing = states.filter((q) => !out.c[q]);
console.log('population.json', (fs.statSync(join(pub, 'population.json')).size / 1e3).toFixed(0), 'kB;', Object.keys(out.c).length, 'states of', states.length, '; women for', Object.keys(out.women.c).length, '; no series:', missing.length, missing.slice(0, 12).join(' '));
