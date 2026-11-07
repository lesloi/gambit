import { readFileSync } from 'node:fs';
import { Rating, State, type Grade } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { SCHEDULER, replayCard, type ReviewEntry } from './fsrs';

const MANIFEST = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { dependencies: Record<string, string> };

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

  // A golden literal on purpose: a snapshot would bless a drift instead of catching it. This
  // journal runs a card into a stable long interval, where a change of the weights or the decay
  // shows up long before the first cards would notice. The literals were derived on 5.4.2 and
  // replayed unchanged on 6.0.0, which is what makes the bump a no-op for the schedule.
  it('keeps the due dates a journal produced under ts-fsrs 5.4.2, still the same on 6.0.0', () => {
    const ratings = [
      Rating.Good,
      Rating.Good,
      Rating.Hard,
      Rating.Good,
      Rating.Again,
      Rating.Good,
      Rating.Good,
      Rating.Easy,
      Rating.Good,
      Rating.Good,
      Rating.Hard,
      Rating.Good,
    ];
    // Days elapsed since the previous review: the short steps, then growing intervals.
    const days = [0, 1, 10, 10, 10, 24 * 10, 24 * 4, 24 * 7, 24 * 20, 24 * 30, 24 * 45, 24 * 70];
    let elapsed = 0;
    const reviews = ratings.map((rating, index) => {
      elapsed += days[index]! * DAY;
      return review(rating, START + elapsed);
    });

    const card = replayCard(reviews);

    expect(card).toEqual({
      cardId: 'puzzle:demo',
      due: 2324365200000,
      lastReview: 2155626000000,
      state: State.Review,
      // The dates and the count are exact; the memory values allow for the last ulp of libm.
      stability: expect.closeTo(1952.6628124, 6),
      difficulty: expect.closeTo(8.37803987, 6),
      reviews: 12,
    });
  });
});

describe('SCHEDULER.library', () => {
  // The pin names the build that writes the journal, so a bump must change it on purpose: the
  // test turns Dependabot's silent update into a decision. package.json pins the exact version
  // for this reason; a range would make the marker describe a range, not a build.
  it('names the ts-fsrs build package.json installs', () => {
    expect(SCHEDULER.library).toBe(`ts-fsrs@${MANIFEST.dependencies['ts-fsrs']}`);
  });
});
