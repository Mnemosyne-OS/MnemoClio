// leaders-pack.mjs — names for the leaders and their offices, ends resolved, written to ../leaders.json.
// A person's name is in the language of the country they led (or the multilingual `mul` label);
// French only where Wikidata has it. An end that Wikidata does not give is the next holder's
// start; with no next holder the term is OPEN, and drawn as such.
import fs from 'fs';

const UA = 'MnemosyneOS-research/0.1 (yakacommuniquer@gmail.com)';
const { inception, list } = JSON.parse(fs.readFileSync('leaders-raw.json'));
const countries = JSON.parse(fs.readFileSync('countries.json')).results.bindings;
const LANG = Object.fromEntries(countries.map((b) => [b.c.value.split('/').pop(), b.lang ? b.lang.value : null]));
// a sultan is named in the language of the Ottoman Empire, not of Turkey
if (fs.existsSync('../polities.json')) for (const p of JSON.parse(fs.readFileSync('../polities.json'))) if (p.lang) LANG[p.id] = p.lang;

const L = fs.existsSync('leaders-labels.json') ? JSON.parse(fs.readFileSync('leaders-labels.json')) : {};
const want = new Map();
for (const t of list) {
  for (const q of [t.p, t.o]) {
    const s = want.get(q) ?? new Set(['fr', 'en', 'mul']);
    if (LANG[t.h ?? t.c]) s.add(LANG[t.h ?? t.c]);
    want.set(q, s);
  }
}
const groups = new Map();
for (const [q, langs] of want) {
  if (L[q]) continue;
  const key = [...langs].sort().join('|');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(q);
}
const jobs = [];
for (const [langs, qs] of groups) for (let i = 0; i < qs.length; i += 50) jobs.push([langs, qs.slice(i, i + 50)]);
console.log('label calls', jobs.length);
await Promise.all(Array.from({ length: 4 }, async () => {
  while (jobs.length) {
    const [langs, qs] = jobs.shift();
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&ids=${qs.join('|')}&languages=${langs}`;
    for (let t = 0; t < 4; t++) {
      try {
        const j = await (await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })).json();
        for (const q of qs) { L[q] = {}; for (const [l, v] of Object.entries(j.entities?.[q]?.labels ?? {})) L[q][l] = v.value; }
        break;
      } catch { await new Promise((r) => setTimeout(r, 2000)); }
    }
  }
}));
fs.writeFileSync('leaders-labels.json', JSON.stringify(L));

const named = (q, c) => {
  const l = L[q] ?? {};
  const lg = LANG[c];
  const own = (lg && l[lg]) || l.mul;
  const o = own || l.en || l.fr || q;
  return { o, ol: own ? (lg && l[lg] ? lg : 'en') : l.en ? 'en' : 'fr', f: l.fr || l.mul || null };
};

// ends: the given one, else the next start of the same office, else open
const byOffice = new Map();
for (const t of list) { if (!byOffice.has(t.o)) byOffice.set(t.o, []); byOffice.get(t.o).push(t); }
const out = [];
// 🪤 a holder with NO Wikipedia page in an office whose holders nearly all have one is an error in
// Wikidata (a "Phil Baker, President of the United States 2018-2021" was found that way); an office
// whose holders mostly have none (the captains regent of San Marino) keeps them all.
let dropped = 0;
for (const [office, all] of byOffice) {
  const med = [...all].map((t) => t.sl).sort((a, b) => a - b)[Math.floor(all.length / 2)] ?? 0;
  byOffice.set(office, all.filter((t) => { const ok = !(t.sl === 0 && med >= 10); if (!ok) dropped++; return ok; }));
}
console.log('terms dropped as unknown holders of a well-known office', dropped);
for (const terms of byOffice.values()) {
  terms.sort((a, b) => a.s - b.s);
  terms.forEach((t, i) => {
    const next = terms.slice(i + 1).find((n) => n.s > t.s);
    const e = t.e ?? next?.s ?? null;
    out.push({ c: t.c, h: t.h ?? null, k: t.k, q: t.p, ...named(t.p, t.h ?? t.c), off: named(t.o, t.h ?? t.c), office: t.o, s: t.s, e: e ?? 2025, open: e === null, sl: t.sl });
  });
}
out.sort((a, b) => a.s - b.s);
fs.writeFileSync('../leaders.json', JSON.stringify({ inception, leaders: out }));
const us = out.filter((t) => t.c === 'Q30');
console.log('leaders', out.length, 'open', out.filter((t) => t.open).length, 'no French name', out.filter((t) => !t.f).length);
console.log('US', us.slice(-5).map((t) => `${t.o} ${t.s}-${t.open ? '?' : t.e}`).join(' | '));
