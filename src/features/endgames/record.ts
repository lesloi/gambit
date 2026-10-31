import { Rating, type Grade } from 'ts-fsrs';
import { cardId } from '../../db/cards';
import { database } from '../../db/db';
import { appendReview, type NewReview } from '../../db/journal';
import type { EndgameOutcome } from './endgame';

/** The journal entry of an endgame attempt: an endgame is one card, whatever the road to the end. */
export function endgameReview(endgameId: string, rating: Grade, reviewedAt: number): NewReview {
  return { cardId: cardId('endgame', endgameId), rating, reviewedAt };
}

/**
 * A failed conversion is a miss, recorded without asking. A successful one waits for the user's
 * rating, like a puzzle: the outcome says what happened, not how hard it felt.
 */
export function missedEndgameRating(before: EndgameOutcome, after: EndgameOutcome): Grade | null {
  if (before !== 'playing') return null;
  return after === 'failed' ? Rating.Again : null;
}

/** Appends an endgame attempt's rating to the journal, stamped now. */
export function recordEndgameReview(endgameId: string, rating: Grade): Promise<number> {
  return appendReview(database, endgameReview(endgameId, rating, Date.now()));
}
