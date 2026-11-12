import type { PuzzleBand } from '../puzzles/content';
import type { Puzzle } from '../puzzles/puzzle';
import { pinnedJournal, type JournalReview, type PinnedJournal } from './cells';
import type { PuzzleCell, SessionCatalog } from './catalog';

export type SessionCard = { kind: 'puzzle'; key: string; cellId: string; puzzle: Puzzle };

export interface SessionPlan {
  cards: readonly SessionCard[];
  /** How many of the leading cards come from the journal rather than the new ones. */
  dueCount: number;
  /** How many new cards the plan could actually serve. */
  newCount: number;
}

export interface SessionPlanOptions {
  reviews: readonly JournalReview[];
  catalog: SessionCatalog;
  /** Epoch milliseconds at which the session was planned. */
  startedAt: number;
  /** The highest review id written before the session started. */
  lastEntryId: number;
  /** How many new cards the session may introduce. */
  newCount: number;
  /** The rating band new puzzle cells are drawn from. */
  band: PuzzleBand;
}

const BAND_ORDER: readonly PuzzleBand[] = ['low', 'middle', 'high', 'expert'];

interface DueCandidate {
  due: number;
  key: string;
  cell: PuzzleCell;
}

/**
 * The session is a view of the journal, not a stored list. The puzzle reviews up to the pin are
 * replayed into due cells; the new cells fill the rest. A cell is resolved to an unseen puzzle of
 * its motif, and the same position is never served twice in the queue. Endgames and opening lines
 * are trained from their own screen and never enter the session.
 */
export function planSession({
  reviews,
  catalog,
  startedAt,
  lastEntryId,
  newCount,
  band,
}: SessionPlanOptions): SessionPlan {
  const journal = pinnedJournal(reviews, catalog, lastEntryId);
  const used = new Set(journal.seenPuzzles);

  const resolve = (cell: PuzzleCell): SessionCard | null => {
    const puzzle = cell.puzzles.find((item) => !used.has(item.id));
    if (!puzzle) return null;
    used.add(puzzle.id);
    return { kind: 'puzzle', key: cell.id, cellId: cell.id, puzzle };
  };

  const due = duePuzzleCells(journal, catalog, startedAt).map(resolve).filter(isCard);

  const limit = Math.max(0, Math.floor(newCount));
  const fresh: SessionCard[] = [];
  if (limit > 0) {
    for (const cell of newPuzzleCells(journal, catalog, band)) {
      const card = resolve(cell);
      if (card) fresh.push(card);
      if (fresh.length >= limit) break;
    }
  }

  return { cards: [...due, ...fresh], dueCount: due.length, newCount: fresh.length };
}

function duePuzzleCells(
  journal: PinnedJournal,
  catalog: SessionCatalog,
  startedAt: number,
): PuzzleCell[] {
  const due: DueCandidate[] = [];
  for (const state of journal.cells.values()) {
    if (state.due > startedAt) continue;
    const cell = catalog.cells.get(state.cardId);
    if (!cell) continue;
    due.push({ due: state.due, key: cell.id, cell });
  }
  return due
    .sort(
      (left, right) =>
        left.due - right.due || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0),
    )
    .map((item) => item.cell);
}

function newPuzzleCells(
  journal: PinnedJournal,
  catalog: SessionCatalog,
  band: PuzzleBand,
): PuzzleCell[] {
  const bands = BAND_ORDER.slice(BAND_ORDER.indexOf(band));
  const cells: PuzzleCell[] = [];
  for (const current of bands) {
    const available = [...catalog.cells.values()]
      .filter(
        (cell) =>
          cell.band === current &&
          !journal.cells.has(cell.id) &&
          cell.puzzles.some((puzzle) => !journal.seenPuzzles.has(puzzle.id)),
      )
      .sort(
        (left, right) =>
          right.puzzles.length - left.puzzles.length || compareIds(left.id, right.id),
      );
    cells.push(...available);
  }
  return cells;
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isCard(card: SessionCard | null): card is SessionCard {
  return card !== null;
}
