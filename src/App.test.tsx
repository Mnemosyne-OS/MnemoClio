/**
 * The whole cartridge, mounted on the REAL public/data, with a canvas that draws nothing.
 * Pure tests prove the parts; this one proves the wiring: the data lands, the subjects
 * arrive one by one, play moves the year, and what the cursor passes reaches the feed.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    // a card's Wikipedia summary: Wikidata names the article, Wikipedia gives its summary
    if (String(url).includes('wikidata.org/w/api.php')) {
      const q = /ids=(Q\d+)/.exec(String(url))![1]!;
      return new Response(JSON.stringify({ entities: { [q]: { sitelinks: { enwiki: { title: 'Article of ' + q } } } } }), { status: 200 });
    }
    if (String(url).includes('wikipedia.org/api/rest_v1/page/summary/')) {
      const title = decodeURIComponent(String(url).split('/').pop()!).replace(/_/g, ' ');
      return new Response(JSON.stringify({ title, extract: 'Summary of ' + title, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/x' } } }), { status: 200 });
    }
    const name = String(url).split('/').pop()!;
    try { return new Response(readFileSync(join(DATA, name), 'utf8'), { status: 200 }); }
    catch { return new Response('missing', { status: 404 }); }
  }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});
// Unmount BEFORE the stubs go: the timeline's frame loop runs on the stubbed
// requestAnimationFrame, and a frame still queued would call the real global,
// which jsdom does not have, after the environment is torn down.
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('MnemoClio', () => {
  it('reads the history, then the subjects as they land, and says when it is done', async () => {
    render(<App />);
    expect(await screen.findByText('In 1870, around the world', {}, { timeout: 8000 })).toBeTruthy();
    // every subject chip ends with a count, never the "…" of a subject still on its way
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    fireEvent.click(screen.getByRole('button', { name: /^Layers/ }));
    expect(screen.getByRole('button', { name: /^Births/ }).textContent).toMatch(/\d/);
  }, 30000);

  it('play moves the year, and what the cursor passes reaches the feed', async () => {
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    fireEvent.change(screen.getByRole('combobox', { name: 'Play speed' }), { target: { value: '20' } });
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
    fireEvent.click(screen.getByRole('button', { name: /^Layers/ }));
    for (const k of ['States and regions', 'Elections', 'Laws', 'Cities', 'Companies', 'Assassinations and attacks']) {
      expect(screen.getByRole('button', { name: new RegExp('^' + k) }).textContent).toMatch(/\d/);
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
    // the card reads his Wikipedia article, by the id Wikidata gives him
    expect(await screen.findByText('Summary of Article of Q937')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Read the article on Wikipedia' })).toBeTruthy();
    // Einstein's country is now on the timeline, chosen by the citizenship matching his birthplace,
    // and a country is named in the app's language (English here), not Deutschland, Россия, 日本
    expect(screen.getByRole('button', { name: /Germany/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Deutschland|日本/ })).toBeNull();
  }, 30000);

  it('names in the language of the app: one press reads that language file and renames what is on screen', async () => {
    // field, 07/10: the second names button said 'French names' to everyone, Spanish speakers included
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    expect(screen.getAllByText(/guerre franco-allemande de 1870/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Display/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Names in English' }));
    expect((await screen.findAllByText(/Franco-Prussian War/, {}, { timeout: 8000 })).length).toBeGreaterThan(0);
  }, 30000);
  it('a moment typed in the search: "go to the 15th century" fills the screen with it, and loops on it', async () => {
    // field, 07/10: "ask for a period and the map centres on it", without a model
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    const box = screen.getByRole('searchbox', { name: /Search the timeline/ });
    fireEvent.change(box, { target: { value: 'go to the 15th century' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Go to 1401–1500' }));
    expect(await screen.findByText('In 1451, around the world', {}, { timeout: 8000 })).toBeTruthy();
    // a name after "go to" is left to the name search: the French Revolution is found
    fireEvent.change(box, { target: { value: 'go to the French Revolution' } });
    expect((await screen.findAllByRole('button', { name: /French Revolution|Révolution française/ })).length).toBeGreaterThan(0);
    fireEvent.change(box, { target: { value: '1789 to 1799' } });
    fireEvent.click(await screen.findByRole('button', { name: '⟲ Loop 1789–1799' }));
    expect(await screen.findByRole('button', { name: '⟲ 1789–1799', pressed: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pause/ })).toBeTruthy();
    // a typed "go to" ends the loop too
    fireEvent.change(box, { target: { value: '1900' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Go to 1900' }));
    expect(screen.getByRole('button', { name: '⟲ Loop the screen', pressed: false })).toBeTruthy();
    fireEvent.change(box, { target: { value: '1789 to 1799' } });
    fireEvent.click(await screen.findByRole('button', { name: '⟲ Loop 1789–1799' }));
    // going to a result ends the loop: play would otherwise drag back to 1789
    fireEvent.change(box, { target: { value: 'einstein' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Albert Einstein 1879/ }));
    expect(screen.getByRole('button', { name: '⟲ Loop the screen', pressed: false })).toBeTruthy();
  }, 30000);

  it('at random: a year that has events comes under the cursor, and time runs', async () => {
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    await waitFor(() => expect(screen.queryByText(/Reading the history/)).toBeNull(), { timeout: 15000 });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: '🎲 At random' }));
    expect(screen.getByRole('button', { name: /Pause/ })).toBeTruthy();
    expect(screen.queryByText('In 1870, around the world')).toBeNull();
    vi.restoreAllMocks();
  }, 30000);
  it('how many people lived there: the world and each shown country, written about before 1950', async () => {
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    expect(await screen.findByText(/World: ≈ 1\.\d+B people/, {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.getAllByText(/≈ [\d.]+M people on its land of today/).length).toBeGreaterThan(0);
    // field, 07/10: the line wore the class of the country picker's floating box, and every line piled up in the top corner
    expect(document.querySelector('.clio-popline')).not.toBeNull();
    expect(document.querySelectorAll('p.clio-pop').length).toBe(0);
    // the share of women is known from 1960 only: nothing is said about it in 1870
    expect(screen.queryByText(/♀/)).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: /Search the timeline/ }), { target: { value: '1990' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Go to 1990' }));
    await screen.findByText('In 1990, around the world', {}, { timeout: 8000 });
    // from 1950 the UN's figure, no longer written about; from 1960 women and men
    expect(screen.getByText(/^👥 World: 5\.\d+B people/)).toBeTruthy();
    expect(screen.getAllByText(/♀ \d+\.\d % · ♂ \d+\.\d %/).length).toBeGreaterThan(0);
  }, 30000);
  it('epidemics: in 1348 the Black Death is under way, with the dead Wikidata records', async () => {
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    fireEvent.change(screen.getByRole('searchbox', { name: /Search the timeline/ }), { target: { value: '1348' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Go to 1348' }));
    await screen.findByText('In 1348, around the world', {}, { timeout: 8000 });
    expect(await screen.findByText('☣ Epidemics under way', {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByText(/^Black Death/, { selector: '.clio-epi li' })).toBeTruthy();
    expect(screen.getByText(/1346–1352 · 75M dead \(Wikidata\)/)).toBeTruthy();
    // off, the section is gone
    fireEvent.click(screen.getByRole('button', { name: /^Layers/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Epidemics/ }));
    expect(screen.queryByText('☣ Epidemics under way')).toBeNull();
  }, 30000);
  it('religions: off at first; on, the legend in a fixed order says what it counts, and no country is named in it', async () => {
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    expect(screen.queryByText('✦ Places of worship standing')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Layers/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Religions/ }));
    expect(await screen.findByText('✦ Places of worship standing', {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByText(/not believers/)).toBeTruthy();
    const items = [...document.querySelectorAll('.clio-rel li')].map((li) => li.textContent ?? '');
    // the order is the families' own, never the counts': Judaism comes before Christianity
    const j = items.findIndex((x) => x.startsWith('Judaism')), c = items.findIndex((x) => x.startsWith('Christianity'));
    expect(j).toBeGreaterThanOrEqual(0);
    expect(j).toBeLessThan(c);
    fireEvent.click(screen.getByRole('button', { name: /^Religions/ }));
    expect(screen.queryByText('✦ Places of worship standing')).toBeNull();
  }, 30000);
  it('layers: « only epidemics » leaves the epidemics alone on, and every layer can come back together', async () => {
    // field, 07/10: "if I want to see only the wars, or only the epidemics, or the religion, or the three together"
    render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    fireEvent.click(screen.getByRole('button', { name: /^Layers/ }));
    const layer = (re: RegExp) => screen.getByRole('button', { name: re });
    const epiRow = layer(/^Epidemics/).closest('.clio-layer')!;
    fireEvent.click(epiRow.querySelector('.clio-layer-only')!);
    expect(layer(/^Epidemics/).getAttribute('aria-pressed')).toBe('true');
    for (const re of [/^Wars/, /^Rulers/, /^Religions/, /^Events/]) expect(layer(re).getAttribute('aria-pressed')).toBe('false');
    // the events' subjects are off with it, and come back as they were
    expect(screen.queryAllByRole('button', { name: /^Births/, pressed: true }).length).toBe(0);
    fireEvent.click(layer(/^Events/));
    expect(screen.getByRole('button', { name: /^Births/ }).getAttribute('aria-pressed')).toBe('true');
    // wars and religions together, with the epidemics
    fireEvent.click(layer(/^Wars/));
    fireEvent.click(layer(/^Religions/));
    for (const re of [/^Wars/, /^Religions/, /^Epidemics/]) expect(layer(re).getAttribute('aria-pressed')).toBe('true');
  }, 30000);

  it('Ctrl + wheel over the timeline and the map is left to the board, the plain wheel zooms them', async () => {
    const { container } = render(<App />);
    await screen.findByText('In 1870, around the world', {}, { timeout: 8000 });
    // the canvases that take the wheel (the timeline, the map): a plain wheel is theirs
    const wheeled = [...container.querySelectorAll('canvas')].filter((c) => {
      const plain = new WheelEvent('wheel', { deltaY: 100, cancelable: true, bubbles: true });
      c.dispatchEvent(plain);
      return plain.defaultPrevented;
    });
    expect(wheeled.length).toBeGreaterThanOrEqual(2);
    for (const c of wheeled) {
      const ctrl = new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, cancelable: true, bubbles: true });
      c.dispatchEvent(ctrl);
      expect(ctrl.defaultPrevented).toBe(false);
    }
  }, 30000);
});
