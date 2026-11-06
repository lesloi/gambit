import { Grades, Rating, type Grade } from 'ts-fsrs';
import type { GambitDatabase } from './db';
import { replayCard, type CardState, type ReviewEntry } from './fsrs';

/** What an attempt can be when the user leaves it, across the modes. Each mode's own outcome union
 * is assignable here; one that grows beyond it fails at the `leavingRating` call, not in the type. */
export type AttemptOutcome = 'playing' | 'solved' | 'failed' | 'revealed';

/**
 * The review a solved attempt writes when the user leaves it: good, or hard when a hint helped, and
 * nothing when the attempt already has its review (a miss, or a line corrected after a miss). A
 * miss writes its again when it happens.
 */
export function leavingRating(
  outcome: AttemptOutcome,
  recorded: boolean,
  assisted = false,
): Grade | null {
  if (outcome !== 'solved' || recorded) return null;
  return assisted ? Rating.Hard : Rating.Good;
}

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

/** The state of every card the journal knows, keyed by card id, in one pass over the journal. */
export async function cardStates(database: GambitDatabase): Promise<Map<string, CardState>> {
  const reviews = await database.reviews.toArray();

  const byCard = new Map<string, ReviewEntry[]>();
  for (const review of reviews) {
    const list = byCard.get(review.cardId);
    if (list) list.push(review);
    else byCard.set(review.cardId, [review]);
  }

  const states = new Map<string, CardState>();
  for (const list of byCard.values()) {
    const card = replayCard(list);
    if (card) states.set(card.cardId, card);
  }
  return states;
}

/** The highest review id written so far; a session pins its journal snapshot there. */
export function journalMark(reviews: readonly { id?: number }[]): number {
  let mark = 0;
  for (const review of reviews) {
    if (typeof review.id === 'number' && review.id > mark) mark = review.id;
  }
  return mark;
}

/** Every card whose journal puts it at or before `now`, the most urgent first. */
export async function dueCards(database: GambitDatabase, now = Date.now()): Promise<CardState[]> {
  const states = await cardStates(database);
  return [...states.values()]
    .filter((card) => card.due <= now)
    .sort((a, b) => a.due - b.due || a.cardId.localeCompare(b.cardId));
}
