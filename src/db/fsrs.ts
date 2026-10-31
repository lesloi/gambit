import { createEmptyCard, fsrs, type Grade, type State, type Steps } from 'ts-fsrs';

/** One attempt at a card, as the journal stores it: the inputs of the scheduler, not its output. */
export interface ReviewEntry {
  cardId: string;
  rating: Grade;
  /** Epoch milliseconds. */
  reviewedAt: number;
}

export interface CardState {
  cardId: string;
  /** Epoch milliseconds. */
  due: number;
  /** Epoch milliseconds of the last review. */
  lastReview: number;
  state: State;
  stability: number;
  difficulty: number;
  /** How many reviews the state comes from. */
  reviews: number;
}

/**
 * Pinned with its parameters, because replaying the journal under another model would move every
 * due date. Fuzzing is off for the same reason; the short steps keep a missed card in the session.
 * See docs/DECISIONS.md#persistence.
 */
export const SCHEDULER = {
  library: 'ts-fsrs@5.4.2',
  model: 'FSRS-6',
  parameters: {
    request_retention: 0.9,
    maximum_interval: 36500,
    enable_fuzz: false,
    enable_short_term: true,
    learning_steps: ['1m', '10m'] as Steps,
    relearning_steps: ['10m'] as Steps,
  },
} as const;

const scheduler = fsrs({ ...SCHEDULER.parameters });

export function replayCard(reviews: readonly ReviewEntry[]): CardState | null {
  const [first] = reviews;
  if (!first) return null;

  // The journal's order is the order of the attempts, so it is replayed as given.
  let card = createEmptyCard(new Date(first.reviewedAt));
  let lastReview = first.reviewedAt;

  for (const review of reviews) {
    // A clock that goes back, or a journal imported out of order, must not read as negative
    // elapsed time: the review counts at the previous timestamp.
    const reviewedAt = Math.max(review.reviewedAt, lastReview);
    card = scheduler.next(card, new Date(reviewedAt), review.rating).card;
    lastReview = reviewedAt;
  }

  return {
    cardId: first.cardId,
    due: card.due.getTime(),
    lastReview,
    state: card.state,
    stability: card.stability,
    difficulty: card.difficulty,
    reviews: reviews.length,
  };
}
