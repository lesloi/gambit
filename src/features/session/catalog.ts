import { loadEndgames } from '../endgames/content';
import type { Endgame } from '../endgames/endgame';
import { loadOpenings } from '../openings/content';
import type { OpeningLine } from '../openings/opening';
import { loadPuzzleArchive, ratingBand, type PuzzleBand } from '../puzzles/content';
import type { Puzzle } from '../puzzles/puzzle';

/** One schedulable puzzle unit: a motif at a rating band, served with unseen positions. */
export interface PuzzleCell {
  id: string;
  theme: string;
  band: PuzzleBand;
  /** The puzzles whose primary motif is this theme, in archive order. */
  puzzles: readonly Puzzle[];
}

export interface SessionCatalog {
  puzzles: readonly Puzzle[];
  endgames: readonly Endgame[];
  openings: readonly OpeningLine[];
  puzzleById: ReadonlyMap<string, Puzzle>;
  endgameById: ReadonlyMap<string, Endgame>;
  openingById: ReadonlyMap<string, OpeningLine>;
  cells: ReadonlyMap<string, PuzzleCell>;
  cellByPuzzle: ReadonlyMap<string, string>;
}

export function cellId(theme: string, band: PuzzleBand): string {
  return `cell:${theme}/${band}`;
}

/**
 * The motif a puzzle is scheduled under. The content pipeline uses the same rule: the rarest
 * theme, so a common tag such as `fork` does not swallow a rare one, and a tie is alphabetical.
 * The app re-derives it from the archive because the export does not store it.
 */
export function primaryTheme(
  themes: readonly string[],
  counts: ReadonlyMap<string, number>,
): string {
  return [...themes].sort(
    (left, right) =>
      (counts.get(left) ?? 0) - (counts.get(right) ?? 0) ||
      (left < right ? -1 : left > right ? 1 : 0),
  )[0]!;
}

/** Puts each puzzle in exactly one motif cell, so a review cannot be evidence for another cell. */
export function sessionCatalog(
  puzzles: readonly Puzzle[],
  endgames: readonly Endgame[],
  openings: readonly OpeningLine[],
): SessionCatalog {
  const counts = new Map<string, number>();
  for (const puzzle of puzzles) {
    for (const theme of puzzle.themes) {
      counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }

  const cells = new Map<string, PuzzleCell>();
  const cellByPuzzle = new Map<string, string>();
  for (const puzzle of puzzles) {
    if (puzzle.themes.length === 0) continue;
    const theme = primaryTheme(puzzle.themes, counts);
    const band = ratingBand(puzzle.rating);
    const id = cellId(theme, band);
    const cell = cells.get(id);
    if (cell) (cell.puzzles as Puzzle[]).push(puzzle);
    else cells.set(id, { id, theme, band, puzzles: [puzzle] });
    cellByPuzzle.set(puzzle.id, id);
  }

  return {
    puzzles,
    endgames,
    openings,
    puzzleById: new Map(puzzles.map((puzzle) => [puzzle.id, puzzle])),
    endgameById: new Map(endgames.map((endgame) => [endgame.id, endgame])),
    openingById: new Map(openings.map((line) => [line.id, line])),
    cells,
    cellByPuzzle,
  };
}

/** Loaded once per visit and shared by the home preview and the session; a failure is retryable. */
let catalog: Promise<SessionCatalog> | null = null;

export function loadSessionCatalog(): Promise<SessionCatalog> {
  catalog ??= loadPuzzleArchive()
    .then((puzzles) => sessionCatalog(puzzles, loadEndgames(), loadOpenings()))
    .catch((error: unknown) => {
      catalog = null;
      throw error;
    });
  return catalog;
}
