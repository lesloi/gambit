import type { Opponent } from '../../engine/uci';

export interface Level {
  /** The strength the slider shows, as an approximate Elo. */
  elo: number;
  /** Stockfish's Skill Level option, 0 to 20; Maia takes the rating instead. */
  skill: number;
  /** How long the opponent may think at this level; Maia pauses that long before its move. */
  movetimeMs: number;
}

/**
 * Stockfish's own floor is around 1350 Elo: Skill Level 0 still calculates, it does not blunder
 * like a beginner. The slider therefore starts there and labels the approximation honestly.
 */
const STOCKFISH_LEVELS: readonly Level[] = Array.from({ length: 11 }, (_, index) => ({
  elo: 1350 + index * 150,
  skill: index * 2,
  movetimeMs: 300 + index * 100,
}));

/**
 * Maia learned play from 600 to 2600 Elo, one bucket per 100, so the slider covers exactly that and
 * moves by the width of a bucket. Its skill is Stockfish's option and means nothing here.
 */
const MAIA_LEVELS: readonly Level[] = Array.from({ length: 21 }, (_, index) => ({
  elo: 600 + index * 100,
  skill: 20,
  movetimeMs: 600 + index * 50,
}));

export const LEVELS: Record<Opponent, readonly Level[]> = {
  stockfish: STOCKFISH_LEVELS,
  maia: MAIA_LEVELS,
};

/** The levels an opponent offers; the slider is drawn from them, never from one shared list. */
export function levelsFor(opponent: Opponent): readonly Level[] {
  return LEVELS[opponent];
}

export const DEFAULT_ELO = 1350;

/** A hint always comes from the full-strength engine, whatever level the game is played at. */
export const HINT_SKILL = 20;
export const HINT_MOVETIME_MS = 1200;

export function levelAt(levels: readonly Level[], index: number): Level {
  const clamped = Math.min(Math.max(Math.round(index), 0), levels.length - 1);
  return levels[clamped];
}

/** The level closest to an Elo, so a later change to the list still finds a neighbour. */
export function levelIndexIn(levels: readonly Level[], elo: number): number {
  let best = 0;
  for (let index = 1; index < levels.length; index += 1) {
    if (Math.abs(levels[index].elo - elo) < Math.abs(levels[best].elo - elo)) best = index;
  }
  return best;
}
