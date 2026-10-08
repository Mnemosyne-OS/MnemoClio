/**
 * wiki.ts — the Wikipedia summary of one item, read when its card opens.
 *
 * Two reads, both on the person's gesture and never ahead of it: Wikidata says which article
 * the item has (its "sitelinks"), then Wikipedia's REST API gives that article's summary.
 * The article is taken in the app's language, else in English; the card says when it fell back.
 * An item with no article in either is a complete answer ("none"), not a failure.
 * Every read has a deadline (house rule 9); a summary is kept for the session (rule 15).
 */

export interface WikiSummary {
  lang: string;
  title: string;
  extract: string;
  url: string;
  image: string | null;
}

const DEADLINE_MS = 15000;
const cache = new Map<string, WikiSummary | null>();

/** The article to read: the app's language first, else English, else none. */
export function pickArticle(sitelinks: Record<string, { title?: string }> | undefined, lang: string): { lang: string; title: string } | null {
  for (const l of [lang, 'en']) {
    const title = sitelinks?.[`${l}wiki`]?.title;
    if (title) return { lang: l, title };
  }
  return null;
}

async function json(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(DEADLINE_MS)]), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** The summary of item `q` (Q42), or null when it has no article in the app's language nor in English. */
export async function fetchSummary(q: string, lang: string, signal: AbortSignal): Promise<WikiSummary | null> {
  const key = `${q}|${lang}`;
  if (cache.has(key)) return cache.get(key)!;
  const sites = lang === 'en' ? 'enwiki' : `${lang}wiki|enwiki`;
  const wd = (await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(q)}&props=sitelinks&sitefilter=${encodeURIComponent(sites)}&format=json&origin=*`, signal)) as {
    entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
  };
  const art = pickArticle(wd.entities?.[q]?.sitelinks, lang);
  if (!art) { cache.set(key, null); return null; }
  const s = (await json(`https://${art.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(art.title.replace(/ /g, '_'))}`, signal)) as {
    title?: string; extract?: string; thumbnail?: { source?: string }; content_urls?: { desktop?: { page?: string } };
  };
  // an article whose summary is empty (a disambiguation page, a stub) is no summary
  if (!s.extract) { cache.set(key, null); return null; }
  const out: WikiSummary = {
    lang: art.lang,
    title: s.title ?? art.title,
    extract: s.extract,
    url: s.content_urls?.desktop?.page ?? `https://${art.lang}.wikipedia.org/wiki/${encodeURIComponent(art.title.replace(/ /g, '_'))}`,
    image: s.thumbnail?.source ?? null,
  };
  cache.set(key, out);
  return out;
}
