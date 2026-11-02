import { browserStorage, type StorageLike } from '../../lib/storage';
import { DEFAULT_LEVEL_INDEX, levelAt, levelIndex } from './level';
import {
  DEFAULT_TIME_CONTROL_INDEX,
  timeControlAt,
  timeControlIndex,
  type TimeControl,
} from './timeControl';

export const PLAY_LEVEL_STORAGE_KEY = 'gambit:play-level';
export const PLAY_TIME_CONTROL_STORAGE_KEY = 'gambit:play-time-control';

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

function isMilliseconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** The chosen time control, out of the backup like the level: losing it costs a default. */
export function readPlayTimeControl(storage: StorageLike | null = browserStorage()): number {
  if (!storage) return DEFAULT_TIME_CONTROL_INDEX;

  try {
    const raw = storage.getItem(PLAY_TIME_CONTROL_STORAGE_KEY);
    if (raw === null) return DEFAULT_TIME_CONTROL_INDEX;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return DEFAULT_TIME_CONTROL_INDEX;
    }
    const { controlMs, incrementMs } = value as Record<string, unknown>;
    if (!isMilliseconds(controlMs) || !isMilliseconds(incrementMs)) {
      return DEFAULT_TIME_CONTROL_INDEX;
    }
    const index = timeControlIndex({ controlMs, incrementMs });
    return index === -1 ? DEFAULT_TIME_CONTROL_INDEX : index;
  } catch {
    return DEFAULT_TIME_CONTROL_INDEX;
  }
}

export function savePlayTimeControl(
  index: number,
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) return;

  const control: TimeControl = timeControlAt(index);
  try {
    storage.setItem(PLAY_TIME_CONTROL_STORAGE_KEY, JSON.stringify(control));
  } catch {
    // A full or blocked storage only costs the preference; the screen keeps working.
  }
}
