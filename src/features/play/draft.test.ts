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
import { playUci, START_FEN, startGame, type PlayState } from './game';

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

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const draft = (): PlayDraft => ({
  startedAt: START,
  level: 1500,
  controlMs: TEN_MINUTES,
  incrementMs: 10_000,
  startFen: START_FEN,
  clocked: true,
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

  it('keeps the position and the clock choice of the game', () => {
    const state = playUci(startGame('black', AFTER_E4, false), 'e7e5');

    const saved = draftFromGame(
      { state, clock: createClock(0, 0), startedAt: START, level: 1500 },
      T0,
    );

    expect(saved).toMatchObject({
      startFen: AFTER_E4,
      clocked: false,
      userColor: 'black',
      moves: ['e7e5'],
      clock: { whiteMs: 0, blackMs: 0, running: null },
    });
  });

  it('keeps a game from a position before its first move', () => {
    const state = startGame('black', AFTER_E4, false);

    const saved = draftFromGame(
      { state, clock: createClock(0, 0), startedAt: START, level: 1500 },
      T0,
    );

    expect(saved).toMatchObject({
      startFen: AFTER_E4,
      clocked: false,
      userColor: 'black',
      moves: [],
      clock: { whiteMs: 0, blackMs: 0, running: null },
    });
  });

  it('keeps a timed game from a position before its first move', () => {
    const state = startGame('black', AFTER_E4);

    const saved = draftFromGame(
      { state, clock: createClock(TEN_MINUTES, 10_000), startedAt: START, level: 1500 },
      T0,
    );

    expect(saved).toMatchObject({
      startFen: AFTER_E4,
      clocked: true,
      userColor: 'black',
      moves: [],
      clock: { whiteMs: TEN_MINUTES, blackMs: TEN_MINUTES, running: null },
    });
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

  it('resumes a game from the position it started from', () => {
    const saved = {
      ...draft(),
      startFen: AFTER_E4,
      userColor: 'black' as const,
      moves: ['e7e5'],
      clock: { whiteMs: 600_000, blackMs: 600_000, running: 'white' as const },
    };
    const storage = memoryStorage();
    saveDraft(saved, storage);

    const read = readDraft(storage);
    const state = read === null ? null : resumeGame(read);

    expect(read?.startFen).toBe(AFTER_E4);
    expect(state?.fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(state?.startFen).toBe(AFTER_E4);
  });

  it('resumes a game from a position before its first move', () => {
    const saved = {
      ...draft(),
      startFen: AFTER_E4,
      clocked: false,
      userColor: 'black' as const,
      moves: [],
      clock: { whiteMs: 0, blackMs: 0, running: null },
    };
    const storage = memoryStorage();
    saveDraft(saved, storage);

    const read = readDraft(storage);
    const state = read === null ? null : resumeGame(read);

    expect(read).toMatchObject({ startFen: AFTER_E4, clocked: false, moves: [] });
    expect(state?.startFen).toBe(AFTER_E4);
    expect(state?.moves).toEqual([]);
    expect(state?.outcome).toBe('playing');
  });

  it('resumes a timed game from a position before its first move', () => {
    const saved = {
      ...draft(),
      startFen: AFTER_E4,
      userColor: 'black' as const,
      moves: [],
      clock: { whiteMs: 600_000, blackMs: 600_000, running: null },
    };
    const storage = memoryStorage();
    saveDraft(saved, storage);

    const read = readDraft(storage);

    expect(read).toMatchObject({ startFen: AFTER_E4, clocked: true, moves: [] });
    expect(read?.clock.running).toBeNull();
  });

  it('resumes an untimed game', () => {
    const saved = {
      ...draft(),
      startFen: AFTER_E4,
      clocked: false,
      userColor: 'black' as const,
      moves: ['e7e5'],
      clock: { whiteMs: 0, blackMs: 0, running: null },
    };
    const storage = memoryStorage();
    saveDraft(saved, storage);

    const read = readDraft(storage);
    const state = read === null ? null : resumeGame(read);

    expect(read).toMatchObject({ startFen: AFTER_E4, clocked: false });
    expect(state?.clocked).toBe(false);
  });

  it('reads a draft stored before the start position with the standard one', () => {
    const old: Record<string, unknown> = { ...draft() };
    delete old.startFen;
    delete old.clocked;

    const read = readDraft(stored(old));

    expect(read).toMatchObject({ startFen: START_FEN, clocked: true });
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
      { ...draft(), startFen: 'not-a-fen' },
      { ...draft(), startFen: 42 },
      { ...draft(), clocked: 'yes' },
      { ...draft(), clocked: false, clock: { ...draft().clock, running: 'white' } },
      { ...draft(), clocked: false, clock: { ...draft().clock, running: null } },
      {
        ...draft(),
        startFen: AFTER_E4,
        clocked: false,
        moves: [],
        clock: { ...draft().clock, running: null },
      },
      {
        ...draft(),
        startFen: AFTER_E4,
        moves: [],
        clock: { whiteMs: 600_000, blackMs: 595_000, running: null },
      },
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
