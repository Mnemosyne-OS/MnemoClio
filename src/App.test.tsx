/**
 * The whole cartridge, mounted on the REAL public/data, with a canvas that draws nothing.
 * Pure tests prove the parts; this one proves the wiring: the data lands, the subjects
 * arrive one by one, play moves the year, and what the cursor passes reaches the feed.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const DATA = join(__dirname, '..', 'public', 'data');

function fakeCanvas() {
  // every 2D call is a no-op; measureText answers a width so labels can be placed
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === 'measureText' ? (s: string) => ({ width: s.length * 6 }) : () => undefined),
    set: () => true,
  });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
}

beforeEach(() => {
  fakeCanvas();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const name = String(url).split('/').pop()!;
    try { return new Response(readFileSync(join(DATA, name), 'utf8'), { status: 200 }); }
    catch { return new Response('missing', { status: 404 }); }
  }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('MnemoClio', () => {
  it('reads the history, then the subjects as they land, and says when it is done', async () => {
    render(<App />);
    expect(await screen.findByText('In 1870, around the world', {}, { timeout: 8000 })).toBeTruthy();
    // every subject chip ends with a count, never the "…" of a subject still on its way
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    expect(screen.getByRole('button', { name: /Births/ }).textContent).toMatch(/\d/);
  }, 30000);

  it('play moves the year, and what the cursor passes reaches the feed', async () => {
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    fireEvent.click(screen.getByRole('button', { name: '20 years / s' }));
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    await act(async () => { await new Promise((r) => setTimeout(r, 1500)); });
    const title = screen.getByRole('heading', { level: 2 }).textContent ?? '';
    const year = Number(title.match(/\d{4}/)?.[0]);
    expect(year).toBeGreaterThan(1880);
    expect(screen.getByText('Just happened')).toBeTruthy();
    expect(document.querySelectorAll('.clio-spark').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
  }, 30000);

  it('the United States are not empty: a search finds Lincoln as a leader and opens his term among the presidents', async () => {
    // Field, 05/10: "il y a rien sur les États-Unis" — no presidents, no founding, no states.
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    fireEvent.change(screen.getByRole('searchbox', { name: /Search the timeline/ }), { target: { value: 'abraham lincoln' } });
    fireEvent.click(await screen.findByRole('button', { name: /Abraham Lincoln leader · 1861/ }));
    expect(await screen.findByText(/President of the United States/)).toBeTruthy();
    expect(screen.getByText('Before and after, in the same office')).toBeTruthy();
    // the subjects added that day are on the timeline
    for (const k of ['States and regions', 'Elections', 'Laws', 'Cities', 'Companies', 'Assassinations and attacks']) {
      expect(screen.getByRole('button', { name: new RegExp(k) }).textContent).toMatch(/\d/);
    }
  }, 30000);

  it('an ended state can be put on the timeline, and shows who ruled it in the cursor year', async () => {
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    fireEvent.click(screen.getByRole('button', { name: /Add a country/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: /Add a country/ }), { target: { value: 'ottoman' } });
    fireEvent.click(await screen.findByRole('button', { name: /ended state, 1299/ }));
    // the chip is there, and in 1870 the empire's block names who was in power
    const block = (await screen.findAllByText('In power :')).map((n) => n.closest('section')?.textContent ?? '');
    expect(block.some((t) => /Abd|عبد/.test(t))).toBe(true);
  }, 30000);

  it('a search finds a person in any form of the name and opens the card with what happened elsewhere', async () => {
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    fireEvent.change(screen.getByRole('searchbox', { name: /Search the timeline/ }), { target: { value: 'einstein' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Albert Einstein 1879/ }));
    expect(await screen.findByText('Meanwhile, elsewhere, in 1879')).toBeTruthy();
    // Einstein's country is now on the timeline, chosen by the citizenship matching his birthplace
    expect(screen.getByRole('button', { name: /Deutschland/ })).toBeTruthy();
  }, 30000);
});
