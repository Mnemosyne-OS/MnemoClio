import { describe, expect, it } from 'vitest';
import { countryName, itemKey, translatedName } from './names';

const russia = { o: 'Россия', f: 'Russie', en: null, nl: { en: 'Russia', es: 'Rusia', de: 'Russland', zh: '俄罗斯' } };

describe('countryName', () => {
  it('names a country in the language of the app, French from its own field', () => {
    expect(countryName(russia, 'es')).toBe('Rusia');
    expect(countryName(russia, 'zh')).toBe('俄罗斯');
    expect(countryName(russia, 'fr')).toBe('Russie');
  });

  it('falls back to English, then French, then the original, never inventing one', () => {
    expect(countryName(russia, 'pt')).toBe('Russia');
    expect(countryName({ o: 'Ελλάδα', f: 'Grèce', en: null, nl: {} }, 'pt', 'Greece')).toBe('Greece');
    expect(countryName({ o: 'Ελλάδα', f: 'Grèce', en: null, nl: {} }, 'pt')).toBe('Grèce');
    expect(countryName({ o: 'Ελλάδα', f: null, en: null, nl: {} }, 'de')).toBe('Ελλάδα');
  });
});

describe('translatedName', () => {
  const battle = { o: 'Schlacht bei Leipzig', ol: 'de', f: 'bataille de Leipzig', q: 'Q154977' };
  const war = { o: 'Guerra de la Independencia', ol: 'es', f: null, id: 'Q201' };
  const es = new Map([['Q154977', 'Batalla de Leipzig']]);

  it('reads French from the item and every other language from its file', () => {
    expect(translatedName(battle, 'fr', null)).toBe('bataille de Leipzig');
    expect(translatedName(battle, 'es', es)).toBe('Batalla de Leipzig');
  });

  it('has no name while the file is not read, or when the language has none', () => {
    expect(translatedName(battle, 'es', null)).toBeNull();
    expect(translatedName(war, 'es', es)).toBeNull();
    expect(translatedName(war, 'fr', null)).toBeNull();
  });

  it('knows an item by q, else by id, else not at all', () => {
    expect(itemKey(battle)).toBe('Q154977');
    expect(itemKey(war)).toBe('Q201');
    expect(itemKey({ o: 'x', ol: 'en', f: null })).toBeNull();
  });
});
