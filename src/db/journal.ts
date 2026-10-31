import { Grades, type Grade } from 'ts-fsrs';
import type { GambitDatabase } from './db';
import { replayCard, type CardState, type ReviewEntry } from './fsrs';

export interface NewReview {
  cardId: string;
  rating: Grade;
  /** Epoch milliseconds. */
  reviewedAt: number;
}

/**
 * Adds one review to the journal. The journal is append-only: this is the sole write, and it
 * never touches an earlier entry. See docs/DECISIONS.md#persistence.
 */
export async function appendReview(database: GambitDatabase, review: NewReview): Promise<number> {
  if (!Grades.includes(review.rating)) {
    throw new RangeError(`Unknown rating ${review.rating}`);
  }
  const id = await database.reviews.add({
    cardId: review.cardId,
    rating: review.rating,
    reviewedAt: review.reviewedAt,
  });
  // Dexie types an autoincrement key as possibly absent after add; it is the key the journal now has.
  if (typeof id !== 'number') throw new Error('The journal did not return an id');
  return id;
}

export async function cardState(
  database: GambitDatabase,
  cardId: string,
): Promise<CardState | null> {
  const reviews = await database.reviews.where('cardId').equals(cardId).toArray();
  return replayCard(reviews);
}

/** Every card whose journal puts it at or before `now`, the most urgent first. */
export async function dueCards(database: GambitDatabase, now = Date.now()): Promise<CardState[]> {
  const reviews = await database.reviews.toArray();

  const byCard = new Map<string, ReviewEntry[]>();
  for (const review of reviews) {
    const list = byCard.get(review.cardId);
    if (list) list.push(review);
    else byCard.set(review.cardId, [review]);
  }

  return [...byCard.values()]
    .map((list) => replayCard(list))
    .filter((card): card is CardState => card !== null && card.due <= now)
    .sort((a, b) => a.due - b.due || a.cardId.localeCompare(b.cardId));
}

export function countReviews(database: GambitDatabase): Promise<number> {
  return database.reviews.count();
}
