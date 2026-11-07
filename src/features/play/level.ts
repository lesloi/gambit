export interface Level {
  /** The strength the slider shows, as an approximate Elo. */
  elo: number;
  /** How long Maia pauses before its move, which is what its clock pays. */
  movetimeMs: number;
}

/**
 * Maia learned play from 600 to 2600 Elo, one bucket per 100, so the slider covers exactly that and
 * moves by the width of a bucket. The pause grows with the level: a stronger player takes longer to
 * choose, and a Maia has no search of its own to spend the time.
 */
export const LEVELS: readonly Level[] = Array.from({ length: 21 }, (_, index) => ({
  elo: 600 + index * 100,
  movetimeMs: 600 + index * 50,
}));

export const DEFAULT_ELO = 1350;

export function levelAt(index: number): Level {
  const clamped = Math.min(Math.max(Math.round(index), 0), LEVELS.length - 1);
  return LEVELS[clamped];
}

/** The level closest to an Elo, so a later change to the list still finds a neighbour. */
export function levelIndex(elo: number): number {
  let best = 0;
  for (let index = 1; index < LEVELS.length; index += 1) {
    if (Math.abs(LEVELS[index].elo - elo) < Math.abs(LEVELS[best].elo - elo)) best = index;
  }
  return best;
}
