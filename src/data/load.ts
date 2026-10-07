/**
 * load.ts — public/data, read in the order that lets the screen fill as the bytes land.
 *
 * meta.json first (it names every file and its size), then the regimes and wars, then one
 * file per subject, three at a time. Each subject is handed to the app the moment it is
 * decoded, so the timeline draws it then: the arrival on screen IS the load.
 * Every read has a deadline (house rule 9); a failed subject is reported by name and the
 * others still arrive.
 */
import { decodeEvents, decodeHistory, type RawEvents } from './decode';
import type { Country, Ev, History, Kind, Meta, WorldCountry } from './types';

const DEADLINE_MS = 30000;

export async function getJson<T>(url: string, signal?: AbortSignal, ms = DEADLINE_MS): Promise<T> {
  const deadline = AbortSignal.timeout(ms);
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

export interface LoadHandlers {
  onMeta(meta: Meta): void;
  onHistory(history: History): void;
  onKind(kind: Kind, events: Ev[], dropped: number): void;
  onWorld(world: WorldCountry[]): void;
  onError(what: string, error: unknown): void;
}

export async function loadAll(h: LoadHandlers, signal: AbortSignal, base = 'data/'): Promise<void> {
  let meta: Meta;
  try {
    meta = await getJson<Meta>(base + 'meta.json', signal);
  } catch (e) {
    // an abort is the component going away (or StrictMode remounting it), never a failure to report
    if (!signal.aborted) h.onError('meta', e);
    return;
  }
  if (signal.aborted) return;
  h.onMeta(meta);
  let countries: Country[];
  try {
    const history = decodeHistory(await getJson(base + 'history.json', signal));
    countries = history.countries;
    if (signal.aborted) return;
    h.onHistory(history);
  } catch (e) {
    if (!signal.aborted) h.onError('history', e);
    return;
  }
  const kinds = meta.files.filter((f) => f.file.startsWith('events-'));
  const world = meta.files.find((f) => f.what === 'world');
  const queue: Array<() => Promise<void>> = kinds.map((f) => async () => {
    try {
      const raw = await getJson<RawEvents>(base + f.file, signal);
      const { events, dropped } = decodeEvents(raw, countries);
      if (!signal.aborted) h.onKind(raw.kind, events, dropped);
    } catch (e) {
      if (!signal.aborted) h.onError(f.what, e);
    }
  });
  if (world) {
    queue.push(async () => {
      try {
        const w = await getJson<WorldCountry[]>(base + world.file, signal);
        if (!signal.aborted) h.onWorld(w);
      } catch (e) {
        if (!signal.aborted) h.onError('world', e);
      }
    });
  }
  // Three at a time: enough to overlap the reads, few enough that the first subjects land early.
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length && !signal.aborted) await queue.shift()!();
  });
  await Promise.all(workers);
}
