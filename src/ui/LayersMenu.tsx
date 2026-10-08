/**
 * LayersMenu.tsx — what the timeline, the map and the panel show, in one place (field, 07/10:
 * "if I want to see only the wars, or only the epidemics, or the religion, or the three together").
 *
 * Five layers, each on or off on its own, combinable; « only » isolates one. A layer acts on the
 * three views at once (a war is its lane line, its battles and clouds on the map, its pill in the
 * panel). The twenty subjects are the inside of the Events layer, folded under it: they were two
 * rows of the header, read before anything else.
 */
import type { CSSProperties } from 'react';
import { KINDS, type Kind } from '../data/types';
import { ICON, LAYER_ORDER, isOn, only, toggled, type LayerId, type LayerState } from '../data/layers';
import { KIND_HUE } from '../engine/palette';
import type { Key } from '../i18n/strings';
import { usePopover } from './usePopover';

interface Props {
  t: (k: Key, v?: Record<string, string | number>) => string;
  lang: string;
  state: LayerState;
  onChange: (s: LayerState) => void;
  /** The subjects Events had before it was switched off, to give them back. */
  lastKinds: ReadonlySet<Kind>;
  /** How many of each subject are loaded for the countries on screen; null while it is read. */
  kindCount: (k: Kind) => number | null;
  kindTitle: (k: Kind) => string;
  /** Layer read from a file that failed or is loading: said next to its name. */
  layerNote: Partial<Record<LayerId, string>>;
}

/** The Layers button and its menu. */
export function LayersMenu({ t, lang, state, onChange, lastKinds, kindCount, kindTitle, layerNote }: Props) {
  const pop = usePopover(440);
  const on = LAYER_ORDER.filter((id) => isOn(state, id));
  return (
    <div className="clio-popwrap" ref={pop.ref}>
      <button type="button" className="clio-menu-btn" aria-expanded={pop.open} onClick={pop.toggle} title={t('layers.hint')}>
        {t('layers.button')} <span className="clio-menu-icons" aria-hidden="true">{on.length ? on.map((id) => ICON[id]).join(' ') : '—'}</span>
      </button>
      {pop.open && (
        <div className="clio-menu" style={pop.style} role="dialog" aria-label={t('layers.button')}>
          {LAYER_ORDER.map((id) => {
            const active = isOn(state, id);
            return (
              <div key={id} className={active ? 'clio-layer on' : 'clio-layer'}>
                <button type="button" className="clio-layer-main" aria-pressed={active} onClick={() => onChange(toggled(state, id, lastKinds))}>
                  <span className="clio-layer-icon" aria-hidden="true">{ICON[id]}</span>
                  <span className="clio-layer-text"><b>{t(`layers.${id}` as Key)}</b><small>{layerNote[id] ?? t(`layers.${id}.hint` as Key)}</small></span>
                </button>
                <button type="button" className="clio-layer-only" onClick={() => onChange(only(state, id, lastKinds))} title={t('layers.onlyHint')}>{t('layers.only')}</button>
                {id === 'wars' && active && (
                  <label className="clio-layer-sub">
                    <input type="checkbox" checked={state.clouds} onChange={() => onChange({ ...state, clouds: !state.clouds })} /> ☁ {t('clouds.label').replace(/^☁\s*/, '')}
                  </label>
                )}
                {id === 'events' && (
                  <div className="clio-layer-kinds">
                    {KINDS.map((k) => {
                      const n = kindCount(k);
                      return (
                        <button key={k} type="button" className={state.kinds.has(k) ? 'clio-chip on' : 'clio-chip'} style={{ '--c': `hsl(${KIND_HUE[k]} 68% var(--clio-l))` } as CSSProperties}
                          aria-pressed={state.kinds.has(k)} title={kindTitle(k)}
                          onClick={() => { const s = new Set(state.kinds); if (s.has(k)) s.delete(k); else s.add(k); onChange({ ...state, kinds: s }); }}>
                          <i /> {t(`kind.${k}` as Key)} <small>{n === null ? '…' : n.toLocaleString(lang)}</small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div className="clio-pills">
            <button type="button" className="clio-pill" onClick={() => onChange({ ...state, wars: true, leaders: true, epi: true, rel: true, kinds: new Set(KINDS) })}>{t('subjects.all')}</button>
            <button type="button" className="clio-pill" onClick={() => onChange({ ...state, wars: false, leaders: false, epi: false, rel: false, kinds: new Set() })}>{t('subjects.none')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
