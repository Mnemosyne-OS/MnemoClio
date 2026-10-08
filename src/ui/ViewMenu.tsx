/**
 * ViewMenu.tsx — how the screen is laid out, in one menu: the zoom, the layout, the names'
 * language, and the fact on the board. They were five button groups across the header, read
 * every time before the timeline (field, 07/10: "the header becomes incomprehensible").
 */
import type { ReactNode } from 'react';
import type { Key } from '../i18n/strings';
import { usePopover } from './usePopover';

interface Props {
  t: (k: Key, v?: Record<string, string | number>) => string;
  /** The menu's sections, already built by the app (they act on its state). */
  children: ReactNode;
}

/** The Display button and its menu. */
export function ViewMenu({ t, children }: Props) {
  const pop = usePopover(360);
  return (
    <div className="clio-popwrap" ref={pop.ref}>
      <button type="button" className="clio-menu-btn" aria-expanded={pop.open} onClick={pop.toggle}>⚙ {t('view.button')}</button>
      {pop.open && <div className="clio-menu clio-menu-view" style={pop.style} role="dialog" aria-label={t('view.button')}>{children}</div>}
    </div>
  );
}
