import type { TimeControl } from './timeControl';

/** A game is about forty moves long, and a move may spend a third of its even share. */
const MOVES = 40;
const SHARE = 1 / 3;

/** Even a bullet game gives the engine a moment to look at the board. */
const MIN_THINK_MS = 500;
/** A longer control does not mean sitting in front of a thinking engine for a minute. */
const MAX_THINK_MS = 4_000;

/**
 * How long the engine may think about its next move. It follows the clock, like a human opponent,
 * rather than the level: Skill Level already says how strong it is, and a fixed movetime made
 * every level answer in a fraction of a second, whatever the control.
 */
export function thinkTimeMs(
  control: TimeControl,
  remainingMs: number,
  random: () => number = Math.random,
): number {
  if (remainingMs <= 0) return 0;

  const share = clamp(
    (control.controlMs / MOVES) * SHARE + control.incrementMs,
    MIN_THINK_MS,
    MAX_THINK_MS,
  );
  const wanted = share * (0.8 + random() * 0.4);
  // The engine never spends more than a fifth of what its clock holds, however long the control.
  return Math.max(1, Math.round(Math.min(wanted, remainingMs / 5)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
