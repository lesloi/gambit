import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../../lib/storage';
import { DEFAULT_ELO } from './level';
import {
  PLAY_LEVEL_STORAGE_KEY,
  PLAY_TIME_CONTROL_STORAGE_KEY,
  readPlayElo,
  readPlayTimeControl,
  savePlayElo,
  savePlayTimeControl,
} from './settings';
import { DEFAULT_TIME_CONTROL_INDEX, TIME_CONTROLS } from './timeControl';

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

const storedControl = (value: unknown): StorageLike =>
  memoryStorage({ [PLAY_TIME_CONTROL_STORAGE_KEY]: JSON.stringify(value) });

describe('play level preference', () => {
  it('starts on the default strength', () => {
    expect(readPlayElo(memoryStorage())).toBe(DEFAULT_ELO);
  });

  it('reads back the Elo it saved', () => {
    const storage = memoryStorage();

    savePlayElo(2100, storage);

    expect(readPlayElo(storage)).toBe(2100);
  });

  it('reads an Elo outside the slider', () => {
    expect(readPlayElo(stored({ elo: 600 }))).toBe(600);
    expect(readPlayElo(stored({ elo: 2600 }))).toBe(2600);
  });

  it('falls back to the default for a value it cannot read', () => {
    for (const value of [null, [], 'high', 42, { elo: 'high' }]) {
      expect(readPlayElo(stored(value)), JSON.stringify(value)).toBe(DEFAULT_ELO);
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

    expect(readPlayElo(broken)).toBe(DEFAULT_ELO);
    expect(() => savePlayElo(2600, broken)).not.toThrow();
    expect(readPlayTimeControl(broken)).toBe(DEFAULT_TIME_CONTROL_INDEX);
    expect(() => savePlayTimeControl(0, broken)).not.toThrow();
  });
});

describe('play time control preference', () => {
  it('starts on the default time control', () => {
    expect(readPlayTimeControl(memoryStorage())).toBe(DEFAULT_TIME_CONTROL_INDEX);
  });

  it('reads back the time control it saved', () => {
    const storage = memoryStorage();

    savePlayTimeControl(0, storage);

    expect(readPlayTimeControl(storage)).toBe(0);
  });

  it('finds the preset matching a pair stored by value', () => {
    expect(readPlayTimeControl(storedControl({ controlMs: 300_000, incrementMs: 0 }))).toBe(2);
    expect(readPlayTimeControl(storedControl({ controlMs: 900_000, incrementMs: 10_000 }))).toBe(4);
  });

  it('falls back to the default for a pair or a shape it does not offer', () => {
    for (const value of [
      null,
      [],
      'fast',
      42,
      { controlMs: 'slow', incrementMs: 0 },
      { controlMs: 600_000, incrementMs: 10_000 },
      { controlMs: -1, incrementMs: 0 },
    ]) {
      expect(readPlayTimeControl(storedControl(value)), JSON.stringify(value)).toBe(
        DEFAULT_TIME_CONTROL_INDEX,
      );
    }
  });

  it('keeps every saved pair in the offered list', () => {
    for (const index of TIME_CONTROLS.keys()) {
      const storage = memoryStorage();

      savePlayTimeControl(index, storage);

      expect(readPlayTimeControl(storage)).toBe(index);
    }
  });
});
