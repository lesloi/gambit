import puzzlesUrl from '../../../content/puzzles.jsonl.gz?url';
import type { Puzzle } from './puzzle';

/** The lengths the picker offers: the subset only holds odd solutions, so these cover it all. */
export const LENGTH_FILTERS = ['any', '1', '3', '5', 'long'] as const;
export type PuzzleLength = (typeof LENGTH_FILTERS)[number];

/** The rating bands the picker offers, keyed by the Lichess puzzle rating. */
export const RATING_BANDS = ['low', 'middle', 'high'] as const;
export type PuzzleRating = 'any' | (typeof RATING_BANDS)[number];

export interface PuzzleFilters {
  length: PuzzleLength;
  rating: PuzzleRating;
}

export const DEFAULT_PUZZLE_FILTERS: PuzzleFilters = {
  length: 'any',
  rating: 'any',
};

const LENGTH_RANGE: Record<PuzzleLength, readonly [number, number]> = {
  any: [0, Infinity],
  '1': [1, 1],
  '3': [3, 3],
  '5': [5, 5],
  long: [7, Infinity],
};

/** The number of plies of the solution: what the exercise costs, before the first move. */
export function puzzleLength(puzzle: Puzzle): number {
  return puzzle.solution.length;
}

function matchesRating(rating: number, band: PuzzleRating): boolean {
  switch (band) {
    case 'any':
      return true;
    case 'low':
      return rating < 1200;
    case 'middle':
      return rating >= 1200 && rating < 1600;
    case 'high':
      return rating >= 1600;
  }
}

function matchesFilters(puzzle: Puzzle, filters: PuzzleFilters): boolean {
  const [min, max] = LENGTH_RANGE[filters.length];
  return (
    puzzle.solution.length >= min &&
    puzzle.solution.length <= max &&
    matchesRating(puzzle.rating, filters.rating)
  );
}

export function selectPuzzles(puzzles: readonly Puzzle[], filters: PuzzleFilters): Puzzle[] {
  return puzzles.filter((puzzle) => matchesFilters(puzzle, filters));
}

function toPuzzle(entry: unknown): Puzzle | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const { id, fen, solution, themes, rating } = entry as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof fen !== 'string' || fen === '') return null;
  if (!Array.isArray(solution) || solution.length === 0) return null;
  if (!solution.every((move) => typeof move === 'string')) return null;
  if (!Array.isArray(themes) || !themes.every((theme) => typeof theme === 'string')) return null;
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null;
  return { id, fen, solution, themes, rating };
}

/**
 * Reads the one-object-per-line archive. A line the generator could not have written is skipped
 * rather than thrown: one bad entry must not cost the user the whole content set.
 */
export function parsePuzzles(text: string): Puzzle[] {
  const puzzles: Puzzle[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const puzzle = toPuzzle(entry);
    if (puzzle) puzzles.push(puzzle);
  }
  return puzzles;
}

/**
 * The archive ships gzipped and is served from the app's own assets. Nothing leaves the origin;
 * decompressing in the browser keeps the 2 MB of JSONL out of the JS bundle. A server that sets
 * `Content-Encoding: gzip` (the dev server does) hands the body over already decoded.
 */
export async function loadPuzzles(url: string = puzzlesUrl): Promise<Puzzle[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Puzzle content: HTTP ${response.status}`);

  const body = response.body;
  if (!body) throw new Error('Puzzle content: empty response');

  const stream =
    response.headers.get('content-encoding') === 'gzip'
      ? body
      : body.pipeThrough(new DecompressionStream('gzip'));
  const puzzles = parsePuzzles(await new Response(stream).text());
  // A body that decodes but holds no puzzle is a broken response, not an empty subset: every
  // filter would look empty. Surface it instead of serving an app that cannot play.
  if (puzzles.length === 0) throw new Error('Puzzle content: empty archive');
  return puzzles;
}
