import { describe, expect, it } from 'vitest';
import { menuLeft } from './usePopover';

describe('menuLeft', () => {
  it('keeps the menu under its button when there is room on the left', () => {
    // button at 900..1000 in a 1200 window, menu 360 wide: its right edge on the button's
    expect(menuLeft(900, 1000, 360, 1200)).toBe(1000 - 360 - 900);
  });
  it('never runs past the window left edge (a button that wrapped to the left)', () => {
    expect(menuLeft(30, 230, 360, 860) + 30).toBe(8);
  });
  it('never runs past the right edge either', () => {
    expect(menuLeft(30, 230, 900, 860) + 30).toBe(8);
  });
});
