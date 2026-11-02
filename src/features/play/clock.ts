import type { Side } from '../../lib/position';

export interface ClockState {
  /** How much time each side starts with, in milliseconds. */
  controlMs: number;
  /** How much time a side gains after each move, in milliseconds. */
  incrementMs: number;
  /** The time left when the running side's clock was last started. */
  whiteMs: number;
  blackMs: number;
  /** The side whose clock runs, or null before the first move and after the game ends. */
  running: Side | null;
  /** Epoch milliseconds when the running side's clock started. */
  since: number | null;
}

export function createClock(controlMs: number, incrementMs = 0): ClockState {
  return {
    controlMs,
    incrementMs,
    whiteMs: controlMs,
    blackMs: controlMs,
    running: null,
    since: null,
  };
}

function other(side: Side): Side {
  return side === 'white' ? 'black' : 'white';
}

/** The time left on each side now, never negative. */
export function remainingMs(clock: ClockState, now: number): Record<Side, number> {
  if (clock.running === null || clock.since === null) {
    return { white: clock.whiteMs, black: clock.blackMs };
  }
  const left = Math.max(
    0,
    (clock.running === 'white' ? clock.whiteMs : clock.blackMs) - (now - clock.since),
  );
  return clock.running === 'white'
    ? { white: left, black: clock.blackMs }
    : { white: clock.whiteMs, black: left };
}

/**
 * Charges the move to the side that played it, adds its increment and starts the other clock.
 * The first move only gains its increment: it charges no elapsed time, so setting up costs none.
 */
export function afterMove(clock: ClockState, mover: Side, now: number): ClockState {
  const left = remainingMs(clock, now);
  // A flag ends the game before the move, so its increment must not bring the clock back.
  const gain = left[mover] === 0 ? 0 : clock.incrementMs;
  return {
    ...clock,
    whiteMs: left.white + (mover === 'white' ? gain : 0),
    blackMs: left.black + (mover === 'black' ? gain : 0),
    running: other(mover),
    since: now,
  };
}

/** Stops the clock and keeps the time left at that instant. */
export function stopClock(clock: ClockState, now: number): ClockState {
  const left = remainingMs(clock, now);
  return { ...clock, whiteMs: left.white, blackMs: left.black, running: null, since: null };
}

/** The side whose clock reached zero, or null while both still have time. */
export function flagged(clock: ClockState, now: number): Side | null {
  if (clock.running === null) return null;
  return remainingMs(clock, now)[clock.running] === 0 ? clock.running : null;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
