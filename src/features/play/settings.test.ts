import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../../lib/storage';
import { DEFAULT_LEVEL_INDEX, LEVELS } from './level';
import { PLAY_LEVEL_STORAGE_KEY, readPlayLevel, savePlayLevel } from './settings';

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}

const stored = (value: unknown): StorageLike =>
  memoryStorage({ [PLAY_LEVEL_STORAGE_KEY]: JSON.stringify(value) });

describe('play level preference', () => {
  it('starts on the default level', () => {
    expect(readPlayLevel(memoryStorage())).toBe(DEFAULT_LEVEL_INDEX);
  });

  it('reads back the level it saved', () => {
    const storage = memoryStorage();

    savePlayLevel(4, storage);

    expect(readPlayLevel(storage)).toBe(4);
  });

  it('finds the nearest level for an Elo stored by an older list', () => {
    expect(readPlayLevel(stored({ elo: 1574 }))).toBe(1);
    expect(readPlayLevel(stored({ elo: 1576 }))).toBe(2);
  });

  it('falls back to the default for a value it cannot read', () => {
    for (const value of [null, [], 'high', 42, { elo: 'high' }]) {
      expect(readPlayLevel(stored(value)), JSON.stringify(value)).toBe(DEFAULT_LEVEL_INDEX);
    }
  });

  it('survives a storage that throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };

    expect(readPlayLevel(broken)).toBe(DEFAULT_LEVEL_INDEX);
    expect(() => savePlayLevel(LEVELS.length - 1, broken)).not.toThrow();
  });
});
