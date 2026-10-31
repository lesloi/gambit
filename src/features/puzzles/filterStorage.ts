import {
  DEFAULT_PUZZLE_FILTERS,
  LENGTH_FILTERS,
  RATING_BANDS,
  type PuzzleFilters,
  type PuzzleLength,
  type PuzzleRating,
} from './content';

/** The key the setup screen's last choices are remembered under. */
export const PUZZLE_FILTERS_STORAGE_KEY = 'gambit:puzzle-filters';

/** The two calls needed from a Storage, so a test can stand in for the browser's. */
export interface FilterStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The choices are a UI preference, not progression: two enum values, out of the backup, and losing
 * them only costs the defaults. The backup stays a dump of the review journal.
 */
export function readPuzzleFilters(storage: FilterStorage | null = browserStorage()): PuzzleFilters {
  if (!storage) return DEFAULT_PUZZLE_FILTERS;

  try {
    const raw = storage.getItem(PUZZLE_FILTERS_STORAGE_KEY);
    if (raw === null) return DEFAULT_PUZZLE_FILTERS;
    return toFilters(JSON.parse(raw));
  } catch {
    return DEFAULT_PUZZLE_FILTERS;
  }
}

export function savePuzzleFilters(
  filters: PuzzleFilters,
  storage: FilterStorage | null = browserStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(
      PUZZLE_FILTERS_STORAGE_KEY,
      JSON.stringify({ length: filters.length, rating: filters.rating }),
    );
  } catch {
    // A full or blocked storage only costs the preference; the screen keeps working.
  }
}

/** Each field is checked on its own, so a future band resets one value instead of both. */
function toFilters(value: unknown): PuzzleFilters {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_PUZZLE_FILTERS;
  }

  const { length, rating } = value as Record<string, unknown>;
  return {
    length: isLength(length) ? length : 'any',
    rating: isRating(rating) ? rating : 'any',
  };
}

function isLength(value: unknown): value is PuzzleLength {
  return LENGTH_FILTERS.includes(value as PuzzleLength);
}

function isRating(value: unknown): value is PuzzleRating {
  return value === 'any' || RATING_BANDS.includes(value as (typeof RATING_BANDS)[number]);
}

/** Reading the global can throw where storage is blocked, so both steps are guarded. */
function browserStorage(): FilterStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
