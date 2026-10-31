import { describe, expect, it } from 'vitest';
import { DEFAULT_PUZZLE_FILTERS } from './content';
import {
  PUZZLE_FILTERS_STORAGE_KEY,
  readPuzzleFilters,
  savePuzzleFilters,
  type FilterStorage,
} from './filterStorage';

function memoryStorage(initial: Record<string, string> = {}): FilterStorage {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

const stored = (value: unknown): FilterStorage =>
  memoryStorage({ [PUZZLE_FILTERS_STORAGE_KEY]: JSON.stringify(value) });

describe('puzzle filter storage', () => {
  it('reads back the filters it saved', () => {
    const storage = memoryStorage();

    savePuzzleFilters({ length: '3', rating: 'middle' }, storage);

    expect(readPuzzleFilters(storage)).toEqual({ length: '3', rating: 'middle' });
  });

  it('returns the defaults when nothing is stored', () => {
    expect(readPuzzleFilters(memoryStorage())).toEqual(DEFAULT_PUZZLE_FILTERS);
  });

  it('returns the defaults when the stored value is not JSON', () => {
    const storage = memoryStorage({ [PUZZLE_FILTERS_STORAGE_KEY]: '{not json' });

    expect(readPuzzleFilters(storage)).toEqual(DEFAULT_PUZZLE_FILTERS);
  });

  it('returns the defaults when the stored value is not a filters object', () => {
    for (const value of [null, [], 'low', 42]) {
      expect(readPuzzleFilters(stored(value)), JSON.stringify(value)).toEqual(
        DEFAULT_PUZZLE_FILTERS,
      );
    }
  });

  it('keeps the field that is still valid and resets the other', () => {
    expect(readPuzzleFilters(stored({ length: '3', rating: 'huge' }))).toEqual({
      length: '3',
      rating: 'any',
    });
    expect(readPuzzleFilters(stored({ length: '2', rating: 'low' }))).toEqual({
      length: 'any',
      rating: 'low',
    });
  });

  it('survives a storage that throws', () => {
    const broken: FilterStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };

    expect(readPuzzleFilters(broken)).toEqual(DEFAULT_PUZZLE_FILTERS);
    expect(() => savePuzzleFilters({ length: '5', rating: 'high' }, broken)).not.toThrow();
  });

  it('does nothing without a storage', () => {
    expect(readPuzzleFilters(null)).toEqual(DEFAULT_PUZZLE_FILTERS);
    expect(() => savePuzzleFilters({ length: '1', rating: 'low' }, null)).not.toThrow();
  });
});
