import { Chess } from 'chess.js';

export type CapturedPiece = 'p' | 'n' | 'b' | 'r' | 'q';

export type MaterialColor = 'white' | 'black';

export interface Material {
  /** The pieces each side took, heaviest first; White's list holds Black's pieces. */
  captured: Record<MaterialColor, CapturedPiece[]>;
  /** White's material minus Black's, in pawns, so a promotion counts. */
  advantage: number;
}

const VALUES: Record<CapturedPiece | 'k', number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * The pieces each side took, from the move list, and the material left on the board, from the
 * position. A promotion is material on the board without being a capture, so the two measures
 * can differ, and the differential follows the board.
 */
export function materialOf(fen: string, moves: readonly string[]): Material {
  const captured: Record<MaterialColor, CapturedPiece[]> = { white: [], black: [] };
  const chess = new Chess();

  for (const uci of moves) {
    let move;
    try {
      move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4, 5) || undefined,
      });
    } catch {
      // A move the board never accepted ends the replay rather than breaking it.
      break;
    }
    const taken = move.captured;
    if (taken !== undefined && taken !== 'k') {
      captured[move.color === 'w' ? 'white' : 'black'].push(taken);
    }
  }

  const byValue = (left: CapturedPiece, right: CapturedPiece) => VALUES[right] - VALUES[left];
  captured.white.sort(byValue);
  captured.black.sort(byValue);

  return { captured, advantage: advantageOf(fen) };
}

function advantageOf(fen: string): number {
  const board = new Chess(fen).board();
  let advantage = 0;

  for (const rank of board) {
    for (const square of rank) {
      if (square === null) continue;
      const value = VALUES[square.type];
      advantage += square.color === 'w' ? value : -value;
    }
  }

  return advantage;
}
