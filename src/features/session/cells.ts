import { parseCardId } from '../../db/cards';
import { replayCard, type CardState, type ReviewEntry } from '../../db/fsrs';
import type { SessionCatalog } from './catalog';

/** A review as the journal stores it; the id orders entries written in the same millisecond. */
export interface JournalReview extends ReviewEntry {
  id?: number;
}

export interface PinnedJournal {
  /** The motif cells, their state replayed from the reviews of their puzzles. */
  cells: ReadonlyMap<string, CardState>;
  /** The endgame and opening cards, replayed per content id. */
  cards: ReadonlyMap<string, CardState>;
  /** Every puzzle the journal knows, whether or not the archive still holds it. */
  seenPuzzles: ReadonlySet<string>;
  /** Every card id the journal knows, for telling a new endgame or opening from a reviewed one. */
  seenCards: ReadonlySet<string>;
}

/**
 * The journal as it stood when the session started, seen through the catalog. A puzzle review
 * belongs to its puzzle's primary motif cell; the cell's state is the replay of all the attempts of
 * its puzzles, as one schedulable unit. A review written after the pin is ignored, which is what
 * keeps a reload on the same queue.
 */
export function pinnedJournal(
  reviews: readonly JournalReview[],
  catalog: SessionCatalog,
  lastEntryId: number,
): PinnedJournal {
  const snapshot = reviews.filter((review) => review.id !== undefined && review.id <= lastEntryId);

  const byCell = new Map<string, JournalReview[]>();
  const byCard = new Map<string, JournalReview[]>();
  for (const review of snapshot) {
    const parsed = parseCardId(review.cardId);
    if (parsed?.mode === 'puzzle') {
      const cell = catalog.cellByPuzzle.get(parsed.contentId);
      if (!cell) continue;
      const list = byCell.get(cell);
      if (list) list.push(review);
      else byCell.set(cell, [review]);
    } else {
      const list = byCard.get(review.cardId);
      if (list) list.push(review);
      else byCard.set(review.cardId, [review]);
    }
  }

  const cells = new Map<string, CardState>();
  for (const [cell, list] of byCell) {
    const state = replayCard(list);
    if (state) cells.set(cell, { ...state, cardId: cell });
  }

  const cards = new Map<string, CardState>();
  for (const [id, list] of byCard) {
    const state = replayCard(list);
    if (state) cards.set(id, state);
  }

  const seenPuzzles = new Set<string>();
  const seenCards = new Set<string>();
  for (const review of snapshot) {
    seenCards.add(review.cardId);
    const parsed = parseCardId(review.cardId);
    if (parsed?.mode === 'puzzle') seenPuzzles.add(parsed.contentId);
  }

  return { cells, cards, seenPuzzles, seenCards };
}
