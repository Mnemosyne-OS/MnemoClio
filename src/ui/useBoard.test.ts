import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate, type Key } from '../i18n/strings';

const invoke = vi.fn();
vi.mock('../sdk/mnemo-sdk', () => ({ MnemoCartridgeSDK: class { invoke = invoke; } }));
const { BOARD_LAYOUT, BOARD_ZOOM, boardWhy, useBoard } = await import('./useBoard');

const t = (k: Key, v?: Record<string, string | number>) => translate('en', k, v);

beforeEach(() => {
  invoke.mockReset();
  vi.stubGlobal('parent', { postMessage() {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('boardWhy', () => {
  it('names each refusal the host gives, and keeps an unknown one raw', () => {
    expect(boardWhy('BOARD_AMBIGUOUS').key).toBe('board.why.ambiguous');
    expect(boardWhy('BOARD_FULL').key).toBe('board.why.full');
    expect(boardWhy('BOARD_NOWHERE').key).toBe('board.why.nowhere');
    expect(boardWhy('BOARD_UNHEARD').key).toBe('board.why.unheard');
    expect(boardWhy('TOO_SOON').key).toBe('board.why.soon');
    expect(boardWhy('UNKNOWN_WIDGET: mnemo-clio-map')).toEqual({ key: 'board.why.other', why: 'UNKNOWN_WIDGET: mnemo-clio-map' });
  });
});

describe('useBoard', () => {
  it('outside the shell there is no board: the press asks nothing', () => {
    vi.unstubAllGlobals();
    const { result } = renderHook(() => useBoard(t));
    expect(result.current.available).toBe(false);
    act(() => result.current.open());
    expect(invoke).not.toHaveBeenCalled();
  });

  it('opens the three windows, each one the manifest declares', async () => {
    invoke.mockResolvedValue({ opened: true, desktop: 'MnemoClio' });
    const { result } = renderHook(() => useBoard(t));
    act(() => result.current.open());
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(invoke).toHaveBeenCalledWith('canvas.openBoard', { windows: BOARD_LAYOUT, fill: true, zoom: BOARD_ZOOM }, expect.any(Number));
    expect(BOARD_LAYOUT.map((w) => w.id)).toEqual(['mnemo-clio-timeline', 'mnemo-clio-map', 'mnemo-clio-panel']);
    expect(result.current.error).toBeNull();
  });

  it('says a refusal in words', async () => {
    invoke.mockRejectedValue(new Error('BOARD_AMBIGUOUS'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useBoard(t));
    act(() => result.current.leave());
    await waitFor(() => expect(result.current.error).toBe(t('board.why.ambiguous')));
    expect(invoke).toHaveBeenCalledWith('canvas.leaveBoard', undefined, expect.any(Number));
    warn.mockRestore();
  });
});

describe('the manifest', () => {
  it('declares every board window, and none of them opens on a plain launch', async () => {
    const { readFileSync } = await import('node:fs');
    const m = JSON.parse(readFileSync(`${process.cwd()}/mnemo-plugin.json`, 'utf8')) as { widgets: Array<{ id: string; openOnLaunch?: boolean }> };
    for (const w of BOARD_LAYOUT) expect(m.widgets.find((x) => x.id === w.id)?.openOnLaunch).toBe(false);
    expect(m.widgets[0]).toMatchObject({ id: 'mnemo-clio-main' });
    expect(m.widgets[0]!.openOnLaunch).toBeUndefined();
  });

  it('declares the same board the button opens, so the dock opens it as the button does', async () => {
    const { readFileSync } = await import('node:fs');
    const m = JSON.parse(readFileSync(`${process.cwd()}/mnemo-plugin.json`, 'utf8')) as { boards: Array<{ id: string; zoom: number; windows: unknown[] }> };
    const b = m.boards.find((x) => x.id === 'exploded')!;
    expect(b.zoom).toBe(BOARD_ZOOM);
    expect(b.windows).toEqual(BOARD_LAYOUT);
  });
});

describe('a full pager', () => {
  it('offers « Open here », which asks for the same windows on this desktop', async () => {
    invoke.mockRejectedValueOnce(new Error('BOARD_FULL')).mockResolvedValueOnce({ opened: true, here: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useBoard(t));
    act(() => result.current.open());
    await waitFor(() => expect(result.current.full).toBe(true));
    expect(result.current.error).toBe(t('board.why.full'));
    act(() => result.current.openHere());
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(invoke).toHaveBeenLastCalledWith('canvas.openBoard', { windows: BOARD_LAYOUT, fill: true, zoom: BOARD_ZOOM, here: true, replace: true }, expect.any(Number));
    expect(result.current.full).toBe(false);
    warn.mockRestore();
  });
});

describe('the layout', () => {
  it('covers the whole view without two windows on the same spot', () => {
    const area = BOARD_LAYOUT.reduce((a, w) => a + w.w * w.h, 0);
    expect(area).toBeCloseTo(1, 6);
    for (const w of BOARD_LAYOUT) { expect(w.x + w.w).toBeLessThanOrEqual(1); expect(w.y + w.h).toBeLessThanOrEqual(1); }
  });
});
