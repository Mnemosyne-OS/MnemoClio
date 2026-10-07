// ne.mjs — today's borders: Natural Earth 1:50m countries (public domain), rounded to 0.02°.
// Each country keeps its Wikidata id, so the map and the timeline speak of the same country.
import fs from 'fs';

const URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const res = await fetch(URL, { signal: AbortSignal.timeout(120000) });
if (!res.ok) throw new Error('Natural Earth: HTTP ' + res.status);
const g = await res.json();
const r = (v) => Math.round(v * 50) / 50;
const out = [];
for (const ft of g.features) {
  const p = ft.properties;
  const polys = ft.geometry.type === 'Polygon' ? [ft.geometry.coordinates] : ft.geometry.coordinates;
  const rings = [];
  for (const poly of polys) for (const ring of poly) {
    const pts = [];
    let last = '';
    for (const [x, y] of ring) {
      const k = r(x) + ',' + r(y);
      if (k !== last) { pts.push(r(x), r(y)); last = k; }
    }
    if (pts.length >= 8) rings.push(pts);
  }
  out.push({ w: p.WIKIDATAID, n: p.NAME, f: p.NAME_FR || p.NAME, l: [r(p.LABEL_X), r(p.LABEL_Y)], r: rings });
}
fs.writeFileSync('ne50.json', JSON.stringify(out));
console.log('Natural Earth countries', out.length);
