import type { GambitDatabase, StoredGame } from '../../db/db';
import type { PlayState } from './game';

export interface GameMeta {
  level: number;
  controlMs: number;
  incrementMs: number;
  startedAt: number;
  endedAt: number;
}

/** Turns a finished game into the row the database keeps; an unfinished one has no result yet. */
export function gameRecord(state: PlayState, meta: GameMeta): StoredGame {
  if (state.result === null) throw new Error('A game is stored only once it is over');

  return {
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    level: meta.level,
    userColor: state.userColor,
    controlMs: meta.controlMs,
    incrementMs: meta.incrementMs,
    moves: [...state.moves],
    result: state.result,
    assisted: state.assisted,
  };
}

export async function saveGame(database: GambitDatabase, game: StoredGame): Promise<number> {
  const id = await database.games.add(game);
  if (typeof id !== 'number') throw new Error('The database did not return an id');
  return id;
}
