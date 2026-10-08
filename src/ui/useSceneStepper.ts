/**
 * useSceneStepper.ts — the frame loop of a window that has no timeline (the map alone, the panel
 * alone). The timeline steps the scene in its own loop; without it a jump asked from the map
 * would set a target that nothing ever eases to. Sleeps when nothing moves (rule 13: cancelled
 * on unmount), wakes with the scene.
 */
import { useEffect } from 'react';
import type { Scene } from '../engine/scene';

export function useSceneStepper(scene: Scene, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (scene.step(dt)) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const off = scene.onWake(wake);
    wake();
    return () => { off(); if (raf) cancelAnimationFrame(raf); };
  }, [scene, active]);
}
