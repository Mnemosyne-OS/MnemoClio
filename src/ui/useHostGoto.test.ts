import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('../sdk/mnemo-sdk', () => ({ MnemoCartridgeSDK: class { invoke = invoke; } }));
const { parseGoto, useHostGoto } = await import('./useHostGoto');

beforeEach(() => { invoke.mockReset(); vi.stubGlobal('parent', { postMessage() {} }); });
afterEach(() => { vi.unstubAllGlobals(); });

const opened = (id: string, agoMs: number) => invoke.mockResolvedValue({ opened: { id, at: new Date(Date.now() - agoMs).toISOString() } });
const send = (id: string) => act(() => { window.dispatchEvent(new MessageEvent('message', { source: window.parent as Window, data: { type: 'MNEMO_PLUGIN_EVENT', event: 'cockpit:card-opened', data: { id } } })); });

describe('the chat asks for a moment', () => {
  it('reads goto:<country>:<year>, nothing else', () => {
    expect(parseGoto('goto:Q142:1780')).toEqual({ country: 'Q142', year: 1780 });
    expect(parseGoto('goto:Q17:-500')).toEqual({ country: 'Q17', year: -500 });
    expect(parseGoto('fact')).toBeNull();
    expect(parseGoto('goto:Q1:0')).toBeNull();
    expect(parseGoto(42)).toBeNull();
  });

  it('a press that launched this window, recent: the moment comes', async () => {
    opened('goto:Q142:1780', 2000);
    const got: Array<[string, number]> = [];
    renderHook(() => useHostGoto(true, (c, y) => got.push([c, y])));
    await waitFor(() => expect(got).toEqual([['Q142', 1780]]));
  });

  it('an old press is not replayed at a later start', async () => {
    opened('goto:Q142:1780', 120000);
    const got: unknown[] = [];
    renderHook(() => useHostGoto(true, (c, y) => got.push([c, y])));
    await new Promise((r) => setTimeout(r, 20));
    expect(got).toEqual([]);
  });

  it('a press while the window is open is heard; the fact card\'s id is not a moment', async () => {
    invoke.mockResolvedValue({ opened: null });
    const got: Array<[string, number]> = [];
    renderHook(() => useHostGoto(true, (c, y) => got.push([c, y])));
    send('fact');
    send('goto:Q17:1868');
    expect(got).toEqual([['Q17', 1868]]);
  });

  it('a press heard before the history is read waits for it', async () => {
    invoke.mockResolvedValue({ opened: null });
    const got: Array<[string, number]> = [];
    const { rerender } = renderHook(({ ready }) => useHostGoto(ready, (c, y) => got.push([c, y])), { initialProps: { ready: false } });
    send('goto:Q142:1780');
    expect(got).toEqual([]);
    rerender({ ready: true });
    expect(got).toEqual([['Q142', 1780]]);
  });
});
