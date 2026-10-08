#!/usr/bin/env node
// build-data.mjs — the whole Wikidata chain, in the ONE order that is correct.
//
// The order is not cosmetic: events.mjs rebuilds every event's country from the raw reads, so
// p27.mjs (which re-resolves citizenships) must run AFTER it, and relabel/mul must run after
// p27 because the original-language name depends on the country it settled on. fetchall.mjs
// never writes the sport file any more (sport.mjs alone does; the generic query returned 0 rows
// and erased it once).
//
// Run: node scripts/wikidata/build-data.mjs        (~40 min, ~2 000 Wikidata calls, no key)
//      node scripts/wikidata/build-data.mjs --split (only the last step: cache -> public/data)
// Intermediate files stay next to the scripts and are gitignored; public/data is what ships.
import { execFileSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const run = (dir, file, args = []) => {
  const t = Date.now();
  console.log(`\n▶ ${dir}/${file} ${args.join(' ')}`);
  execFileSync(process.execPath, [file, ...args], { cwd: join(here, dir), stdio: 'inherit' });
  console.log(`  ${((Date.now() - t) / 1000).toFixed(0)} s`);
};

if (!process.argv.includes('--split')) {
  // 1. regimes, wars, battles, countries, and their names
  run('w', 'fetch.mjs');
  run('w', 'polities.mjs');
  run('.', 'ne.mjs');
  run('w', 'labels.mjs');
  run('w', 'zh.mjs');
  run('w', 'labels2.mjs');
  run('w', 'mulw.mjs');
  run('w', 'leaders.mjs');
  run('w', 'leaders-pack.mjs');
  run('w', 'build.mjs');
  run('w', 'country-langs.mjs');
  // 2. every other subject
  run('ev', 'astro.mjs');
  run('ev', 'fetchall.mjs');
  run('ev', 'work2step.mjs');
  run('ev', 'fetchmore.mjs');
  run('ev', 'sport.mjs');
  run('ev', 'person.mjs');
  run('ev', 'disc.mjs');
  run('ev', 'events.mjs');
  run('ev', 'fill.mjs');
  run('ev', 'p27.mjs');
  run('ev', 'relabel.mjs');
  run('ev', 'refr.mjs');
  run('ev', 'mul.mjs');
  run('ev', 'pack.mjs');
  run('w', 'names-langs.mjs');
}
// 3. what the cartridge loads
run('.', 'split.mjs');

// 4. how many people lived there (Our World in Data, not Wikidata): reads the history split wrote
run('../population', 'pop.mjs');

// 5. outbreaks where Wikidata places them: dated foci, never an invented spread
run('../epidemics', 'epi.mjs');

// 6. where religions built and when their currents were founded (doc 137 section 5quaterdecies)
run('../religions', 'rel.mjs');
