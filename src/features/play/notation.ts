import { Chess } from 'chess.js';
import type { Side } from '../../lib/position';

export interface SheetMove {
  /** The full-move number, starting at 1. */
  number: number;
  side: Side;
  /** The position reached after this move, the start being zero. */
  ply: number;
  san: string;
}

export interface MovePair {
  /** The full-move number, starting at 1. */
  number: number;
  white: SheetMove;
  /** Null while White's move is the last one played. */
  black: SheetMove | null;
}

export interface ScoreSheet {
  moves: SheetMove[];
  rows: MovePair[];
}

/** The score sheet: every move replayed into standard notation, two per row. */
export function scoreSheet(history: readonly string[]): ScoreSheet {
  const chess = new Chess();
  const moves: SheetMove[] = [];
  const rows: MovePair[] = [];

  for (const uci of history) {
    let move;
    try {
      move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4, 5) || undefined,
      });
    } catch {
      // A move the board never accepted ends the sheet rather than breaking it.
      break;
    }

    const ply = moves.length + 1;
    const entry: SheetMove = {
      number: Math.ceil(ply / 2),
      side: move.color === 'w' ? 'white' : 'black',
      ply,
      san: move.san,
    };
    moves.push(entry);

    if (entry.side === 'white') rows.push({ number: entry.number, white: entry, black: null });
    else rows[rows.length - 1].black = entry;
  }

  return { moves, rows };
}

/** A move as the sheet and the review bar write it: `12. e4` for White, `12… e5` for Black. */
export function moveLabel(move: SheetMove): string {
  return `${move.number}${move.side === 'white' ? '.' : '…'} ${move.san}`;
}
