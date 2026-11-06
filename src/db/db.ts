import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Opponent } from '../engine/uci';
import type { GameResult } from '../lib/position';
import type { ReviewEntry } from './fsrs';
import { SCHEDULER } from './fsrs';

export interface Review extends ReviewEntry {
  /** Autoincrement key: the journal reads in the order it was written. */
  id?: number;
}

/**
 * A finished game, kept as its moves from the initial position rather than as a PGN string, so the
 * analysis can replay it. See docs/DECISIONS.md#persistence.
 */
export interface StoredGame {
  id?: number;
  startedAt: number;
  endedAt: number;
  /** The approximate Elo of the level the engine played at. */
  level: number;
  /** Which engine played the other side: a Stockfish game and a Maia game do not compare. */
  engine: Opponent;
  userColor: 'white' | 'black';
  controlMs: number;
  /** The increment added after each move, in milliseconds. */
  incrementMs: number;
  /** Every move from the initial position, in UCI. */
  moves: string[];
  /**
   * The result of the game. Rows written before the FIDE draw limits can still hold the former
   * `'threefold'` and `'fifty-move'` reasons; a reader must map them.
   */
  result: GameResult;
  /** A hint was shown, so a later blunder list can skip the game. */
  assisted: boolean;
}

/** The scheduler that derived this journal, kept so a later version can tell what it inherits. */
export interface SchedulerRecord {
  key: 'scheduler';
  library: string;
  model: string;
  parameters: typeof SCHEDULER.parameters;
}

export class GambitDatabase extends Dexie {
  reviews!: EntityTable<Review, 'id'>;
  games!: EntityTable<StoredGame, 'id'>;
  meta!: Table<SchedulerRecord, string>;

  constructor(name = 'gambit') {
    super(name);
    // A new version gets its own version(n).stores(), plus an upgrade where the old data needs it.
    this.version(1).stores({
      reviews: '++id, cardId, reviewedAt',
      meta: 'key',
    });
    this.version(2).stores({
      reviews: '++id, cardId, reviewedAt',
      games: '++id, startedAt',
      meta: 'key',
    });
    // A game recorded at the fixed 10+0 control had no increment, which is what the field holds.
    this.version(3)
      .stores({
        reviews: '++id, cardId, reviewedAt',
        games: '++id, startedAt',
        meta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table('games')
          .toCollection()
          .modify((game) => {
            game.incrementMs ??= 0;
          }),
      );
    // Games recorded before Maia existed were all played against Stockfish.
    this.version(4)
      .stores({
        reviews: '++id, cardId, reviewedAt',
        games: '++id, startedAt',
        meta: 'key',
      })
      .upgrade((transaction) =>
        transaction
          .table('games')
          .toCollection()
          .modify((game) => {
            game.engine ??= 'stockfish';
          }),
      );
    this.on('populate', () => this.meta.add({ key: 'scheduler', ...SCHEDULER }));
  }
}

export const database = new GambitDatabase();
