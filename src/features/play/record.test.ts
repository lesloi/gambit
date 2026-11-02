import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import { database } from '../../db/db';
import { flagSide, playMove, showHint, startGame } from './game';
import { gameRecord, saveGame } from './record';

afterAll(async () => {
  await database.delete();
});

const meta = {
  level: 1500,
  controlMs: 600_000,
  incrementMs: 10_000,
  startedAt: 1_000,
  endedAt: 2_000,
};

describe('gameRecord', () => {
  it('stores the moves and the result of a finished game', () => {
    const state = flagSide(playMove(startGame(), 'e2', 'e4'), 'white');

    expect(gameRecord(state, meta)).toEqual({
      level: 1500,
      controlMs: 600_000,
      incrementMs: 10_000,
      userColor: 'white',
      moves: ['e2e4'],
      result: { winner: 'black', reason: 'flag' },
      assisted: false,
      startedAt: 1_000,
      endedAt: 2_000,
    });
  });

  it('keeps the assisted mark of a game that used a hint', () => {
    const state = flagSide(showHint(startGame(), 'g1f3'), 'black');

    expect(gameRecord(state, meta).assisted).toBe(true);
  });

  it('refuses a game that is still being played', () => {
    expect(() => gameRecord(startGame(), meta)).toThrow(/over/i);
  });
});

describe('saveGame', () => {
  it('writes the game to the database and reads it back', async () => {
    const record = gameRecord(flagSide(playMove(startGame(), 'd2', 'd4'), 'black'), meta);

    const id = await saveGame(database, record);

    await expect(database.games.get(id)).resolves.toEqual({ ...record, id });
  });
});
