import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../../lib/storage';
import { afterMove, createClock } from './clock';
import {
  clearDraft,
  draftFromGame,
  PLAY_DRAFT_STORAGE_KEY,
  readDraft,
  resumeClock,
  resumeGame,
  saveDraft,
  type PlayDraft,
} from './draft';
import { playUci, startGame, type PlayState } from './game';

const START = Date.UTC(2026, 0, 1, 9, 0, 0);
const T0 = START + 10_000;
const TEN_MINUTES = 600_000;

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
  memoryStorage({ [PLAY_DRAFT_STORAGE_KEY]: JSON.stringify(value) });

const draft = (): PlayDraft => ({
  startedAt: START,
  level: 1500,
  controlMs: TEN_MINUTES,
  incrementMs: 10_000,
  userColor: 'white',
  moves: ['e2e4', 'e7e5'],
  assisted: false,
  clock: { whiteMs: 610_000, blackMs: 595_000, running: 'white' },
});

function gameAfter(...moves: string[]): PlayState {
  return moves.reduce(playUci, startGame());
}

describe('the game draft', () => {
  it('reads back the draft it saved', () => {
    const storage = memoryStorage();
    const saved = draft();

    saveDraft(saved, storage);

    expect(readDraft(storage)).toEqual(saved);
  });

  it('has no draft without a stored one', () => {
    expect(readDraft(memoryStorage())).toBeNull();
    expect(readDraft(null)).toBeNull();
  });

  it('clears the stored draft', () => {
    const storage = memoryStorage();
    saveDraft(draft(), storage);

    clearDraft(storage);

    expect(readDraft(storage)).toBeNull();
  });

  it('freezes the clock at the time left when the game is put away', () => {
    const clock = afterMove(createClock(TEN_MINUTES, 10_000), 'white', T0);

    const saved = draftFromGame(
      { state: gameAfter('e2e4'), clock, startedAt: START, level: 1500 },
      T0 + 5_000,
    );

    expect(saved?.clock).toEqual({ whiteMs: 610_000, blackMs: 595_000, running: 'black' });
  });

  it('does not keep a game that is over', () => {
    const state = gameAfter('f2f3', 'e7e5', 'g2g4', 'd8h4');

    expect(state.outcome).toBe('over');
    expect(
      draftFromGame({ state, clock: createClock(TEN_MINUTES), startedAt: START, level: 1500 }, T0),
    ).toBeNull();
  });

  it('does not keep a game without a move', () => {
    expect(
      draftFromGame(
        { state: startGame(), clock: createClock(TEN_MINUTES), startedAt: START, level: 1500 },
        T0,
      ),
    ).toBeNull();
  });

  it('resumes the position, the assisted mark and the start time', () => {
    const saved = { ...draft(), assisted: true };

    const state = resumeGame(saved);

    expect(state.moves).toEqual(['e2e4', 'e7e5']);
    expect(state.assisted).toBe(true);
    expect(state.userColor).toBe('white');
    expect(saved.startedAt).toBe(START);
  });

  it('resumes a game the user played as Black', () => {
    const saved = { ...draft(), userColor: 'black' as const };
    const storage = memoryStorage();
    saveDraft(saved, storage);

    const read = readDraft(storage);

    expect(read?.userColor).toBe('black');
    expect(read === null ? null : resumeGame(read).userColor).toBe('black');
  });

  it('keeps the time left while the app is closed', () => {
    const saved = draft();

    const clock = resumeClock(saved);

    expect(clock).toMatchObject({
      whiteMs: saved.clock.whiteMs,
      blackMs: saved.clock.blackMs,
      running: 'white',
      since: null,
    });
  });

  it('refuses a draft whose moves do not replay', () => {
    expect(readDraft(stored({ ...draft(), moves: ['e2e5'] }))).toBeNull();
    expect(readDraft(stored({ ...draft(), moves: ['e2e4', 'not-a-move'] }))).toBeNull();
  });

  it('refuses a draft of a finished game', () => {
    expect(
      readDraft(
        stored({
          ...draft(),
          moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
          clock: { ...draft().clock, running: null },
        }),
      ),
    ).toBeNull();
  });

  it('refuses a draft whose clock does not match the side to move', () => {
    expect(
      readDraft(stored({ ...draft(), clock: { ...draft().clock, running: 'black' } })),
    ).toBeNull();
  });

  it('refuses anything that is not a draft', () => {
    for (const value of [
      null,
      [],
      'draft',
      {},
      { ...draft(), startedAt: 0 },
      { ...draft(), level: Number.NaN },
      { ...draft(), controlMs: -1 },
      { ...draft(), userColor: 'red' },
      { ...draft(), moves: 'e2e4' },
      { ...draft(), moves: [] },
      { ...draft(), assisted: 'yes' },
      { ...draft(), clock: { ...draft().clock, whiteMs: -1 } },
      { ...draft(), clock: { ...draft().clock, running: 'red' } },
    ]) {
      expect(readDraft(stored(value))).toBeNull();
    }
  });

  it('ignores a stored draft it cannot parse', () => {
    expect(readDraft(memoryStorage({ [PLAY_DRAFT_STORAGE_KEY]: '{' }))).toBeNull();
  });
});
