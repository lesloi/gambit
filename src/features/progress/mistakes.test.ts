import { Rating, type Grade } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { puzzleMistakes, type JournalReview } from './mistakes';

const START = Date.UTC(2026, 0, 1, 9, 0, 0);
const MINUTE = 60_000;

/** Every puzzle of the archive, unless a test names the ones it drops. */
function archive(...ids: string[]): ReadonlySet<string> {
  return new Set(ids);
}

function review(id: number, cardId: string, rating: Grade, reviewedAt: number): JournalReview {
  return { id, cardId, rating, reviewedAt };
}

describe('puzzleMistakes', () => {
  it('keeps the missed attempts of puzzles, and nothing else', () => {
    const reviews = [
      review(1, 'puzzle:a', Rating.Again, START),
      review(2, 'puzzle:b', Rating.Good, START + MINUTE),
      review(3, 'opening:c', Rating.Again, START + 2 * MINUTE),
      review(4, 'endgame:d', Rating.Again, START + 3 * MINUTE),
      review(5, 'game:e', Rating.Again, START + 4 * MINUTE),
    ];

    expect(puzzleMistakes(reviews, archive('a', 'b', 'c', 'd', 'e'))).toEqual([
      { puzzleId: 'a', reviewedAt: START },
    ]);
  });

  it('lists the most recent miss first', () => {
    const reviews = [
      review(1, 'puzzle:a', Rating.Again, START),
      review(2, 'puzzle:b', Rating.Again, START + 2 * MINUTE),
      review(3, 'puzzle:c', Rating.Again, START + MINUTE),
    ];

    expect(puzzleMistakes(reviews, archive('a', 'b', 'c'))).toEqual([
      { puzzleId: 'b', reviewedAt: START + 2 * MINUTE },
      { puzzleId: 'c', reviewedAt: START + MINUTE },
      { puzzleId: 'a', reviewedAt: START },
    ]);
  });

  it('keeps one row per puzzle, dated by its latest miss', () => {
    const reviews = [
      review(1, 'puzzle:a', Rating.Again, START),
      review(2, 'puzzle:a', Rating.Again, START + 5 * MINUTE),
      review(3, 'puzzle:b', Rating.Again, START + MINUTE),
    ];

    expect(puzzleMistakes(reviews, archive('a', 'b'))).toEqual([
      { puzzleId: 'a', reviewedAt: START + 5 * MINUTE },
      { puzzleId: 'b', reviewedAt: START + MINUTE },
    ]);
  });

  it('breaks a tie by the order the journal recorded', () => {
    const reviews = [
      review(1, 'puzzle:a', Rating.Again, START),
      review(2, 'puzzle:b', Rating.Again, START),
    ];

    expect(puzzleMistakes(reviews, archive('a', 'b')).map((mistake) => mistake.puzzleId)).toEqual([
      'b',
      'a',
    ]);
  });

  it('drops a puzzle the archive no longer holds, without taking its slot', () => {
    const reviews = [
      review(1, 'puzzle:gone', Rating.Again, START + 3 * MINUTE),
      review(2, 'puzzle:a', Rating.Again, START + 2 * MINUTE),
      review(3, 'puzzle:b', Rating.Again, START + MINUTE),
    ];

    expect(puzzleMistakes(reviews, archive('a', 'b'), 2)).toEqual([
      { puzzleId: 'a', reviewedAt: START + 2 * MINUTE },
      { puzzleId: 'b', reviewedAt: START + MINUTE },
    ]);
  });

  it('caps the list at the latest twenty misses by default', () => {
    const reviews = Array.from({ length: 25 }, (_, index) =>
      review(index + 1, `puzzle:${index}`, Rating.Again, START + index * MINUTE),
    );

    const mistakes = puzzleMistakes(
      reviews,
      archive(...reviews.map((entry) => entry.cardId.slice(7))),
    );

    expect(mistakes).toHaveLength(20);
    expect(mistakes[0]).toEqual({ puzzleId: '24', reviewedAt: START + 24 * MINUTE });
    expect(mistakes.at(-1)).toEqual({ puzzleId: '5', reviewedAt: START + 5 * MINUTE });
  });

  it('has nothing to show for an empty journal', () => {
    expect(puzzleMistakes([], archive())).toEqual([]);
  });
});
