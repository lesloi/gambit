import 'fake-indexeddb/auto';
import { Rating } from 'ts-fsrs';
import { afterAll, describe, expect, it } from 'vitest';
import { database } from '../../db/db';
import { cardState } from '../../db/journal';
import { missedAttemptRating, puzzleReview, recordPuzzleReview } from './record';

afterAll(async () => {
  await database.delete();
});

describe('puzzleReview', () => {
  it('names the card after the puzzle, so every attempt lands on one card', () => {
    expect(puzzleReview('005gP', Rating.Good, 1_767_258_000_000)).toEqual({
      cardId: 'puzzle:005gP',
      rating: Rating.Good,
      reviewedAt: 1_767_258_000_000,
    });
  });
});

describe('missedAttemptRating', () => {
  it.each([
    ['playing', 'failed', Rating.Again],
    ['playing', 'revealed', Rating.Again],
    ['playing', 'solved', null],
    ['playing', 'playing', null],
    ['failed', 'revealed', null],
    ['revealed', 'revealed', null],
  ] as const)('rates a %s attempt that becomes %s as %s', (before, after, rating) => {
    expect(missedAttemptRating(before, after)).toBe(rating);
  });
});

describe('recordPuzzleReview', () => {
  it('writes the rating into the journal of the app', async () => {
    const before = Date.now();

    await recordPuzzleReview('005gP', Rating.Good);

    const card = await cardState(database, 'puzzle:005gP');
    expect(card).toMatchObject({ cardId: 'puzzle:005gP', reviews: 1 });
    expect(card?.lastReview).toBeGreaterThanOrEqual(before);
  });
});
