import { browserStorage, type StorageLike } from '../../lib/storage';
import { DEFAULT_PLAY_COLOR, isPlayColor, type PlayColor } from './color';
import { DEFAULT_ELO } from './level';
import {
  DEFAULT_TIME_CONTROL_INDEX,
  timeControlAt,
  timeControlIndex,
  type TimeControl,
} from './timeControl';

export const PLAY_LEVEL_STORAGE_KEY = 'gambit:play-level';
export const PLAY_TIME_CONTROL_STORAGE_KEY = 'gambit:play-time-control';
export const PLAY_COLOR_STORAGE_KEY = 'gambit:play-color';

/**
 * The strength the user last chose, as an Elo rather than a slider position: a later change to the
 * list of levels then lands on the nearest step instead of on a number.
 */
export function readPlayElo(storage: StorageLike | null = browserStorage()): number {
  if (!storage) return DEFAULT_ELO;

  try {
    const raw = storage.getItem(PLAY_LEVEL_STORAGE_KEY);
    if (raw === null) return DEFAULT_ELO;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return DEFAULT_ELO;
    const { elo } = value as Record<string, unknown>;
    return typeof elo === 'number' && Number.isFinite(elo) ? elo : DEFAULT_ELO;
  } catch {
    return DEFAULT_ELO;
  }
}

export function savePlayElo(elo: number, storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;

  try {
    storage.setItem(PLAY_LEVEL_STORAGE_KEY, JSON.stringify({ elo }));
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

/** The colour the setup offers next: a fixed side or a fresh draw at every new game. */
export function readPlayColor(storage: StorageLike | null = browserStorage()): PlayColor {
  if (!storage) return DEFAULT_PLAY_COLOR;

  try {
    const raw = storage.getItem(PLAY_COLOR_STORAGE_KEY);
    if (raw === null) return DEFAULT_PLAY_COLOR;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return DEFAULT_PLAY_COLOR;
    }
    const { color } = value as Record<string, unknown>;
    return isPlayColor(color) ? color : DEFAULT_PLAY_COLOR;
  } catch {
    return DEFAULT_PLAY_COLOR;
  }
}

export function savePlayColor(
  color: PlayColor,
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(PLAY_COLOR_STORAGE_KEY, JSON.stringify({ color }));
  } catch {
    // A full or blocked storage only costs the preference; the screen keeps working.
  }
}
