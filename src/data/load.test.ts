import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAll, type LoadHandlers } from './load';

const meta = { readAt: '2026-10-05', source: 's', countries: 1, wars: 0, regimes: 0, files: [
  { file: 'history.json', what: 'history', bytes: 1 },
  { file: 'events-person.json', what: 'person', count: 1, bytes: 1 },
  { file: 'events-work.json', what: 'work', count: 1, bytes: 1 },
] };
const history = { countries: [{ id: 'Q142', lang: 'fr', o: 'France', ol: 'fr', f: 'France', n: 1 }], wars: [], states: [], periods: [] };
const person = { kind: 'person', langs: ['fr'], subs: [], rows: [[1871, 0, null, null, 9, 'Marcel Proust', 0, 1, -1, 7199]] };

function handlers() {
  return { onMeta: vi.fn(), onHistory: vi.fn(), onKind: vi.fn(), onWorld: vi.fn(), onError: vi.fn() } satisfies LoadHandlers;
}

function serve(routes: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const name = String(url).split('/').pop()!;
    if (!(name in routes)) return new Response('no', { status: 404 });
    return new Response(JSON.stringify(routes[name]), { status: 200 });
  }));
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('loadAll', () => {
  it('hands each subject over as it lands, and names the one that failed while the others still arrive', async () => {
    serve({ 'meta.json': meta, 'history.json': history, 'events-person.json': person });
    const h = handlers();
    await loadAll(h, new AbortController().signal);
    expect(h.onHistory).toHaveBeenCalledTimes(1);
    expect(h.onKind).toHaveBeenCalledWith('person', expect.arrayContaining([expect.objectContaining({ q: 'Q7199' })]), 0);
    expect(h.onError).toHaveBeenCalledWith('work', expect.any(Error));
  });

  it('an abort is the component leaving (or StrictMode remounting it): nothing is reported as failed', async () => {
    // Field, 2026-10-05: the first preview showed "meta could not be read: signal is aborted"
    // because StrictMode's first, aborted run reported its abort as an error.
    serve({ 'meta.json': meta, 'history.json': history, 'events-person.json': person });
    const h = handlers();
    const ac = new AbortController();
    ac.abort();
    await loadAll(h, ac.signal);
    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onMeta).not.toHaveBeenCalled();
  });

  it('a missing meta or history is a failure named as such, not an empty timeline', async () => {
    serve({});
    const h = handlers();
    await loadAll(h, new AbortController().signal);
    expect(h.onError).toHaveBeenCalledWith('meta', expect.any(Error));
    expect(h.onHistory).not.toHaveBeenCalled();
  });
});
