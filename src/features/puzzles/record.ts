import { Rating as FsrsRating, type Grade } from 'ts-fsrs';
import { cardId } from '../../db/cards';
import { database } from '../../db/db';
import { appendReview, type NewReview } from '../../db/journal';
import type { PuzzleOutcome } from './puzzle';

/** The journal entry of a puzzle attempt: a puzzle is one card, whatever its themes. */
export function puzzleReview(puzzleId: string, rating: Grade, reviewedAt: number): NewReview {
  return { cardId: cardId('puzzle', puzzleId), rating, reviewedAt };
}

/**
 * The rating of an attempt the user did not solve: failing and giving up are two ways of missing
 * it. It is null for an attempt that already left `playing` or that ended solved, so a failed
 * attempt followed by its solution counts once, and a solve waits for the user's own rating.
 */
export function missedAttemptRating(before: PuzzleOutcome, after: PuzzleOutcome): Grade | null {
  if (before !== 'playing') return null;
  return after === 'failed' || after === 'revealed' ? FsrsRating.Again : null;
}

/** Appends a puzzle attempt's rating to the journal, stamped now. */
export function recordPuzzleReview(puzzleId: string, rating: Grade): Promise<number> {
  return appendReview(database, puzzleReview(puzzleId, rating, Date.now()));
}
