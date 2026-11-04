import { sideToMove } from '../../lib/chess';
import type { Side } from '../../lib/position';
import { browserStorage, type StorageLike } from '../../lib/storage';
import { remainingMs, type ClockState } from './clock';
import { playUci, startGame, type PlayState } from './game';

/** The key the game in progress is remembered under. */
export const PLAY_DRAFT_STORAGE_KEY = 'gambit:play-draft';

/** The clock as it stood when the page was left: frozen, so the absence costs no time. */
export interface DraftClock {
  whiteMs: number;
  blackMs: number;
  running: Side | null;
}

/**
 * A game in progress, kept small enough for localStorage and rebuilt from its moves on load. The
 * finished game is still stored as a row; this draft only bridges a reload, a navigation or a
 * closed tab. See docs/DECISIONS.md#persistence.
 */
export interface PlayDraft {
  startedAt: number;
  /** The approximate Elo of the level the engine plays at, as the level list stores it. */
  level: number;
  controlMs: number;
  incrementMs: number;
  userColor: Side;
  /** Every move played from the initial position, in UCI. */
  moves: string[];
  assisted: boolean;
  clock: DraftClock;
}

export interface GameSnapshot {
  state: PlayState;
  clock: ClockState;
  startedAt: number;
  level: number;
}

/** What a live game leaves behind, or null when there is nothing worth resuming. */
export function draftFromGame(game: GameSnapshot, at: number): PlayDraft | null {
  if (game.state.outcome !== 'playing' || game.state.moves.length === 0) return null;

  const left = remainingMs(game.clock, at);
  return {
    startedAt: game.startedAt,
    level: game.level,
    controlMs: game.clock.controlMs,
    incrementMs: game.clock.incrementMs,
    userColor: game.state.userColor,
    moves: [...game.state.moves],
    assisted: game.state.assisted,
    clock: { whiteMs: left.white, blackMs: left.black, running: game.clock.running },
  };
}

export function readDraft(storage: StorageLike | null = browserStorage()): PlayDraft | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(PLAY_DRAFT_STORAGE_KEY);
    if (raw === null) return null;
    return toDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDraft(draft: PlayDraft, storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;

  try {
    storage.setItem(PLAY_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // A full or blocked storage only costs the resume; the game keeps working in the tab.
  }
}

export function clearDraft(storage: StorageLike | null = browserStorage()): void {
  if (!storage) return;

  try {
    storage.removeItem(PLAY_DRAFT_STORAGE_KEY);
  } catch {
    // Same as a failed write: the next visit starts without a draft.
  }
}

/** Replays the moves, then restores what the replay cannot derive. */
export function resumeGame(draft: PlayDraft): PlayState {
  const state = draft.moves.reduce(playUci, startGame());
  return { ...state, userColor: draft.userColor, assisted: draft.assisted };
}

/** The clock frozen at the time left, waiting for the screen to start it. */
export function resumeClock(draft: PlayDraft): ClockState {
  return {
    controlMs: draft.controlMs,
    incrementMs: draft.incrementMs,
    whiteMs: draft.clock.whiteMs,
    blackMs: draft.clock.blackMs,
    running: draft.clock.running,
    since: null,
  };
}

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

function toDraft(value: unknown): PlayDraft | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const { startedAt, level, controlMs, incrementMs, userColor, moves, assisted, clock } =
    value as Record<string, unknown>;
  if (!isTimestamp(startedAt) || !isLevel(level)) return null;
  if (!isMilliseconds(controlMs) || !isMilliseconds(incrementMs)) return null;
  if (userColor !== 'white' && userColor !== 'black') return null;
  if (!Array.isArray(moves) || moves.length === 0) return null;
  if (!moves.every((move) => typeof move === 'string' && UCI_MOVE.test(move))) return null;
  if (typeof assisted !== 'boolean') return null;
  if (!isDraftClock(clock)) return null;

  const state = replay(moves);
  if (state === null || state.outcome !== 'playing') return null;
  // The side whose clock ran is the side to move; anything else would resume a broken position.
  if (clock.running !== sideToMove(state.fen)) return null;

  return {
    startedAt,
    level,
    controlMs,
    incrementMs,
    userColor,
    moves: [...moves],
    assisted,
    clock: { whiteMs: clock.whiteMs, blackMs: clock.blackMs, running: clock.running },
  };
}

function replay(moves: string[]): PlayState | null {
  let state = startGame();
  for (const uci of moves) {
    const next = playUci(state, uci);
    if (next === state) return null;
    state = next;
  }
  return state;
}

function isDraftClock(value: unknown): value is DraftClock {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const { whiteMs, blackMs, running } = value as Record<string, unknown>;
  return (
    isMilliseconds(whiteMs) &&
    isMilliseconds(blackMs) &&
    (running === null || running === 'white' || running === 'black')
  );
}

function isMilliseconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
