import { Chess } from 'chess.js';

export type Side = 'white' | 'black';

export type GameEnd =
  | { kind: 'mate'; winner: 'white' | 'black' }
  | { kind: 'stalemate' }
  | { kind: 'insufficient' }
  | { kind: 'seventy-five-move' }
  | { kind: 'fivefold' };

/** Why a game stopped: the position reached an end, or a clock ran out. */
export type GameReason = GameEnd['kind'] | 'flag' | 'flag-draw';

export interface GameResult {
  /** The winner, or null for a draw. */
  winner: Side | null;
  reason: GameReason;
}

/**
 * The four first fields identify a position: the halfmove clock and the move number change without
 * the position changing, so the repetition rule must ignore them.
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
  if (halfmove >= 150) return { kind: 'seventy-five-move' };

  const key = positionKey(fen);
  if (positions.filter((position) => positionKey(position) === key).length >= 5) {
    return { kind: 'fivefold' };
  }

  return null;
}

/**
 * Whether [side] can mate a bare king on its own material, for FIDE 6.9: a flag falls drawn when
 * the side that still had time could not checkmate. A bare king, a lone bishop or knight, or
 * bishops all on one colour cannot mate a bare king; everything else can, and two knights count
 * because the literal rule allows a helpmate against a bare king. This is the FIDE material table,
 * not a search: a lone bishop or knight may still mate under the literal rule when the opponent's
 * pieces block, so king and knight against king and knight is a draw here where the literal rule
 * would give the win to the side with time.
 */
export function canMate(fen: string, side: Side): boolean {
  const chess = new Chess(fen);
  const colour = side === 'white' ? 'w' : 'b';
  let pawns = 0;
  let knights = 0;
  let rooks = 0;
  let queens = 0;
  const bishopColours = new Set<number>();

  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece === null || piece.color !== colour) continue;

      switch (piece.type) {
        case 'p':
          pawns += 1;
          break;
        case 'n':
          knights += 1;
          break;
        case 'r':
          rooks += 1;
          break;
        case 'q':
          queens += 1;
          break;
        case 'b':
          bishopColours.add(squareColour(piece.square));
          break;
      }
    }
  }

  if (pawns > 0 || rooks > 0 || queens > 0) return true;
  if (knights >= 2) return true;
  if (knights === 1 && bishopColours.size > 0) return true;
  return bishopColours.size > 1;
}

/** 0 or 1 for the two square colours; only equality matters here. */
function squareColour(square: string): number {
  return (square.charCodeAt(0) - 'a'.charCodeAt(0) + Number(square.slice(1)) - 1) % 2;
}
