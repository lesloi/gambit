import 'fake-indexeddb/auto';
import { Rating } from 'ts-fsrs';
import { afterAll, describe, expect, it } from 'vitest';
import { database } from '../../db/db';
import { cardState } from '../../db/journal';
import { missedEndgameRating, recordEndgameReview } from './record';
import { endgameReview } from './record';

afterAll(async () => {
  await database.delete();
});

describe('endgameReview', () => {
  it('names the card after the endgame, so every attempt lands on one card', () => {
    expect(endgameReview('kqk', Rating.Good, 1_767_258_000_000)).toEqual({
      cardId: 'endgame:kqk',
      rating: Rating.Good,
      reviewedAt: 1_767_258_000_000,
    });
  });
});

describe('missedEndgameRating', () => {
  it.each([
    ['playing', 'failed', Rating.Again],
    ['playing', 'solved', null],
    ['playing', 'playing', null],
    ['failed', 'failed', null],
  ] as const)('rates a %s endgame that becomes %s as %s', (before, after, rating) => {
    expect(missedEndgameRating(before, after)).toBe(rating);
  });
});

describe('recordEndgameReview', () => {
  it('writes the rating into the journal of the app', async () => {
    const before = Date.now();

    await recordEndgameReview('kqk', Rating.Good);

    const card = await cardState(database, 'endgame:kqk');
    expect(card).toMatchObject({ cardId: 'endgame:kqk', reviews: 1 });
    expect(card?.lastReview).toBeGreaterThanOrEqual(before);
  });
});
