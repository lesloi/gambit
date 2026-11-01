import { cardId } from '../../db/cards';
import type { Endgame } from '../endgames/endgame';
import type { OpeningLine } from '../openings/opening';
import type { PuzzleBand } from '../puzzles/content';
import type { Puzzle } from '../puzzles/puzzle';
import { pinnedJournal, type JournalReview, type PinnedJournal } from './cells';
import type { PuzzleCell, SessionCatalog } from './catalog';

export type SessionCard =
  | { kind: 'puzzle'; key: string; cellId: string; puzzle: Puzzle }
  | { kind: 'endgame'; key: string; endgame: Endgame }
  | { kind: 'opening'; key: string; line: OpeningLine };

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

const BAND_ORDER: readonly PuzzleBand[] = ['low', 'middle', 'high'];

type Candidate =
  | { kind: 'puzzle'; cell: PuzzleCell }
  | { kind: 'endgame'; endgame: Endgame }
  | { kind: 'opening'; line: OpeningLine };

interface DueCandidate {
  due: number;
  key: string;
  candidate: Candidate;
}

/**
 * The session is a view of the journal, not a stored list. The reviews up to the pin are replayed
 * into due cells and cards; the new ones fill the rest, interleaved across the modes so one mode
 * never takes the whole sitting. A puzzle cell is resolved to an unseen puzzle of its motif, and
 * the same position is never served twice in the queue.
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

  const resolve = (candidate: Candidate): SessionCard | null => {
    if (candidate.kind === 'puzzle') {
      const puzzle = candidate.cell.puzzles.find((item) => !used.has(item.id));
      if (!puzzle) return null;
      used.add(puzzle.id);
      return { kind: 'puzzle', key: candidate.cell.id, cellId: candidate.cell.id, puzzle };
    }
    if (candidate.kind === 'endgame') {
      return {
        kind: 'endgame',
        key: cardId('endgame', candidate.endgame.id),
        endgame: candidate.endgame,
      };
    }
    return { kind: 'opening', key: cardId('opening', candidate.line.id), line: candidate.line };
  };

  const due = interleave([
    duePuzzleCells(journal, catalog, startedAt).map((item) => item.candidate),
    dueContent(
      journal,
      catalog.endgames,
      (endgame) => cardId('endgame', endgame.id),
      (endgame) => ({ kind: 'endgame', endgame }),
      startedAt,
    ),
    dueContent(
      journal,
      catalog.openings,
      (line) => cardId('opening', line.id),
      (line) => ({ kind: 'opening', line }),
      startedAt,
    ),
  ])
    .map(resolve)
    .filter(isCard);

  const limit = Math.max(0, Math.floor(newCount));
  const fresh: SessionCard[] = [];
  if (limit > 0) {
    const candidates = interleave([
      newPuzzleCells(journal, catalog, band),
      catalog.endgames
        .filter((endgame) => !journal.seenCards.has(cardId('endgame', endgame.id)))
        .map((endgame): Candidate => ({ kind: 'endgame', endgame })),
      catalog.openings
        .filter((line) => !journal.seenCards.has(cardId('opening', line.id)))
        .map((line): Candidate => ({ kind: 'opening', line })),
    ]);
    for (const candidate of candidates) {
      const card = resolve(candidate);
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
): DueCandidate[] {
  const due: DueCandidate[] = [];
  for (const state of journal.cells.values()) {
    if (state.due > startedAt) continue;
    const cell = catalog.cells.get(state.cardId);
    if (!cell) continue;
    due.push({ due: state.due, key: cell.id, candidate: { kind: 'puzzle', cell } });
  }
  return sortDue(due);
}

function dueContent<T>(
  journal: PinnedJournal,
  content: readonly T[],
  keyOf: (item: T) => string,
  candidateOf: (item: T) => Candidate,
  startedAt: number,
): Candidate[] {
  const due: DueCandidate[] = [];
  for (const item of content) {
    const key = keyOf(item);
    const state = journal.cards.get(key);
    if (!state || state.due > startedAt) continue;
    due.push({ due: state.due, key, candidate: candidateOf(item) });
  }
  return sortDue(due).map((item) => item.candidate);
}

function sortDue(cards: readonly DueCandidate[]): DueCandidate[] {
  return [...cards].sort(
    (left, right) =>
      left.due - right.due || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0),
  );
}

function newPuzzleCells(
  journal: PinnedJournal,
  catalog: SessionCatalog,
  band: PuzzleBand,
): Candidate[] {
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
  return cells.map((cell) => ({ kind: 'puzzle', cell }));
}

function interleave<T>(groups: readonly (readonly T[])[]): T[] {
  const result: T[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      const item = group[index];
      if (item !== undefined) result.push(item);
    }
  }
  return result;
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isCard(card: SessionCard | null): card is SessionCard {
  return card !== null;
}
