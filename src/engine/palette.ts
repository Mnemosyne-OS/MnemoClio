/**
 * palette.ts — the subject colours.
 *
 * A subject keeps one hue everywhere (filter chip, timeline dot, map dot, card), so a colour
 * read on the map means the same thing on the timeline. Lightness follows the host theme
 * through `--clio-l`, set from the shell's background (see App): the hue is the meaning,
 * the lightness is the theme's business. Surfaces, text and borders come from the host's
 * own variables; only these hues are named here.
 */
import type { Kind } from '../data/types';

export const KIND_HUE: Record<Kind, number> = {
  person: 212, discovery: 160, work: 318, knowledge: 44, building: 22, treaty: 272,
  disaster: 356, exploration: 188, society: 96, movement: 246, sport: 130,
  subdivision: 60, election: 200, law: 290, city: 30, company: 176, violence: 8,
};

/** For canvas, where CSS variables do not reach: lightness passed in explicitly. */
export const hsl = (h: number, l: number, s = 68, a = 1): string => `hsla(${h}, ${s}%, ${l}%, ${a})`;
export const kindColor = (k: Kind, l: number, a = 1): string => hsl(KIND_HUE[k], l, 68, a);
