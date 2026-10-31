import Dexie, { type EntityTable, type Table } from 'dexie';
import type { ReviewEntry } from './fsrs';
import { SCHEDULER } from './fsrs';

export interface Review extends ReviewEntry {
  /** Autoincrement key: the journal reads in the order it was written. */
  id?: number;
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
  meta!: Table<SchedulerRecord, string>;

  constructor(name = 'gambit') {
    super(name);
    // A new version gets its own version(n).stores(), plus an upgrade where the old data needs it.
    this.version(1).stores({
      reviews: '++id, cardId, reviewedAt',
      meta: 'key',
    });
    this.on('populate', () => this.meta.add({ key: 'scheduler', ...SCHEDULER }));
  }
}

export const database = new GambitDatabase();
