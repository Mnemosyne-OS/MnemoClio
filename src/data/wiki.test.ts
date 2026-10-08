import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSummary, pickArticle } from './wiki';

afterEach(() => { vi.unstubAllGlobals(); });

const answer = (sitelinks: Record<string, { title: string }>, extract = 'An extract.') =>
  vi.fn(async (url: string) => String(url).includes('wikidata.org')
    ? new Response(JSON.stringify({ entities: { [/ids=(Q\d+)/.exec(String(url))![1]!]: { sitelinks } } }), { status: 200 })
    : new Response(JSON.stringify({ title: 'T', extract, thumbnail: { source: 'https://upload.wikimedia.org/x.jpg' } }), { status: 200 }));

describe('wiki', () => {
  it('reads the article in the app language first, else in English, else none', () => {
    expect(pickArticle({ frwiki: { title: 'Paris' }, enwiki: { title: 'Paris' } }, 'fr')).toEqual({ lang: 'fr', title: 'Paris' });
    expect(pickArticle({ enwiki: { title: 'Urartu' } }, 'fr')).toEqual({ lang: 'en', title: 'Urartu' });
    expect(pickArticle({ dewiki: { title: 'X' } }, 'fr')).toBeNull();
    expect(pickArticle(undefined, 'fr')).toBeNull();
  });

  it('falls back to English Wikipedia and says so through the language it returns', async () => {
    const f = answer({ enwiki: { title: 'Nabataean Kingdom' } });
    vi.stubGlobal('fetch', f);
    const s = await fetchSummary('Q100001', 'fr', new AbortController().signal);
    expect(s?.lang).toBe('en');
    expect(String(f.mock.calls[1]![0])).toContain('https://en.wikipedia.org/api/rest_v1/page/summary/Nabataean_Kingdom');
    expect(s?.image).toBe('https://upload.wikimedia.org/x.jpg');
  });

  it('an item with no article is a complete answer (null) and Wikipedia is not asked', async () => {
    const f = answer({});
    vi.stubGlobal('fetch', f);
    expect(await fetchSummary('Q100002', 'fr', new AbortController().signal)).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('an empty summary (a disambiguation page) is no summary', async () => {
    vi.stubGlobal('fetch', answer({ frwiki: { title: 'Mercure' } }, ''));
    expect(await fetchSummary('Q100003', 'fr', new AbortController().signal)).toBeNull();
  });

  it('asks once per item and language in a session', async () => {
    const f = answer({ frwiki: { title: 'Rome' } });
    vi.stubGlobal('fetch', f);
    await fetchSummary('Q100004', 'fr', new AbortController().signal);
    await fetchSummary('Q100004', 'fr', new AbortController().signal);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('a refused read is an error, never an empty answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })));
    await expect(fetchSummary('Q100005', 'fr', new AbortController().signal)).rejects.toThrow('HTTP 503');
  });
});
