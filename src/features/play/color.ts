import type { Side } from '../../lib/position';

/** What the play setup offers: a side to play, or a side drawn at each new game. */
export type PlayColor = Side | 'random';

export const DEFAULT_PLAY_COLOR: PlayColor = 'white';

export const PLAY_COLORS: readonly PlayColor[] = ['white', 'black', 'random'];

export function isPlayColor(value: unknown): value is PlayColor {
  return value === 'white' || value === 'black' || value === 'random';
}

/** The side the user plays; a random choice is drawn once, before the first move. */
export function drawColor(color: PlayColor, random: () => number = Math.random): Side {
  if (color !== 'random') return color;
  return random() < 0.5 ? 'white' : 'black';
}
