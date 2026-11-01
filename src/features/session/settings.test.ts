import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_SETTINGS,
  NEW_CARD_CHOICES,
  readSessionSettings,
  saveSessionSettings,
  SESSION_SETTINGS_STORAGE_KEY,
} from './settings';
import type { SessionStorage } from './storage';

function memoryStorage(initial: Record<string, string> = {}): SessionStorage {
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

const stored = (value: unknown): SessionStorage =>
  memoryStorage({ [SESSION_SETTINGS_STORAGE_KEY]: JSON.stringify(value) });

describe('session settings', () => {
  it('plans five new cards in the low band by default', () => {
    expect(readSessionSettings(memoryStorage())).toEqual(DEFAULT_SESSION_SETTINGS);
    expect(DEFAULT_SESSION_SETTINGS).toEqual({ newCards: 5, band: 'low' });
  });

  it('reads back the choices it saved', () => {
    const storage = memoryStorage();

    saveSessionSettings({ newCards: 10, band: 'middle' }, storage);

    expect(readSessionSettings(storage)).toEqual({ newCards: 10, band: 'middle' });
  });

  it('offers the counts the home screen lets the user choose', () => {
    expect(NEW_CARD_CHOICES).toContain(DEFAULT_SESSION_SETTINGS.newCards);
  });

  it('resets each field that is not valid, and keeps the other', () => {
    expect(readSessionSettings(stored({ newCards: 4, band: 'high' }))).toEqual({
      newCards: 5,
      band: 'high',
    });
    expect(readSessionSettings(stored({ newCards: 3, band: 'expert' }))).toEqual({
      newCards: 3,
      band: 'low',
    });
  });

  it('falls back to the defaults for a value that is not a settings object', () => {
    for (const value of [null, [], 'five', 42]) {
      expect(readSessionSettings(stored(value)), JSON.stringify(value)).toEqual(
        DEFAULT_SESSION_SETTINGS,
      );
    }
  });

  it('survives a storage that throws', () => {
    const broken: SessionStorage = {
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

    expect(readSessionSettings(broken)).toEqual(DEFAULT_SESSION_SETTINGS);
    expect(() => saveSessionSettings({ newCards: 3, band: 'high' }, broken)).not.toThrow();
  });
});
