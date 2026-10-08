import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chronicle } from '../data/chronicle';

const invoke = vi.fn();
vi.mock('../sdk/mnemo-sdk', () => ({ MnemoCartridgeSDK: class { invoke = invoke; } }));
const { usePourHistory, HISTORY_SPINE } = await import('./usePourHistory');

const ch = (i: number): Chronicle => ({ sourceRef: 'mnemo-clio:Q142:' + i, start: i, size: 10, content: '# France ' + i });
const list = [ch(1780), ch(1790), ch(1800)];

beforeEach(() => { invoke.mockReset(); localStorage.clear(); vi.stubGlobal('parent', { postMessage() {} }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('pouring a country into memory', () => {
  it('outside the shell there is no memory: not available, nothing asked', () => {
    vi.unstubAllGlobals();
    const { result } = renderHook(() => usePourHistory());
    expect(result.current.available).toBe(false);
    act(() => result.current.pour('Q142', 'france', () => list));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('the manifest is read again, the pack asked, then every chronicle goes in under its reference', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'vault.pack.ensure' ? { vault: 'KP-MNEMO-CLIO-FRANCE' } : {}));
    const { result } = renderHook(() => usePourHistory());
    act(() => result.current.pour('Q142', 'france', () => list));
    await waitFor(() => expect(result.current.stateOf('Q142').kind).toBe('done'));
    const actions = invoke.mock.calls.map((c) => c[0]);
    expect(actions).toEqual(['permissions.refresh', 'vault.pack.ensure', 'mnemosyne.ingest', 'mnemosyne.ingest', 'mnemosyne.ingest']);
    expect(invoke.mock.calls[1]![1]).toEqual({ pack: 'france', lexicalOnly: true });
    expect(invoke.mock.calls[2]![1]).toEqual({ vault: 'KP-MNEMO-CLIO-FRANCE', content: '# France 1780', spineType: HISTORY_SPINE, sourceRef: 'mnemo-clio:Q142:1780' });
    const s = result.current.stateOf('Q142');
    expect(s.kind === 'done' && s.poured).toMatchObject({ n: 3, vault: 'KP-MNEMO-CLIO-FRANCE' });
    // remembered: the next window says when it was poured
    const again = renderHook(() => usePourHistory());
    const idle = again.result.current.stateOf('Q142');
    expect(idle.kind === 'idle' && idle.last?.n).toBe(3);
  });

  it('a refused chronicle is counted, never hidden under « done »', async () => {
    let n = 0;
    invoke.mockImplementation(async (action: string) => {
      if (action === 'vault.pack.ensure') return { vault: 'V' };
      if (action === 'mnemosyne.ingest' && n++ === 1) throw new Error('CONTENT_TOO_LARGE');
      return {};
    });
    const { result } = renderHook(() => usePourHistory());
    act(() => result.current.pour('Q142', 'france', () => list));
    await waitFor(() => expect(result.current.stateOf('Q142').kind).toBe('done'));
    const s = result.current.stateOf('Q142');
    expect(s.kind === 'done' && [s.poured.n, s.refused]).toEqual([2, 1]);
  });

  it('no knowledge folder: the failure is the host\'s code, and nothing is ingested', async () => {
    invoke.mockImplementation(async (action: string) => { if (action === 'vault.pack.ensure') throw new Error('NO_KNOWLEDGE_ROOT'); return {}; });
    const { result } = renderHook(() => usePourHistory());
    act(() => result.current.pour('Q142', 'france', () => list));
    await waitFor(() => expect(result.current.stateOf('Q142').kind).toBe('failed'));
    const s = result.current.stateOf('Q142');
    expect(s.kind === 'failed' && s.why).toContain('NO_KNOWLEDGE_ROOT');
    expect(invoke.mock.calls.some((c) => c[0] === 'mnemosyne.ingest')).toBe(false);
  });

  it('Stop ends the pour after the chronicle in flight, and says it stopped', async () => {
    let release: () => void = () => {};
    invoke.mockImplementation(async (action: string) => {
      if (action === 'vault.pack.ensure') return { vault: 'V' };
      if (action === 'mnemosyne.ingest') await new Promise<void>((r) => { release = r; });
      return {};
    });
    const { result } = renderHook(() => usePourHistory());
    act(() => result.current.pour('Q142', 'france', () => list));
    await waitFor(() => expect(invoke.mock.calls.filter((c) => c[0] === 'mnemosyne.ingest').length).toBe(1));
    act(() => result.current.stop());
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.stateOf('Q142').kind).toBe('done'));
    const s = result.current.stateOf('Q142');
    expect(s.kind === 'done' && [s.poured.n, s.stopped]).toEqual([1, true]);
    expect(invoke.mock.calls.filter((c) => c[0] === 'mnemosyne.ingest').length).toBe(1);
  });
  it('a host that answers without a vault is a failure, and nothing is ingested', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'vault.pack.ensure' ? { success: true } : {}));
    const { result } = renderHook(() => usePourHistory());
    act(() => result.current.pour('Q142', 'france', () => list));
    await waitFor(() => expect(result.current.stateOf('Q142').kind).toBe('failed'));
    expect(invoke.mock.calls.some((c) => c[0] === 'mnemosyne.ingest')).toBe(false);
  });

  it('the reason of a refusal travels with its count', async () => {
    invoke.mockImplementation(async (action: string) => { if (action === 'vault.pack.ensure') return { vault: 'V' }; if (action === 'mnemosyne.ingest') throw new Error('CONTENT_TOO_LARGE'); return {}; });
    const { result } = renderHook(() => usePourHistory());
    act(() => result.current.pour('Q142', 'france', () => list));
    await waitFor(() => expect(result.current.stateOf('Q142').kind).toBe('done'));
    const s = result.current.stateOf('Q142');
    expect(s.kind === 'done' && [s.refused, s.why]).toEqual([3, 'CONTENT_TOO_LARGE']);
  });
});
