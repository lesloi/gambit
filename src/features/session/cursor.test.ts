import { describe, expect, it } from 'vitest';
import {
  advanceCursor,
  clearSession,
  readSession,
  resumeCursor,
  saveSession,
  SESSION_STORAGE_KEY,
  type SessionCursor,
} from './cursor';
import type { SessionStorage } from './storage';

const START = Date.UTC(2026, 0, 1, 9, 0, 0);
const MINUTE = 60_000;

const cursor: SessionCursor = {
  startedAt: START,
  lastEntryId: 3,
  position: 1,
  newCount: 5,
  band: 'low',
  total: 8,
  dueCount: 3,
  completedAt: null,
};

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
  memoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify(value) });

describe('the session cursor', () => {
  it('reads back the cursor it saved', () => {
    const storage = memoryStorage();

    saveSession(cursor, storage);

    expect(readSession(storage)).toEqual(cursor);
  });

  it('has no session without a stored cursor', () => {
    expect(readSession(memoryStorage())).toBeNull();
  });

  it('refuses anything that is not a cursor', () => {
    for (const value of [
      null,
      [],
      'session',
      42,
      {},
      { ...cursor, startedAt: 'yesterday' },
      { ...cursor, lastEntryId: -1 },
      { ...cursor, position: 1.5 },
      { ...cursor, newCount: 'five' },
      { ...cursor, band: 'expert' },
      { ...cursor, total: null },
      { ...cursor, dueCount: undefined },
      { ...cursor, completedAt: 'now' },
      { ...cursor, position: 9 },
    ]) {
      expect(readSession(stored(value)), JSON.stringify(value)).toBeNull();
    }
  });

  it('refuses a stored value that is not JSON', () => {
    expect(readSession(memoryStorage({ [SESSION_STORAGE_KEY]: '{not json' }))).toBeNull();
  });

  it('clears the session', () => {
    const storage = memoryStorage();
    saveSession(cursor, storage);

    clearSession(storage);

    expect(readSession(storage)).toBeNull();
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

    expect(readSession(broken)).toBeNull();
    expect(() => saveSession(cursor, broken)).not.toThrow();
    expect(() => clearSession(broken)).not.toThrow();
  });

  it('does nothing without a storage', () => {
    expect(readSession(null)).toBeNull();
    expect(() => saveSession(cursor, null)).not.toThrow();
    expect(() => clearSession(null)).not.toThrow();
  });
});

describe('resumeCursor', () => {
  it('takes the totals of the queue it was derived into', () => {
    const resumed = resumeCursor(cursor, { cards: [0, 1, 2], dueCount: 1 }, START + MINUTE);

    expect(resumed).toMatchObject({ position: 1, total: 3, dueCount: 1, completedAt: null });
    expect(resumed.lastEntryId).toBe(cursor.lastEntryId);
    expect(resumed.startedAt).toBe(START);
  });

  it('completes the session when a deploy shrank the queue below its position', () => {
    const ahead = { ...cursor, position: 5 };

    const resumed = resumeCursor(ahead, { cards: [0, 1], dueCount: 2 }, START + MINUTE);

    expect(resumed.position).toBe(2);
    expect(resumed.completedAt).toBe(START + MINUTE);
  });

  it('keeps a completion that was already recorded', () => {
    const completed = { ...cursor, position: 8, completedAt: START + 2 * MINUTE };

    const resumed = resumeCursor(completed, { cards: [0], dueCount: 1 }, START + MINUTE);

    expect(resumed.position).toBe(1);
    expect(resumed.completedAt).toBe(START + 2 * MINUTE);
  });
});

describe('advanceCursor', () => {
  it('moves to the next card', () => {
    expect(advanceCursor(cursor, 8, START + MINUTE)).toMatchObject({
      position: 2,
      completedAt: null,
    });
  });

  it('completes the session after the last card', () => {
    const last = { ...cursor, position: 7 };

    expect(advanceCursor(last, 8, START + MINUTE)).toMatchObject({
      position: 8,
      completedAt: START + MINUTE,
    });
  });

  it('does not move past the end of the queue', () => {
    const done = { ...cursor, position: 8, completedAt: START + MINUTE };

    expect(advanceCursor(done, 8, START + 2 * MINUTE).position).toBe(8);
  });
});
