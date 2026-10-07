/**
 * arrival.ts — how things come onto the timeline and leave it.
 *
 * Something that becomes visible (a pan, a zoom, a subject switched on, a file that just
 * landed) does not blink in: it grows from its own point, in a wave that runs left to right,
 * and something that leaves fades. Every arrival answers a gesture or a load; nothing here
 * runs on a clock of its own (the house rule: motion the human started is welcome, motion
 * that starts by itself is a nuisance). With `reduce` (prefers-reduced-motion) everything is
 * simply there.
 */

export interface Life { born: number; dying: number | null }

export interface ArrivalOptions {
  /** Delay between two neighbours of the same wave, ms. */
  stagger: number;
  /** A wave never takes longer than this to start its last member, ms. */
  maxDelay: number;
  /** Growing time of one item, ms. */
  grow: number;
  /** Fading time of a leaving item, ms. */
  fade: number;
  reduce: boolean;
}

export const DEFAULT_ARRIVAL: ArrivalOptions = { stagger: 2.2, maxDelay: 520, grow: 460, fade: 260, reduce: false };

export class Arrivals {
  private lives = new Map<string, Life>();
  constructor(private opts: ArrivalOptions = DEFAULT_ARRIVAL) {}

  setReduce(reduce: boolean): void { this.opts = { ...this.opts, reduce }; }

  /**
   * One frame. `visible` is what is on screen now, ordered left to right: the newcomers'
   * delays follow that order, which is what makes the arrival read as a wave.
   */
  update(visible: readonly string[], now: number): void {
    const seen = new Set<string>();
    let rank = 0;
    for (const id of visible) {
      seen.add(id);
      const life = this.lives.get(id);
      if (life && life.dying === null) continue;
      const delay = this.opts.reduce ? 0 : Math.min(this.opts.maxDelay, rank * this.opts.stagger);
      // An item coming back while it was fading resumes from where it is, never from zero.
      const born = this.opts.reduce ? now - this.opts.grow : life ? now - this.opts.grow * this.fadeLeft(life, now) : now + delay;
      this.lives.set(id, { born, dying: null });
      rank++;
    }
    for (const [id, life] of this.lives) {
      if (seen.has(id)) continue;
      if (this.opts.reduce) { this.lives.delete(id); continue; }
      if (life.dying === null) life.dying = now;
      else if (now - life.dying >= this.opts.fade) this.lives.delete(id);
    }
  }

  /** Items still fading out, to draw where they last were. */
  leaving(): string[] {
    const out: string[] = [];
    for (const [id, life] of this.lives) if (life.dying !== null) out.push(id);
    return out;
  }

  /** 0..1 opacity and the scale of the dot (overshoots a little, then settles at 1). */
  look(id: string, now: number): { alpha: number; scale: number } {
    const life = this.lives.get(id);
    if (!life) return { alpha: 0, scale: 0 };
    if (life.dying !== null) {
      const left = this.fadeLeft(life, now);
      return { alpha: left, scale: 0.6 + 0.4 * left };
    }
    const t = Math.max(0, Math.min(1, (now - life.born) / this.opts.grow));
    return { alpha: Math.min(1, t * 1.6), scale: easeOutBack(t) };
  }

  /** True while something is still growing or fading: the loop keeps drawing only then. */
  busy(now: number): boolean {
    for (const life of this.lives.values()) {
      if (life.dying !== null) return true;
      if (now - life.born < this.opts.grow) return true;
    }
    return false;
  }

  clear(): void { this.lives.clear(); }

  private fadeLeft(life: Life, now: number): number {
    if (life.dying === null) return 1;
    return Math.max(0, 1 - (now - life.dying) / this.opts.fade);
  }
}

/** Overshoot then settle: the dot "lands". 0 → 0, 1 → 1, peak ≈ 1.1. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.max(0, Math.min(1, t));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** A ripple on the timeline and the map when the play cursor passes an event. */
export interface Ripple { x: number; y: number; hue: number; born: number; map: boolean; lon?: number; lat?: number }
export const RIPPLE_MS = 900;
/** 0..1 progress of a ripple, or null once it is over (to drop it). */
export function rippleProgress(r: Ripple, now: number): number | null {
  const t = (now - r.born) / RIPPLE_MS;
  return t >= 1 ? null : Math.max(0, t);
}
