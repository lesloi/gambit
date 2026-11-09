import { Chess } from 'chess.js';
import type { EngineLine, Score } from '../../engine/uci';
import type { Side } from '../../lib/position';
import { userScore, winPercent } from './score';

export interface VariationPosition {
  fen: string;
  lastMove: [string, string] | null;
  /** The move that reached this position, or null at the start. */
  san: string | null;
}

function applyUci(chess: Chess, uci: string): { from: string; to: string; san: string } {
  const move = chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4, 5) || undefined,
  });
  return { from: move.from, to: move.to, san: move.san };
}

/** The first moves of a principal variation in standard notation, up to `limit` plies. */
export function pvToSan(fen: string, pv: readonly string[], limit = 7): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of pv.slice(0, limit)) {
    try {
      san.push(applyUci(chess, uci).san);
    } catch {
      break;
    }
  }
  return san;
}

/**
 * Every position of a principal variation, the shown position first. A move the board refuses
 * rejects the whole variation: a partial line would show a position the engine never named.
 */
export function variationPositions(fen: string, pv: readonly string[]): VariationPosition[] | null {
  const chess = new Chess(fen);
  const positions: VariationPosition[] = [{ fen, lastMove: null, san: null }];

  for (const uci of pv) {
    try {
      const move = applyUci(chess, uci);
      positions.push({ fen: chess.fen(), lastMove: [move.from, move.to], san: move.san });
    } catch {
      return null;
    }
  }

  return positions;
}

/** An engine score from the user's side, as a short figure: `+1,2`, `Mat en 3`. */
export function formatScore(score: Score, sideToMove: Side, userColor: Side): string {
  const user = userScore(score, sideToMove, userColor);
  if (user.mate !== null) {
    if (user.mate === 0) return 'Mat';
    return user.mate > 0 ? `Mat en ${user.mate}` : `Mat en ${-user.mate} contre toi`;
  }
  if (user.cp === null) return '—';

  const pawns = user.cp / 100;
  if (pawns === 0) return '0,0';
  return `${pawns > 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1).replace('.', ',')}`;
}

/**
 * Whether the first line is clearly the only good one: ten win points ahead of the second at
 * the same depth. Different depths make the gap a search artefact, not a property of the position.
 */
export function clearlyBetter(lines: readonly EngineLine[]): boolean {
  if (lines.length < 2) return false;
  const [first, second] = lines;
  if (
    !first ||
    !second ||
    first.depth === undefined ||
    second.depth === undefined ||
    first.depth !== second.depth
  ) {
    return false;
  }

  return winPercent(first.score) - winPercent(second.score) >= 10;
}
