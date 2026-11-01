import { browserStorage, type StorageLike } from '../../lib/storage';
import { DEFAULT_LEVEL_INDEX, levelAt, levelIndex } from './level';

export const PLAY_LEVEL_STORAGE_KEY = 'gambit:play-level';

/** The level slider position, out of the backup like the puzzle filters: losing it costs a default. */
export function readPlayLevel(storage: StorageLike | null = browserStorage()): number {
  if (!storage) return DEFAULT_LEVEL_INDEX;

  try {
    const raw = storage.getItem(PLAY_LEVEL_STORAGE_KEY);
    if (raw === null) return DEFAULT_LEVEL_INDEX;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return DEFAULT_LEVEL_INDEX;
    }
    const { elo } = value as Record<string, unknown>;
    return typeof elo === 'number' && Number.isFinite(elo) ? levelIndex(elo) : DEFAULT_LEVEL_INDEX;
  } catch {
    return DEFAULT_LEVEL_INDEX;
  }
}

export function savePlayLevel(index: number, storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;

  try {
    storage.setItem(PLAY_LEVEL_STORAGE_KEY, JSON.stringify({ elo: levelAt(index).elo }));
  } catch {
    // A full or blocked storage only costs the preference; the screen keeps working.
  }
}
