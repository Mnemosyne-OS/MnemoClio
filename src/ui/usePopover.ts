/**
 * usePopover.ts — a menu that opens under its button and closes on Escape or a press outside it
 * (the country picker's rule, written once for the header's menus).
 *
 * The menu is placed from the room the window actually has, measured at the press: anchored to
 * its button's right edge it ran past the window's LEFT edge as soon as the header wrapped and
 * the button landed on the left (field, 08/10: the Display menu opened empty, its text outside).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** Keeps a menu `width` px wide inside the window, as near its button's right edge as it can. */
export function menuLeft(wrapLeft: number, wrapRight: number, width: number, viewport: number, gutter = 8): number {
  const left = Math.min(Math.max(wrapRight - width, gutter), Math.max(gutter, viewport - width - gutter));
  return left - wrapLeft;
}

export function usePopover(width = 440) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (ev: PointerEvent) => { if (!ref.current?.contains(ev.target as Node)) setOpen(false); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('keydown', esc); };
  }, [open]);
  const toggle = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!open && r) {
      const w = Math.min(width, window.innerWidth - 16);
      setStyle({ left: menuLeft(r.left, r.right, w, window.innerWidth), right: 'auto', width: w });
    }
    setOpen((o) => !o);
  };
  return { open, setOpen, toggle, ref, style };
}
