import { describe, expect, it } from 'vitest';
import { findNamed, nameWords, type Named } from './agentFind';

const item = (id: string, name: string): Named<string> => ({ item: id, id, names: [name], label: name });
const ITEMS = [item('P1', 'Révolution française'), item('P2', 'Révolution française de 1848'), item('W1', 'Guerre de Cent Ans'), item('W2', 'Guerre de Trente Ans'), item('E1', 'Empire')];
const kind = { code: 'NO_ITEM', noun: 'item' };

describe('a thing of history named the way a person says it', () => {
  it('folds case, accents, articles and a plural; « guerre » is a word of the name', () => {
    expect(nameWords('la Révolution FRANÇAISE')).toEqual(['revolution', 'francaise']);
    expect(nameWords('les croisades')).toEqual(['croisade']);
    expect(nameWords('la guerre de Cent Ans')).toEqual(['guerre', 'cent', 'ans']);
  });

  it('an id, the whole name, or every word of it', () => {
    expect(findNamed(ITEMS, 'W2', kind)).toBe('W2');
    // « Révolution française » is a whole name: it wins over the one that holds its words
    expect(findNamed(ITEMS, 'la révolution française', kind)).toBe('P1');
    expect(findNamed(ITEMS, 'révolution 1848', kind)).toBe('P2');
    expect(findNamed(ITEMS, 'cent ans', kind)).toBe('W1');
  });

  it('several matches are refused with their names, never the first taken', () => {
    expect(() => findNamed(ITEMS, 'guerre', kind)).toThrow('AMBIGUOUS: "guerre" names several items: Guerre de Cent Ans, Guerre de Trente Ans; say which');
    const twice = [item('R1', 'Empire'), { ...item('R2', 'Empire'), label: 'Empire (Germany)' }];
    expect(() => findNamed(twice, 'Empire', kind)).toThrow('AMBIGUOUS: "Empire" names several items: Empire, Empire (Germany); say which');
  });

  it('no match is refused with the names that exist', () => {
    expect(() => findNamed(ITEMS.slice(2, 4), 'peste', kind)).toThrow('NO_ITEM: no item named "peste"; items: Guerre de Cent Ans, Guerre de Trente Ans');
    expect(() => findNamed(ITEMS, ' ', kind)).toThrow(/^BAD_ARG/);
    expect(() => findNamed([], 'empire', kind)).toThrow('items: none');
  });
});
