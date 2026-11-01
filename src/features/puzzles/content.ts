import puzzlesUrl from '../../../content/puzzles.jsonl.gz?url';
import type { Puzzle } from './puzzle';

/** The lengths the picker offers: the subset only holds odd solutions, so these cover it all. */
export const LENGTH_FILTERS = ['any', '1', '3', '5', 'long'] as const;
export type PuzzleLength = (typeof LENGTH_FILTERS)[number];

/** The rating bands the picker and the session share, keyed by the Lichess puzzle rating. */
export const RATING_BANDS = ['low', 'middle', 'high'] as const;
export type PuzzleBand = (typeof RATING_BANDS)[number];
export type PuzzleRating = 'any' | PuzzleBand;

/** The band a puzzle belongs to; the session groups motifs by it. */
export function ratingBand(rating: number): PuzzleBand {
  if (rating < 1200) return 'low';
  if (rating < 1600) return 'middle';
  return 'high';
}

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
  return band === 'any' || ratingBand(rating) === band;
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
  const { id, fen, solution, themes, rating, fullLine } = entry as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof fen !== 'string' || fen === '') return null;
  if (!Array.isArray(solution) || solution.length === 0) return null;
  if (!solution.every((move) => typeof move === 'string')) return null;
  if (!Array.isArray(themes) || !themes.every((theme) => typeof theme === 'string')) return null;
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null;
  if (typeof fullLine !== 'boolean') return null;
  return { id, fen, solution, themes, rating, fullLine };
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

/** The two bytes every gzip member starts with, whatever the headers claim. */
function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * The archive is fetched once per visit and shared by the screens; a failed load is forgotten so a
 * retry starts a new fetch.
 */
let archive: Promise<readonly Puzzle[]> | null = null;

export function loadPuzzleArchive(): Promise<readonly Puzzle[]> {
  archive ??= loadPuzzles().catch((error: unknown) => {
    archive = null;
    throw error;
  });
  return archive;
}

/**
 * The archive ships gzipped and is served from the app's own assets. Nothing leaves the origin;
 * decompressing in the browser keeps the 2 MB of JSONL out of the JS bundle.
 *
 * `Content-Encoding: gzip` covers two different bodies, so it cannot decide: a server that labels
 * the file (Vite in development, `gzip_static`) lets the browser decode it and hand us the JSONL,
 * while a proxy that compresses the already-gzipped response once more leaves the archive itself
 * behind the same header. Only the bytes say which one arrived.
 */
export async function loadPuzzles(url: string = puzzlesUrl): Promise<Puzzle[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Puzzle content: HTTP ${response.status}`);

  const archive = await response.blob();
  const bytes = new Uint8Array(await archive.arrayBuffer());
  if (bytes.length === 0) throw new Error('Puzzle content: empty response');

  const text = isGzip(bytes)
    ? await new Response(archive.stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : await archive.text();
  const puzzles = parsePuzzles(text);
  // A body that decodes but holds no puzzle is a broken response, not an empty subset: every
  // filter would look empty. Surface it instead of serving an app that cannot play.
  if (puzzles.length === 0) throw new Error('Puzzle content: empty archive');
  return puzzles;
}
