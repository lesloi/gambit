export interface Level {
  /** The strength the slider shows, as an approximate Elo. */
  elo: number;
  /** Stockfish's Skill Level option, 0 to 20. */
  skill: number;
}

/**
 * Stockfish's own floor is around 1350 Elo: Skill Level 0 still calculates, it does not blunder
 * like a beginner. The slider therefore starts there and labels the approximation honestly.
 */
export const LEVELS: readonly Level[] = Array.from({ length: 11 }, (_, index) => ({
  elo: 1350 + index * 150,
  skill: index * 2,
}));

export const DEFAULT_LEVEL_INDEX = 1;

/** A hint always comes from the full-strength engine, whatever level the game is played at. */
export const HINT_SKILL = 20;
export const HINT_MOVETIME_MS = 1200;

export function levelAt(index: number): Level {
  const clamped = Math.min(Math.max(Math.round(index), 0), LEVELS.length - 1);
  return LEVELS[clamped];
}

/** The level closest to a stored Elo, so a later change to the list still finds a neighbour. */
export function levelIndex(elo: number): number {
  let best = 0;
  for (let index = 1; index < LEVELS.length; index += 1) {
    if (Math.abs(LEVELS[index].elo - elo) < Math.abs(LEVELS[best].elo - elo)) best = index;
  }
  return best;
}
