import { Rating } from 'ts-fsrs';
import { parseCardId } from '../../db/cards';
import type { ReviewEntry } from '../../db/fsrs';

/** How many missed puzzles the list holds: enough to look back, short enough to replay. */
export const MISTAKE_LIMIT = 20;

/** A review as the journal stores it; the id orders entries written in the same millisecond. */
export interface JournalReview extends ReviewEntry {
  id?: number;
}

export interface Mistake {
  /** The puzzle to replay, without the card's mode prefix. */
  puzzleId: string;
  /** Epoch milliseconds of the most recent miss. */
  reviewedAt: number;
}

/**
 * The puzzles worth replaying, from the journal: the missed attempts of puzzles the archive still
 * holds, the most recent miss first. A puzzle appears once, dated by its latest miss, because the
 * list is a queue of boards to revisit, not a log of every attempt. A puzzle a regenerated archive
 * dropped is left out rather than served as a row that cannot open.
 */
export function puzzleMistakes(
  reviews: readonly JournalReview[],
  available: ReadonlySet<string>,
  limit = MISTAKE_LIMIT,
): Mistake[] {
  const misses = reviews
    .filter((review) => review.rating === Rating.Again)
    .sort((a, b) => b.reviewedAt - a.reviewedAt || (b.id ?? 0) - (a.id ?? 0));

  const mistakes: Mistake[] = [];
  const taken = new Set<string>();
  for (const review of misses) {
    const card = parseCardId(review.cardId);
    if (!card || card.mode !== 'puzzle') continue;
    const { contentId } = card;
    if (taken.has(contentId) || !available.has(contentId)) continue;
    taken.add(contentId);
    mistakes.push({ puzzleId: contentId, reviewedAt: review.reviewedAt });
    if (mistakes.length === limit) break;
  }
  return mistakes;
}
