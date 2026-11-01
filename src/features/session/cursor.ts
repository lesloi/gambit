import { RATING_BANDS, type PuzzleBand } from '../puzzles/content';
import { browserStorage, type SessionStorage } from './storage';

/** The key the running session is remembered under. */
export const SESSION_STORAGE_KEY = 'gambit:session';

/**
 * A scalar bookmark into the journal, never a stored queue: GLOSSARY.md says a session is computed
 * from the journal. `startedAt` and `lastEntryId` pin the snapshot, `position` says how far the user
 * got, and the totals are a cache the session screen rewrites on load.
 */
export interface SessionCursor {
  /** Epoch milliseconds when the session was planned. */
  startedAt: number;
  /** The highest journal id written before the session started. */
  lastEntryId: number;
  /** How many cards of the queue the user has finished. */
  position: number;
  /** The number of new cards planned for this session, frozen from the setting. */
  newCount: number;
  /** The band the new puzzle cells were drawn from, frozen from the setting. */
  band: PuzzleBand;
  /** The size of the derived queue, for the home screen. */
  total: number;
  /** The due prefix of the derived queue, for the home screen. */
  dueCount: number;
  /** Epoch milliseconds of the last card, or null while the session is running. */
  completedAt: number | null;
}

export function readSession(
  storage: SessionStorage | null = browserStorage(),
): SessionCursor | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return null;
    return toCursor(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSession(
  cursor: SessionCursor,
  storage: SessionStorage | null = browserStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cursor));
  } catch {
    // A full or blocked storage only costs the resume; the session keeps working in the tab.
  }
}

/** Drops the running session; a backup import must call this before replacing the journal. */
export function clearSession(storage: SessionStorage | null = browserStorage()): void {
  if (!storage) return;

  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Same as a failed write: the next load starts a new session.
  }
}

/** Reconciles a stored cursor with the queue derived now; the screen calls it before resuming. */
export function resumeCursor(
  cursor: SessionCursor,
  plan: { cards: readonly unknown[]; dueCount: number },
  now: number,
): SessionCursor {
  const total = plan.cards.length;
  const position = Math.min(cursor.position, total);
  const completed = total > 0 && position >= total;
  return {
    ...cursor,
    position,
    total,
    dueCount: plan.dueCount,
    completedAt: completed ? (cursor.completedAt ?? now) : null,
  };
}

/** Moves past the current card; the last one completes the session. */
export function advanceCursor(cursor: SessionCursor, total: number, now: number): SessionCursor {
  const position = Math.min(cursor.position + 1, total);
  return {
    ...cursor,
    position,
    total,
    completedAt: total > 0 && position >= total ? now : null,
  };
}

function toCursor(value: unknown): SessionCursor | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const { startedAt, lastEntryId, position, newCount, band, total, dueCount, completedAt } =
    value as Record<string, unknown>;
  if (!isTimestamp(startedAt)) return null;
  if (!isCount(lastEntryId) || !isCount(position) || !isCount(newCount)) return null;
  if (!isCount(total) || !isCount(dueCount)) return null;
  if (position > total || dueCount > total) return null;
  if (!RATING_BANDS.includes(band as PuzzleBand)) return null;
  if (completedAt !== null && !isTimestamp(completedAt)) return null;

  return {
    startedAt,
    lastEntryId,
    position,
    newCount,
    band: band as PuzzleBand,
    total,
    dueCount,
    completedAt,
  };
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
