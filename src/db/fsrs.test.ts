import { Rating, State, type Grade } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { replayCard, type ReviewEntry } from './fsrs';

const MINUTE = 60_000;
const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1, 9, 0, 0);

function review(rating: Grade, reviewedAt: number): ReviewEntry {
  return { cardId: 'puzzle:demo', rating, reviewedAt };
}

describe('replayCard', () => {
  it('derives the state and the due date from a sequence of ratings', () => {
    const reviews = [
      review(Rating.Good, START),
      review(Rating.Good, START + 10 * MINUTE),
      review(Rating.Again, START + 3 * DAY),
      review(Rating.Good, START + 3 * DAY + 10 * MINUTE),
    ];

    const card = replayCard(reviews);

    expect(card).toEqual({
      cardId: 'puzzle:demo',
      due: START + 4 * DAY + 10 * MINUTE,
      lastReview: START + 3 * DAY + 10 * MINUTE,
      state: State.Review,
      stability: expect.closeTo(0.689, 3),
      difficulty: expect.closeTo(7.38, 2),
      reviews: 4,
    });
  });

  it('has no card before the first review', () => {
    expect(replayCard([])).toBeNull();
  });

  it('treats a review stamped before the previous one as no elapsed time', () => {
    const inTime = replayCard([review(Rating.Good, START), review(Rating.Good, START)]);
    const clockRollback = replayCard([
      review(Rating.Good, START),
      review(Rating.Good, START - DAY),
    ]);

    expect(clockRollback).toEqual(inTime);
    expect(Number.isFinite(clockRollback?.due)).toBe(true);
  });
});
