/**
 * Panel.tsx — what the cursor's year holds, the card of what was picked, and the feed.
 *
 * Three views of the same moment: "In 1870, around the world" (a block per shown country, the
 * world, the great periods), the card of one thing with "Meanwhile, elsewhere" (the crossing
 * of the data: the same year, every other country, every subject), and the feed of what the
 * play cursor just passed, newest on top.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Ev, History, Kind, Named, War } from '../data/types';
import { uniqueByQ } from '../data/decode';
import { KIND_HUE } from '../engine/palette';
import type { Picked, Spark } from '../engine/scene';
import type { Key } from '../i18n/strings';
import { fey, fspan, fy, periodOf } from '../engine/years';

type T = (key: Key, vars?: Record<string, string | number>) => string;

export interface PanelProps {
  history: History;
  byQ: Map<string, Ev>;
  /** Loaded events of every country, sorted by year (for "meanwhile"). */
  all: Ev[];
  shown: string[];
  kinds: ReadonlySet<Kind>;
  showWars: boolean;
  showLeaders: boolean;
  year: number;
  picked: Picked | null;
  sparks: Spark[];
  playing: boolean;
  tr: boolean;
  name: (x: Named) => string;
  t: T;
  onPick: (p: Picked | null) => void;
}

const kindDot = (k: Kind): CSSProperties => ({ background: `hsl(${KIND_HUE[k]} 68% var(--clio-l))` });

export function Panel(p: PanelProps) {
  return (
    <div className="clio-panel">
      {p.picked ? <Card {...p} picked={p.picked} /> : <Now {...p} />}
      {(p.playing || p.sparks.length > 0) && <Feed {...p} />}
    </div>
  );
}

function Nm({ x, p }: { x: Named; p: PanelProps }) {
  const missing = p.tr && !x.f;
  return <span lang={p.tr && x.f ? 'fr' : x.ol} className={missing ? 'clio-untr' : undefined}>{p.name(x)}</span>;
}

function EvPill({ e, p, withYear = true, withCountry = false }: { e: Ev; p: PanelProps; withYear?: boolean; withCountry?: boolean }) {
  const c = withCountry && e.c ? p.history.countries.find((k) => k.id === e.c) : null;
  return (
    <button type="button" className="clio-pill" style={{ borderColor: `hsl(${KIND_HUE[e.k]} 68% var(--clio-l))` }} onClick={() => p.onPick({ type: 'event', q: e.q })}
      title={`${p.t(`kind.${e.k}` as Key)} · ${fey(e)}${e.sub ? ' · ' + e.sub : ''}`}>
      <i className="clio-kd" style={kindDot(e.k)} />
      <Nm x={e} p={p} />
      {withYear && <small> {fey(e)}</small>}
      {c && <small> · <Nm x={c} p={p} /></small>}
    </button>
  );
}

function Now(p: PanelProps) {
  const { year, t } = p;
  // the moment: a decade in modern times, half a century in the Middle Ages, a century in Antiquity
  const { start: decade, size } = periodOf(year);
  const inDecade = (e: Ev) => p.kinds.has(e.k) && e.y >= decade && e.y < decade + size;
  const momentLabel = size === 10 && decade >= 0 ? t('now.decade', { decade }) : t('now.span', { a: fy(decade), b: fy(decade + size - 1) });
  const warIdx = new Map(p.history.wars.map((w) => [w.id, w]));
  const periods = p.showWars ? p.history.periods.filter((pe) => pe.s <= year && year <= pe.e && pe.kids.some((k) => warIdx.get(k)?.b.some((b) => p.shown.includes(b.c)))) : [];
  const block = (key: string, title: ReactNode, hue: string, list: Ev[], extra: ReactNode, empty: boolean) => {
    // the year itself first, then the most known of the decade
    const l = uniqueByQ(list.filter(inDecade).sort((a, b) => Number(b.y === year) - Number(a.y === year) || b.sl - a.sl));
    return (
      <section key={key} className="clio-block" style={{ '--c': hue } as CSSProperties}>
        <h3>{title}</h3>
        {extra}
        {l.length > 0 && <p className="clio-note">{momentLabel}</p>}
        {l.length > 0 && (
          <div className="clio-pills">
            {l.slice(0, 8).map((e) => <EvPill key={e.q} e={e} p={p} />)}
            {l.length > 8 && <button type="button" className="clio-pill" onClick={() => p.onPick({ type: 'decade', key, decade, size })}>{t('now.more', { n: l.length - 8 })}</button>}
          </div>
        )}
        {empty && l.length === 0 && <p className="clio-empty">{t('now.nothingSpan', { span: momentLabel })}</p>}
      </section>
    );
  };
  const byC = new Map<string, Ev[]>();
  for (const e of p.all) {
    const k = e.c ?? 'world'; let l = byC.get(k); if (!l) byC.set(k, (l = [])); l.push(e);
    if (e.h) { let m = byC.get(e.h); if (!m) byC.set(e.h, (m = [])); m.push(e); }
  }
  return (
    <div className="clio-now">
      <h2>{t('now.title', { year: fy(year) })}</h2>
      {periods.length > 0 && (
        <section className="clio-block" style={{ '--c': 'var(--accent)' } as CSSProperties}>
          <h3>{t('now.periods')}</h3>
          <div className="clio-pills">{periods.map((pe) => <button key={pe.id} type="button" className="clio-pill clio-dashed" onClick={() => p.onPick({ type: 'period', id: pe.id })}><Nm x={pe} p={p} /></button>)}</div>
        </section>
      )}
      {p.shown.map((id) => {
        const c = p.history.countries.find((k) => k.id === id);
        if (!c) return null;
        const regimes = p.history.regimes.filter((r) => r.c === id && r.s <= year && year < r.e);
        const inPower = p.showLeaders ? p.history.leaders.filter((l) => (l.c === id || l.h === id) && l.s <= year && year < l.e) : [];
        const outside = c.kind === 'ended' && c.s !== null && c.e !== null && (year < c.s || year > c.e);
        const wars = p.showWars ? p.history.wars.filter((w) => w.s <= year && year <= w.e && w.b.some((b) => b.c === id)) : [];
        const extra = (
          <>
            {outside && <p className="clio-note">{t('polity.outside', { s: c.s === null ? '?' : fy(c.s), e: c.e === null ? '?' : fy(c.e) })}</p>}
            {regimes.length > 0 && <div className="clio-regime">{regimes.slice(0, 4).map((r, i) => <span key={r.id + i}>{i > 0 && ' · '}<button type="button" className="clio-link" onClick={() => p.onPick({ type: 'regime', id: r.id, c: r.c })}><Nm x={r} p={p} /></button></span>)}</div>}
            {inPower.length > 0 && (
              <div className="clio-power"><span className="clio-note">{t('now.inPower')} :</span>{inPower.slice(0, 3).map((l) => (
                <button key={l.q + l.of + l.s} type="button" className="clio-link" onClick={() => p.onPick({ type: 'leader', q: l.q, of: l.of, s: l.s })} title={p.name(p.history.offices[l.of]!)}>
                  <Nm x={l} p={p} />
                </button>
              ))}</div>
            )}
            {wars.length > 0 && <div className="clio-pills">{wars.map((w) => <WarPill key={w.id} w={w} p={p} here={id} />)}</div>}
          </>
        );
        return block(id, <Nm x={c} p={p} />, `hsl(${c.h} 68% var(--clio-l))`, byC.get(id) ?? [], extra, regimes.length === 0 && wars.length === 0 && inPower.length === 0);
      })}
      {(byC.get('world') ?? []).some(inDecade) && block('world', <>{t('world.name')} <small className="clio-note">({t('world.hint')})</small></>, 'var(--text-muted)', byC.get('world') ?? [], null, false)}
    </div>
  );
}

function WarPill({ w, p, here }: { w: War; p: PanelProps; here?: string }) {
  const n = here ? w.b.filter((b) => b.y === p.year && b.c === here).length : 0;
  return (
    <button type="button" className="clio-pill clio-solid" onClick={() => p.onPick({ type: 'war', id: w.id })}>
      <Nm x={w} p={p} />{n > 0 && <small> · {n}</small>}
    </button>
  );
}

function Card(p: PanelProps & { picked: Picked }) {
  const { t, picked } = p;
  const close = <button type="button" className="clio-close" onClick={() => p.onPick(null)} aria-label={t('card.close')}>×</button>;
  if (picked.type === 'event') {
    const e = p.byQ.get(picked.q);
    if (!e) return null;
    const country = e.c ? p.history.countries.find((k) => k.id === e.c) : null;
    // the crossing: the same year, every OTHER country, every chosen subject, most known first
    const same = uniqueByQ(p.all.filter((x) => x.y === e.y && x.q !== e.q && x.c !== e.c && p.kinds.has(x.k)).sort((a, b) => b.sl - a.sl)).slice(0, 12);
    const wars = p.history.wars.filter((w) => w.s <= e.y && e.y <= w.e).sort((a, b) => b.b.length - a.b.length).slice(0, 4);
    return (
      <div className="clio-card">
        {close}
        <p className="clio-tag"><i className="clio-kd" style={kindDot(e.k)} />{e.k === 'person' ? t('card.birth') : t(`kind.${e.k}` as Key)} · {fey(e)}{e.sub ? ` · ${e.sub}` : ''}</p>
        <h2><Nm x={e} p={p} /></h2>
        {!p.tr && e.f && e.f !== e.o && <p className="clio-note">{t('card.inFrench', { name: e.f })}</p>}
        <p className="clio-note">
          {country ? <Nm x={country} p={p} /> : t('card.noCountry')} · {t('card.known', { n: e.sl })} ·{' '}
          <a href={`https://www.wikidata.org/wiki/${e.q}`} target="_blank" rel="noopener noreferrer">{t('card.wikidata')}</a>
        </p>
        <h3>{t('card.meanwhile', { year: fey(e) })}</h3>
        {same.length ? <div className="clio-pills">{same.map((x) => <EvPill key={x.q} e={x} p={p} withYear={false} withCountry />)}</div> : <p className="clio-empty">{t('card.meanwhileNone')}</p>}
        {wars.length > 0 && <div className="clio-pills">{wars.map((w) => <WarPill key={w.id} w={w} p={p} />)}</div>}
      </div>
    );
  }
  if (picked.type === 'leader') {
    const l = p.history.leaders.find((x) => x.q === picked.q && x.of === picked.of && x.s === picked.s);
    if (!l) return null;
    const office = p.history.offices[l.of]!;
    const country = p.history.countries.find((k) => k.id === l.c);
    // the holders just before and after, in the same office
    const same = p.history.leaders.filter((x) => x.of === l.of).sort((a, b) => a.s - b.s);
    const i = same.indexOf(l);
    const around = same.slice(Math.max(0, i - 3), i + 4);
    return (
      <div className="clio-card">
        {close}
        <p className="clio-tag">{t('leader.title', { office: p.name(office) })}</p>
        <h2><Nm x={l} p={p} /></h2>
        <p className="clio-note">
          {t('leader.term', { s: fy(l.s), e: l.open ? '?' : fy(l.e) })} · {country ? <Nm x={country} p={p} /> : null} · {t('card.known', { n: l.sl })} ·{' '}
          <a href={`https://www.wikidata.org/wiki/${l.q}`} target="_blank" rel="noopener noreferrer">{t('card.wikidata')}</a>
        </p>
        <h3>{t('leader.chain')}</h3>
        <div className="clio-chain">
          {around.map((x, k) => (
            <span key={x.q + x.s} className={x === l ? 'clio-node clio-here' : 'clio-node'}>
              {k > 0 && <span className="clio-arrow">→</span>}
              <button type="button" className="clio-link" onClick={() => p.onPick({ type: 'leader', q: x.q, of: x.of, s: x.s })}><b><Nm x={x} p={p} /></b></button>
              <small> {fspan(x.s, x.e, x.open)}</small>
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (picked.type === 'war') {
    const w = p.history.wars.find((x) => x.id === picked.id);
    if (!w) return null;
    const groups = new Map<string, typeof w.b>();
    for (const b of w.b) { const k = b.g ?? ''; let l = groups.get(k); if (!l) groups.set(k, (l = [])); l.push(b); }
    const ordered = [...groups].sort((a, b) => b[1].length - a[1].length);
    return (
      <div className="clio-card">
        {close}
        <p className="clio-tag">{t('war.title')}</p>
        <h2><Nm x={w} p={p} /></h2>
        <p className="clio-note">{t('war.counts', { s: fy(w.s), e: fy(w.e), n: w.b.length, g: groups.size - (groups.has('') ? 1 : 0) })}</p>
        <div className="clio-tree">
          {ordered.map(([g, bs]) => (
            <details key={g || 'direct'} open={ordered.length <= 3}>
              <summary><b>{g ? <Nm x={w.groups[g] ?? { o: g, ol: 'en', f: null }} p={p} /> : t('war.direct')}</b><span>{bs.length}</span></summary>
              <ul>{bs.slice(0, 80).map((b, i) => <li key={i}><Nm x={b} p={p} /><span>{fy(b.y)}</span></li>)}</ul>
            </details>
          ))}
        </div>
      </div>
    );
  }
  if (picked.type === 'regime') {
    const r = p.history.regimes.find((x) => x.id === picked.id && x.c === picked.c);
    if (!r) return null;
    const chain: Named[] = [r];
    let cur = r;
    for (let i = 0; i < 6; i++) { const prev = p.history.regimes.find((x) => x.next === cur.id && x.c === r.c); if (!prev || chain.includes(prev)) break; chain.unshift(prev); cur = prev; }
    cur = r;
    for (let i = 0; i < 6; i++) {
      const next = p.history.regimes.find((x) => x.id === cur.next && x.c === r.c) ?? p.history.regimes.find((x) => x.id === cur.next);
      if (!next) { if (cur.nl) chain.push(cur.nl); break; }
      if (chain.includes(next)) break;
      chain.push(next); cur = next;
    }
    return (
      <div className="clio-card">
        {close}
        <p className="clio-tag">{t('regime.title')}</p>
        <div className="clio-chain">
          {chain.map((x, i) => (
            <span key={i} className={x === r ? 'clio-node clio-here' : 'clio-node'}>
              {i > 0 && <span className="clio-arrow">→</span>}
              <b><Nm x={x} p={p} /></b>
              {'s' in x && <small> {fspan((x as typeof r).s, (x as typeof r).e, (x as typeof r).open)}</small>}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (picked.type === 'period') {
    const pe = p.history.periods.find((x) => x.id === picked.id);
    if (!pe) return null;
    const wars = pe.kids.map((k) => p.history.wars.find((w) => w.id === k)).filter((w): w is War => !!w).sort((a, b) => a.s - b.s);
    return (
      <div className="clio-card">
        {close}
        <p className="clio-tag">{t('period.title')}</p>
        <h2><Nm x={pe} p={p} /></h2>
        <p className="clio-note">{t('period.counts', { s: fy(pe.s), e: fy(pe.e), n: wars.length })}</p>
        <div className="clio-pills">{wars.map((w) => <button key={w.id} type="button" className="clio-pill clio-solid" onClick={() => p.onPick({ type: 'war', id: w.id })}><Nm x={w} p={p} /> <small>{w.s}–{w.e} · {w.b.length}</small></button>)}</div>
      </div>
    );
  }
  // a decade of one lane
  const bucket = picked.size ?? 10;
  const list = p.all.filter((e) => ((e.c ?? 'world') === picked.key || e.h === picked.key) && p.kinds.has(e.k) && e.y >= picked.decade && e.y < picked.decade + bucket).sort((a, b) => a.y - b.y || b.sl - a.sl);
  const country = p.history.countries.find((k) => k.id === picked.key);
  const byKind = new Map<Kind, Ev[]>();
  for (const e of list) { let l = byKind.get(e.k); if (!l) byKind.set(e.k, (l = [])); l.push(e); }
  return (
    <div className="clio-card">
      {close}
      <p className="clio-tag">{t('decade.title', { name: country ? p.name(country) : t('world.name'), decade: fspan(picked.decade, picked.decade + bucket - 1), n: list.length })}</p>
      {[...byKind].map(([k, l]) => (
        <section key={k} className="clio-block" style={{ '--c': `hsl(${KIND_HUE[k]} 68% var(--clio-l))` } as CSSProperties}>
          <h3>{t(`kind.${k}` as Key)} <small>{l.length}</small></h3>
          <div className="clio-pills">{l.map((e) => <EvPill key={e.q} e={e} p={p} />)}</div>
        </section>
      ))}
    </div>
  );
}

function Feed(p: PanelProps) {
  return (
    <div className="clio-feed">
      <h3>{p.t('feed.title')}</h3>
      {p.sparks.length === 0 && <p className="clio-empty">{p.t('feed.empty')}</p>}
      <ul>
        {p.sparks.map((s) => {
          const e = p.byQ.get(s.q);
          if (!e) return null;
          const c = e.c ? p.history.countries.find((k) => k.id === e.c) : null;
          return (
            <li key={s.q + s.at} className="clio-spark" onClick={() => p.onPick({ type: 'event', q: e.q })}>
              <i className="clio-kd" style={kindDot(e.k)} />
              <b>{fey(e)}</b> <Nm x={e} p={p} />{c && <small> · <Nm x={c} p={p} /></small>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
