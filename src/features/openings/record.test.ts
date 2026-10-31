import 'fake-indexeddb/auto';
import { Rating } from 'ts-fsrs';
import { afterAll, describe, expect, it } from 'vitest';
import { database } from '../../db/db';
import { cardState } from '../../db/journal';
import { missedOpeningRating, openingReview, recordOpeningReview } from './record';

afterAll(async () => {
  await database.delete();
});

describe('openingReview', () => {
  it('names the card after the line, so every attempt lands on one card', () => {
    expect(openingReview('london-vs-d5', Rating.Good, 1_767_258_000_000)).toEqual({
      cardId: 'opening:london-vs-d5',
      rating: Rating.Good,
      reviewedAt: 1_767_258_000_000,
    });
  });
});

describe('missedOpeningRating', () => {
  it.each([
    ['playing', 'failed', Rating.Again],
    ['playing', 'solved', null],
    ['playing', 'playing', null],
    ['failed', 'failed', null],
    ['solved', 'solved', null],
  ] as const)('rates a %s line that becomes %s as %s', (before, after, rating) => {
    expect(missedOpeningRating(before, after)).toBe(rating);
  });
});

describe('recordOpeningReview', () => {
  it('writes the rating into the journal of the app', async () => {
    const before = Date.now();

    await recordOpeningReview('london-vs-d5', Rating.Good);

    const card = await cardState(database, 'opening:london-vs-d5');
    expect(card).toMatchObject({ cardId: 'opening:london-vs-d5', reviews: 1 });
    expect(card?.lastReview).toBeGreaterThanOrEqual(before);
  });
});
