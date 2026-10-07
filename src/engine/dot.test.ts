import { describe, expect, it, vi } from 'vitest';
import { drawDot } from './dot';

const ctx = () => ({ beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), fillStyle: '', strokeStyle: '', lineWidth: 0 }) as unknown as CanvasRenderingContext2D & { arc: ReturnType<typeof vi.fn>; fill: ReturnType<typeof vi.fn>; stroke: ReturnType<typeof vi.fn> };

describe('drawDot', () => {
  it('an exact date is a full dot', () => {
    const c = ctx();
    drawDot(c, 10, 20, 4, 'red', false);
    expect(c.fill).toHaveBeenCalledTimes(1);
    expect(c.stroke).not.toHaveBeenCalled();
    expect(c.fillStyle).toBe('red');
  });

  it('an approximate date is a ring of the same colour whose outer edge is where the dot would end', () => {
    const c = ctx();
    let seen = '';
    c.stroke.mockImplementation(() => { seen = String(c.strokeStyle) + '/' + c.lineWidth; });
    drawDot(c, 10, 20, 4, 'red', true);
    expect(seen).toBe('red/1.8');
    expect(c.stroke).toHaveBeenCalledTimes(1);
    expect(c.fill).not.toHaveBeenCalled();
    const r = c.arc.mock.calls[0]![2] as number;
    expect(r + 1.8 / 2).toBeCloseTo(4, 6);
  });

  it('gives the caller back its line width and stroke colour', () => {
    const c = ctx();
    c.lineWidth = 1; c.strokeStyle = 'grey';
    drawDot(c, 0, 0, 4, 'red', true);
    expect(c.lineWidth).toBe(1);
    expect(c.strokeStyle).toBe('grey');
  });
});
