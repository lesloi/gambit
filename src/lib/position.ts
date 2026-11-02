import { Chess } from 'chess.js';

export type Side = 'white' | 'black';

export type GameEnd =
  | { kind: 'mate'; winner: 'white' | 'black' }
  | { kind: 'stalemate' }
  | { kind: 'insufficient' }
  | { kind: 'fifty-move' }
  | { kind: 'threefold' };

/** Why a game stopped: the position reached an end, or a clock ran out. */
export type GameReason = GameEnd['kind'] | 'flag';

export interface GameResult {
  /** The winner, or null for a draw. */
  winner: Side | null;
  reason: GameReason;
}

/**
 * The four first fields identify a position: the halfmove clock and the move number change without
 * the position changing, so threefold repetition must ignore them.
 */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** How the game ended, or null while it is still being played. */
export function gameEnd(fen: string, positions: readonly string[]): GameEnd | null {
  const chess = new Chess(fen);

  if (chess.isCheckmate()) {
    // The side to move is the one mated, so the other side gave mate.
    return { kind: 'mate', winner: chess.turn() === 'w' ? 'black' : 'white' };
  }
  if (chess.isStalemate()) return { kind: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { kind: 'insufficient' };

  const halfmove = Number(fen.split(' ')[4] ?? 0);
  if (halfmove >= 100) return { kind: 'fifty-move' };

  const key = positionKey(fen);
  if (positions.filter((position) => positionKey(position) === key).length >= 3) {
    return { kind: 'threefold' };
  }

  return null;
}
