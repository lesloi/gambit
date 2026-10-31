import { Rating, type Grade } from 'ts-fsrs';
import { cardId } from '../../db/cards';
import { database } from '../../db/db';
import { appendReview, type NewReview } from '../../db/journal';
import type { OpeningOutcome } from './opening';

/** The journal entry of a line attempt: a line is one card, whatever the road through it. */
export function openingReview(lineId: string, rating: Grade, reviewedAt: number): NewReview {
  return { cardId: cardId('opening', lineId), rating, reviewedAt };
}

/**
 * A move outside the repertoire is a miss, recorded without asking. A completed line waits for the
 * user's rating, like a puzzle: the outcome says what happened, not how hard it felt.
 */
export function missedOpeningRating(before: OpeningOutcome, after: OpeningOutcome): Grade | null {
  if (before !== 'playing') return null;
  return after === 'failed' ? Rating.Again : null;
}

/** Appends a line attempt's rating to the journal, stamped now. */
export function recordOpeningReview(lineId: string, rating: Grade): Promise<number> {
  return appendReview(database, openingReview(lineId, rating, Date.now()));
}
