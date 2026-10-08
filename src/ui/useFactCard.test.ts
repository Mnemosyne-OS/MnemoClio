import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ev } from '../data/types';
import { factCard, type FactCard } from '../data/fact';

const invoke = vi.fn();
vi.mock('../sdk/mnemo-sdk', () => ({ MnemoCartridgeSDK: class { invoke = invoke; } }));
const { useFactCard } = await import('./useFactCard');

const ev = (q: string, y: number): Ev => ({ q, y, c: 'Q142', sl: 200, o: q, ol: 'en', f: null, k: 'society', h: null, lon: null, lat: null, sub: null });
const EVENTS = Array.from({ length: 20 }, (_, i) => ev('Q' + (i + 1), 1800 + i));
const build = (e: Ev): FactCard => factCard({ name: e.o, year: String(e.y), ago: 1, country: null, kind: 'k', meanwhile: null, words: { when: '{year}', meanwhile: '', source: 's' } });

beforeEach(() => {
  invoke.mockReset();
  localStorage.clear();
  vi.stubGlobal('parent', { postMessage() {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('useFactCard', () => {
  it('outside the shell there is no board: nothing is asked', () => {
    vi.unstubAllGlobals();
    const { result } = renderHook(() => useFactCard(EVENTS, build, () => {}));
    expect(result.current.available).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('a card pinned yesterday gets today\'s fact at start, without a press', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'cockpit.state' ? { pinned: ['fact'] } : { success: true, pinned: ['fact'] }));
    const { result } = renderHook(() => useFactCard(EVENTS, build, () => {}));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('cockpit.publish', expect.anything(), expect.any(Number)));
    expect(result.current.pinned).toBe(true);
    const card = invoke.mock.calls.find((c) => c[0] === 'cockpit.publish')![1].cards[0];
    expect(card.id).toBe('fact');
  });

  it('nothing pinned, nothing published; a press pins on the board', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'cockpit.state' ? { pinned: [] } : { success: true, pinned: ['fact'] }));
    const { result } = renderHook(() => useFactCard(EVENTS, build, () => {}));
    await waitFor(() => expect(result.current.pinned).toBe(false));
    expect(invoke.mock.calls.some((c) => c[0] === 'cockpit.publish')).toBe(false);
    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.pinned).toBe(true));
    expect(invoke).toHaveBeenCalledWith('cockpit.pin', expect.objectContaining({ id: 'fact', level: 'plane' }), expect.any(Number));
    // the manifest is read again first: cockpit:pin is newer than the host's start
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf('permissions.refresh')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('permissions.refresh')).toBeLessThan(order.indexOf('cockpit.pin'));
  });

  it('a refused pin says why', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'cockpit.state' ? { pinned: [] } : action === 'cockpit.pin' ? { success: false, error: 'PERMISSION_DENIED', pinned: [] } : {}));
    const { result } = renderHook(() => useFactCard(EVENTS, build, () => {}));
    await waitFor(() => expect(result.current.pinned).toBe(false));
    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.error).toBe('PERMISSION_DENIED'));
  });

  it('a refused publish stops publishing on changes nobody pressed for, until the next press', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'cockpit.state' ? { pinned: ['fact'] } : { success: false, pinned: ['fact'] }));
    const { result, rerender } = renderHook(({ b }) => useFactCard(EVENTS, b, () => {}), { initialProps: { b: build } });
    const publishes = () => invoke.mock.calls.filter((c) => c[0] === 'cockpit.publish').length;
    await waitFor(() => expect(publishes()).toBe(1));
    // the language changes: a new card, and no new publish (a revoked permission would raise the dialog)
    rerender({ b: (e: Ev) => ({ ...build(e), title: 'other language' }) });
    await new Promise((r) => setTimeout(r, 30));
    expect(publishes()).toBe(1);
    // a press tries again
    act(() => result.current.another());
    await waitFor(() => expect(publishes()).toBe(2));
  });

  it('another fact replaces the card, and the press on the card opens that fact', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'cockpit.state' ? { pinned: ['fact'] } : { success: true, pinned: ['fact'] }));
    const opened: string[] = [];
    const { result } = renderHook(() => useFactCard(EVENTS, build, (q) => opened.push(q)));
    await waitFor(() => expect(invoke.mock.calls.filter((c) => c[0] === 'cockpit.publish').length).toBe(1));
    const first = invoke.mock.calls.find((c) => c[0] === 'cockpit.publish')![1].cards[0].title;
    act(() => result.current.another());
    await waitFor(() => expect(invoke.mock.calls.filter((c) => c[0] === 'cockpit.publish').length).toBe(2));
    const second = invoke.mock.calls.filter((c) => c[0] === 'cockpit.publish')[1]![1].cards[0].title;
    expect(second).not.toBe(first);
    act(() => { window.dispatchEvent(new MessageEvent('message', { source: window.parent as Window, data: { type: 'MNEMO_PLUGIN_EVENT', event: 'cockpit:card-opened', data: { id: 'fact' } } })); });
    expect(opened).toEqual([second]);
  });
  it('🚨 no fact until every subject is read: drawn from a partial pool it was not the same for everyone', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'cockpit.state' ? { pinned: ['fact'] } : { success: true, pinned: ['fact'] }));
    const { rerender } = renderHook(({ done }) => useFactCard(EVENTS, build, () => {}, done), { initialProps: { done: false } });
    await new Promise((r) => setTimeout(r, 20));
    expect(invoke.mock.calls.some((c) => c[0] === 'cockpit.publish')).toBe(false);
    rerender({ done: true });
    await waitFor(() => expect(invoke.mock.calls.some((c) => c[0] === 'cockpit.publish')).toBe(true));
    // and the publish writes no choice: only a press does
    expect(localStorage.getItem('mnemo-clio.fact')).toBeNull();
  });

  it('🚨 a press on the card that launched this window waits for the fact, then opens it', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'cockpit.state' ? { pinned: ['fact'], opened: { id: 'fact', at: new Date().toISOString() } } : { success: true, pinned: ['fact'] }));
    const opened: string[] = [];
    const { rerender } = renderHook(({ done }) => useFactCard(EVENTS, build, (q) => opened.push(q), done), { initialProps: { done: false } });
    await new Promise((r) => setTimeout(r, 20));
    expect(opened).toEqual([]);
    rerender({ done: true });
    await waitFor(() => expect(opened.length).toBe(1));
  });

  it('an old press is not replayed at a later start', async () => {
    invoke.mockImplementation(async (action: string) => (action === 'cockpit.state' ? { pinned: ['fact'], opened: { id: 'fact', at: new Date(Date.now() - 120000).toISOString() } } : { success: true, pinned: ['fact'] }));
    const opened: string[] = [];
    renderHook(() => useFactCard(EVENTS, build, (q) => opened.push(q)));
    await waitFor(() => expect(invoke.mock.calls.some((c) => c[0] === 'cockpit.publish')).toBe(true));
    expect(opened).toEqual([]);
  });
});
