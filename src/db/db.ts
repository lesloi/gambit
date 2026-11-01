import Dexie, { type EntityTable, type Table } from 'dexie';
import type { GameResult } from '../lib/position';
import type { ReviewEntry } from './fsrs';
import { SCHEDULER } from './fsrs';

export interface Review extends ReviewEntry {
  /** Autoincrement key: the journal reads in the order it was written. */
  id?: number;
}

/**
 * A finished game, kept as its moves from the initial position rather than as a PGN string, so the
 * analysis can replay it and the backup can copy it as JSON. See docs/DECISIONS.md#persistence.
 */
export interface StoredGame {
  id?: number;
  startedAt: number;
  endedAt: number;
  /** The approximate Elo of the level the engine played at. */
  level: number;
  userColor: 'white' | 'black';
  controlMs: number;
  /** Every move from the initial position, in UCI. */
  moves: string[];
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
    this.on('populate', () => this.meta.add({ key: 'scheduler', ...SCHEDULER }));
  }
}

export const database = new GambitDatabase();
