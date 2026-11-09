import type { Score } from '../../engine/uci';
import type { Side } from '../../lib/position';

/**
 * The scale of the logistic that turns centipawns into a winning percentage. Lichess uses the same
 * curve for its evaluation graph, so the review reads like the one players already know.
 */
const WIN_PERCENT_SCALE = 0.00368208;

/** A score is clamped here before it is turned into a percentage: a big advantage is not a win. */
const WIN_PERCENT_CP_LIMIT = 1000;

/** The chance the side holding the score wins, from 0 to 100. */
export function winPercent(score: Score): number {
  // Stockfish's `mate 0` means the side to move is already mated, not a draw.
  if (score.mate !== null) return score.mate > 0 ? 100 : 0;

  const cp = Math.max(-WIN_PERCENT_CP_LIMIT, Math.min(WIN_PERCENT_CP_LIMIT, score.cp ?? 0));
  return 100 / (1 + Math.exp(-WIN_PERCENT_SCALE * cp));
}

/** A score written from the side to move to the user's point of view. */
export function userScore(score: Score, sideToMove: Side, userColor: Side): Score {
  if (sideToMove === userColor) return score;

  return {
    cp: score.cp === null ? null : -score.cp,
    mate: score.mate === null ? null : -score.mate,
  };
}
