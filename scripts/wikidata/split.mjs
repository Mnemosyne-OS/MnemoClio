// split.mjs — the cache becomes what the cartridge loads, ONE FILE PER SUBJECT.
//
// One file per subject is the point: the timeline draws a subject the moment its bytes land,
// so what arrives on screen is the real load, not an animation pretending to be one.
// meta.json is read first; it names every file with its size, so the loader can say how much
// is coming before it comes.
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'public', 'data');
fs.mkdirSync(out, { recursive: true });
const read = (f) => JSON.parse(fs.readFileSync(join(here, f), 'utf8'));
const write = (name, value) => {
  const s = JSON.stringify(value);
  fs.writeFileSync(join(out, name), s);
  return s.length;
};

const history = read('data.json');
// ended states and territories become countries too, AFTER today's 197 (pack.mjs relies on that order)
if (fs.existsSync(join(here, 'polities.json'))) {
  for (const c of history.countries) c.kind = 'state';
  for (const p of read('polities.json')) {
    history.countries.push({ id: p.id, kind: p.kind, lang: p.lang, o: p.o, ol: p.ol, f: p.f, n: 0, s: p.s, e: p.e, en: p.en, heir: p.heir });
  }
}
// who led each country, and since when each country exists (leaders-pack.mjs); the offices go in a
// table so "President of the United States" is written once, not 49 times
if (fs.existsSync(join(here, 'leaders.json'))) {
  const { inception, leaders } = read('leaders.json');
  // today's states take their inception from here; an ended state or a territory keeps its own span
  for (const c of history.countries) if (c.kind !== 'ended' && c.kind !== 'territory') c.s = inception[c.id] ?? null;
  const offices = [];
  const at = new Map();
  history.leaders = leaders.map((t) => {
    if (!at.has(t.office)) { at.set(t.office, offices.length); offices.push({ id: t.office, k: t.k, ...t.off }); }
    return { c: t.c, h: t.h ?? null, of: at.get(t.office), s: t.s, e: t.e, open: t.open, o: t.o, ol: t.ol, f: t.f, q: t.q, sl: t.sl };
  });
  history.offices = offices;
}
const events = read('events.json');
// a polity's count is what Wikidata ties to it directly (the 12th column of an event row)
for (const r of events.e) if (r[11] >= 0 && history.countries[r[11]]) history.countries[r[11]].n++;
const world = read('ne50.json');
// The date shown is the date of the DATA (when Wikidata was read), never the date of a build.
const readAt = fs.statSync(join(here, 'events.json')).mtime.toISOString().slice(0, 10);

const files = [];
files.push({ file: 'history.json', what: 'history', bytes: write('history.json', history) });
const byKind = new Map(events.kinds.map((k) => [k, []]));
for (const r of events.e) byKind.get(events.kinds[r[0]]).push(r.slice(1));
for (const [kind, rows] of byKind) {
  rows.sort((a, b) => a[0] - b[0]);
  const bytes = write(`events-${kind}.json`, { kind, langs: events.langs, subs: events.subs, rows });
  files.push({ file: `events-${kind}.json`, what: kind, count: rows.length, bytes, cap: events.cap[kind] ?? null });
}
files.push({ file: 'world-today.json', what: 'world', bytes: write('world-today.json', world) });

write('meta.json', {
  readAt,
  source: 'Wikidata (CC0) · Natural Earth (public domain)',
  countries: history.countries.length,
  wars: history.wars.length,
  regimes: history.states.length,
  files,
});
const total = files.reduce((s, f) => s + f.bytes, 0);
console.log(`public/data: ${files.length} files, ${(total / 1e6).toFixed(2)} MB, read ${readAt}`);
for (const f of files) console.log(`  ${f.file.padEnd(28)} ${(f.bytes / 1e3).toFixed(0).padStart(6)} kB${f.count != null ? '  ' + f.count : ''}`);
