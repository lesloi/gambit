import { Rating, type Grade } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { cardId } from '../../db/cards';
import { replayCard } from '../../db/fsrs';
import type { Endgame } from '../endgames/endgame';
import type { OpeningLine } from '../openings/opening';
import type { Puzzle } from '../puzzles/puzzle';
import { cellId, sessionCatalog } from './catalog';
import { pinnedJournal, type JournalReview } from './cells';

const START = Date.UTC(2026, 0, 1, 9, 0, 0);
const MINUTE = 60_000;
const DAY = 86_400_000;

function puzzle(id: string, themes: string[], rating: number): Puzzle {
  return {
    id,
    fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    solution: ['a1a2'],
    themes,
    rating,
    fullLine: true,
  };
}

const endgame: Endgame = {
  id: 'kqk',
  name: 'Dame contre roi',
  fen: '8/8/8/4k3/8/8/5K2/6Q1 w - - 0 1',
  result: 'win',
  goal: 'Mater.',
};

const opening: OpeningLine = {
  id: 'london',
  name: 'London',
  color: 'white',
  moves: ['d2d4', 'd7d5'],
};

const puzzles = [puzzle('a', ['fork'], 900), puzzle('b', ['fork'], 950), puzzle('c', ['pin'], 900)];
const catalog = sessionCatalog(puzzles, [endgame], [opening]);

function review(id: number, card: string, rating: Grade, reviewedAt: number): JournalReview {
  return { id, cardId: card, rating, reviewedAt };
}

describe('pinnedJournal', () => {
  it('replays every attempt of the cell as one card, across its puzzles', () => {
    // Two puzzles of the same motif, with interleaved attempts: the cell is one schedulable unit.
    const reviews = [
      review(1, cardId('puzzle', 'a'), Rating.Good, START),
      review(2, cardId('puzzle', 'b'), Rating.Again, START + MINUTE),
      review(3, cardId('puzzle', 'a'), Rating.Good, START + 2 * MINUTE),
    ];

    const journal = pinnedJournal(reviews, catalog, 3);
    const expected = replayCard(reviews);

    expect(journal.cells.get(cellId('fork', 'low'))).toMatchObject({
      cardId: cellId('fork', 'low'),
      due: expected?.due,
      reviews: 3,
    });
  });

  it('puts the endgame and opening reviews in their own cards', () => {
    const reviews = [
      review(1, cardId('endgame', 'kqk'), Rating.Good, START),
      review(2, cardId('opening', 'london'), Rating.Again, START),
    ];

    const journal = pinnedJournal(reviews, catalog, 2);

    expect(journal.cards.get(cardId('endgame', 'kqk'))?.cardId).toBe('endgame:kqk');
    expect(journal.cards.get(cardId('opening', 'london'))?.cardId).toBe('opening:london');
    expect(journal.cells.size).toBe(0);
  });

  it('ignores the reviews written after the pin', () => {
    const reviews = [
      review(1, cardId('puzzle', 'a'), Rating.Good, START),
      review(2, cardId('puzzle', 'a'), Rating.Good, START + DAY),
    ];

    const journal = pinnedJournal(reviews, catalog, 1);

    expect(journal.cells.get(cellId('fork', 'low'))?.reviews).toBe(1);
    expect(journal.seenPuzzles.has('a')).toBe(true);
    expect(journal.seenPuzzles.has('b')).toBe(false);
  });

  it('knows a reviewed puzzle the archive no longer holds', () => {
    const reviews = [review(1, cardId('puzzle', 'gone'), Rating.Good, START)];

    const journal = pinnedJournal(reviews, catalog, 1);

    expect(journal.seenPuzzles.has('gone')).toBe(true);
    expect(journal.cells.size).toBe(0);
  });
});
