import type { GameResult, Side } from '../../lib/position';

/**
 * A one-game Elo performance: the opponent's rating moved by the club's 400-point rule, a win
 * above it and a loss below it. A draw sits at the opponent's rating, and a completed game has
 * no other input. The floor only guards a level below 400; the app's levels are 600 and up.
 */
export function performanceRating(
  result: GameResult | null,
  userColor: Side,
  opponentElo: number,
): number | null {
  if (result === null) return null;

  const score = result.winner === null ? 0.5 : result.winner === userColor ? 1 : 0;
  // The inputs are integers, so the rounding is only a guard around the arithmetic.
  return Math.max(0, Math.round(opponentElo + 400 * (2 * score - 1)));
}
