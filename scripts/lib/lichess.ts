import { Chess } from 'chess.js';

/** The public Lichess puzzle database. It is a single rolling file: no dated archive exists, so the
 * manifest identifies the snapshot by its Last-Modified header and the checksum of the CSV it read.
 */
export const EXPORT_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';

/** A row of the export, untouched: the puzzle starts after the first of its moves. */
export interface ExportRow {
  id: string;
  fen: string;
  moves: readonly string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  plays: number;
  themes: readonly string[];
}

/**
 * A line replayed from the export, before the engine pass gives it its full-line index: the
 * position where the user plays, the rest of the line, and the export's metadata.
 */
export interface PlacedPuzzle {
  id: string;
  fen: string;
  solution: readonly string[];
  rating: number;
  themes: readonly string[];
}

/**
 * Tags that describe the export's own bookkeeping (game phase, length, result) rather than a
 * pattern to train. They stay out of the content: a motif is what the puzzles are filtered by.
 */
export const DESCRIPTIVE_THEMES: ReadonlySet<string> = new Set([
  'advantage',
  'crushing',
  'endgame',
  'equality',
  'long',
  'master',
  'masterVsMaster',
  'mate',
  'middlegame',
  'oneMove',
  'opening',
  'short',
  'superGM',
  'veryLong',
]);

/** What a row becomes once its descriptive tags are gone: the unit the selection works on. */
export interface Entry {
  id: string;
  /** The position before the opponent's move, as the export gives it. */
  fen: string;
  /** The whole line, opponent's first move included. */
  moves: readonly string[];
  rating: number;
  motifs: readonly string[];
  popularity: number;
  plays: number;
}

export type ReplayResult = { ok: true; puzzle: PlacedPuzzle } | { ok: false; reason: 'illegal' };

/** Columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,... */
const COLUMNS = 10;

export function parseExportRow(line: string): ExportRow | null {
  const fields = line.trim().split(',');
  if (fields.length < COLUMNS) return null;

  const [id, fen, moves, rating, ratingDeviation, popularity, plays, themes] = fields;
  const values = { rating, ratingDeviation, popularity, plays };
  if (!id || !fen || !moves) return null;
  if (Object.values(values).some((value) => !Number.isFinite(Number(value)))) return null;

  return {
    id,
    fen,
    moves: moves.split(' '),
    rating: Number(rating),
    ratingDeviation: Number(ratingDeviation),
    popularity: Number(popularity),
    plays: Number(plays),
    themes: (themes ?? '').split(' ').filter(Boolean),
  };
}

/** Null when the row carries no motif, which is the one the app filters on. */
export function entryFromRow(row: ExportRow): Entry | null {
  const motifs = row.themes.filter((theme) => !DESCRIPTIVE_THEMES.has(theme)).sort();
  if (motifs.length === 0) return null;

  return {
    id: row.id,
    fen: row.fen,
    moves: row.moves,
    rating: row.rating,
    motifs,
    popularity: row.popularity,
    plays: row.plays,
  };
}

function moveFromUci(chess: Chess, uci: string) {
  return chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4) || undefined,
  });
}

/**
 * The export gives the position before the opponent's move and a line that starts with it. The app
 * puts the puzzle on `fen` and waits for the user, so the opponent's move is replayed here; the
 * rest of the line is replayed too, which refuses a puzzle the app could not finish.
 */
export function placePuzzle(entry: Entry): ReplayResult {
  const [first, ...solution] = entry.moves;
  if (!first || solution.length === 0) return { ok: false, reason: 'illegal' };

  try {
    const chess = new Chess(entry.fen);
    moveFromUci(chess, first);
    const fen = chess.fen();
    for (const uci of solution) moveFromUci(chess, uci);

    return {
      ok: true,
      puzzle: { id: entry.id, fen, solution, rating: entry.rating, themes: entry.motifs },
    };
  } catch {
    return { ok: false, reason: 'illegal' };
  }
}

export interface Filters {
  minRating: number;
  maxRating: number;
  minPlays: number;
  minPopularity: number;
  maxRatingDeviation: number;
}

/**
 * The band the owner trains in, with a floor on how well a puzzle is known and appreciated. The
 * thresholds keep ~2.6 million of the 6.2 million rows, so they cut noise without starving a bucket.
 */
export const FILTERS: Filters = {
  minRating: 800,
  maxRating: 2200,
  minPlays: 300,
  minPopularity: 85,
  maxRatingDeviation: 100,
};

export function passesFilters(row: ExportRow, filters: Filters = FILTERS): boolean {
  return (
    row.rating >= filters.minRating &&
    row.rating <= filters.maxRating &&
    row.plays >= filters.minPlays &&
    row.popularity >= filters.minPopularity &&
    row.ratingDeviation <= filters.maxRatingDeviation
  );
}
