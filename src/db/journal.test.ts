import 'fake-indexeddb/auto';
import { Rating, type Grade } from 'ts-fsrs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GambitDatabase } from './db';
import { SCHEDULER, replayCard } from './fsrs';
import { appendReview, cardState, cardStates, dueCards } from './journal';

const MINUTE = 60_000;
const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1, 9, 0, 0);

let database: GambitDatabase;

beforeEach(() => {
  database = new GambitDatabase(`gambit-test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await database.delete();
});

describe('appendReview', () => {
  it('keeps every review, and never rewrites an earlier one', async () => {
    const first = await appendReview(database, {
      cardId: 'puzzle:demo',
      rating: Rating.Good,
      reviewedAt: START,
    });
    const second = await appendReview(database, {
      cardId: 'puzzle:demo',
      rating: Rating.Again,
      reviewedAt: START + MINUTE,
    });

    expect(await database.reviews.count()).toBe(2);
    expect(await database.reviews.get(first)).toMatchObject({
      cardId: 'puzzle:demo',
      rating: Rating.Good,
      reviewedAt: START,
    });
    expect(second).toBeGreaterThan(first);
  });

  it('refuses a rating the scheduler does not know', async () => {
    await expect(
      appendReview(database, { cardId: 'puzzle:demo', rating: 0 as Grade, reviewedAt: START }),
    ).rejects.toThrow(RangeError);
  });
});

describe('cardState', () => {
  it('derives the due date from the journal', async () => {
    await appendReview(database, {
      cardId: 'puzzle:demo',
      rating: Rating.Good,
      reviewedAt: START,
    });

    expect(await cardState(database, 'puzzle:demo')).toMatchObject({
      cardId: 'puzzle:demo',
      due: START + 10 * MINUTE,
      reviews: 1,
    });
  });

  it('replays the journal in the order it was written, when the clock goes back', async () => {
    await appendReview(database, {
      cardId: 'puzzle:demo',
      rating: Rating.Good,
      reviewedAt: START,
    });
    await appendReview(database, {
      cardId: 'puzzle:demo',
      rating: Rating.Good,
      reviewedAt: START - MINUTE,
    });

    expect(await cardState(database, 'puzzle:demo')).toEqual(
      replayCard([
        { cardId: 'puzzle:demo', rating: Rating.Good, reviewedAt: START },
        { cardId: 'puzzle:demo', rating: Rating.Good, reviewedAt: START },
      ]),
    );
  });

  it('has no state for a card the journal does not know', async () => {
    expect(await cardState(database, 'puzzle:missing')).toBeNull();
  });
});

describe('cardStates', () => {
  it('returns the state of every card the journal knows, keyed by card id', async () => {
    await appendReview(database, {
      cardId: 'puzzle:a',
      rating: Rating.Good,
      reviewedAt: START,
    });
    await appendReview(database, {
      cardId: 'opening:b',
      rating: Rating.Again,
      reviewedAt: START,
    });

    const states = await cardStates(database);

    expect([...states.keys()]).toEqual(['puzzle:a', 'opening:b']);
    expect(states.get('puzzle:a')).toMatchObject({ cardId: 'puzzle:a', reviews: 1 });
    expect(states.get('opening:b')).toMatchObject({ cardId: 'opening:b', reviews: 1 });
  });

  it('has no state on an empty journal', async () => {
    expect((await cardStates(database)).size).toBe(0);
  });
});

describe('dueCards', () => {
  it('has nothing due on an empty journal', async () => {
    expect(await dueCards(database, START)).toEqual([]);
  });

  it('holds a card back until its due date, then gives it back', async () => {
    await appendReview(database, {
      cardId: 'puzzle:demo',
      rating: Rating.Good,
      reviewedAt: START,
    });

    expect(await dueCards(database, START + 9 * MINUTE)).toEqual([]);
    expect(await dueCards(database, START + 10 * MINUTE)).toMatchObject([
      { cardId: 'puzzle:demo', due: START + 10 * MINUTE },
    ]);
  });

  it('schedules each card on its own journal', async () => {
    await appendReview(database, {
      cardId: 'puzzle:a',
      rating: Rating.Good,
      reviewedAt: START,
    });
    await appendReview(database, {
      cardId: 'puzzle:b',
      rating: Rating.Again,
      reviewedAt: START,
    });

    const early = await dueCards(database, START + 5 * MINUTE);
    expect(early.map((card) => card.cardId)).toEqual(['puzzle:b']);

    const both = await dueCards(database, START + 10 * MINUTE);
    expect(both.map((card) => card.cardId)).toEqual(['puzzle:b', 'puzzle:a']);
  });

  it('groups an interleaved journal by card', async () => {
    for (const [cardId, rating, reviewedAt] of [
      ['puzzle:a', Rating.Again, START],
      ['puzzle:b', Rating.Good, START],
      ['puzzle:a', Rating.Good, START + MINUTE],
      ['puzzle:b', Rating.Good, START + 10 * MINUTE],
    ] as const) {
      await appendReview(database, { cardId, rating, reviewedAt });
    }

    const due = await dueCards(database, START + 2 * DAY + 10 * MINUTE);

    expect(due.map((card) => [card.cardId, card.reviews])).toEqual([
      ['puzzle:a', 2],
      ['puzzle:b', 2],
    ]);
  });
});

describe('the database', () => {
  it('reopens with its journal and its schema version', async () => {
    const name = database.name;
    await appendReview(database, {
      cardId: 'puzzle:demo',
      rating: Rating.Good,
      reviewedAt: START,
    });
    database.close();

    const reopened = new GambitDatabase(name);
    try {
      expect(reopened.verno).toBe(1);
      expect(await reopened.reviews.count()).toBe(1);
      expect(await reopened.meta.get('scheduler')).toEqual({ key: 'scheduler', ...SCHEDULER });
    } finally {
      reopened.close();
    }
  });

  it('records the scheduler that derived the journal', async () => {
    await appendReview(database, {
      cardId: 'puzzle:demo',
      rating: Rating.Good,
      reviewedAt: START,
    });

    expect(await database.meta.get('scheduler')).toEqual({
      key: 'scheduler',
      ...SCHEDULER,
    });
  });
});
