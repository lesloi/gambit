import { Chess } from 'chess.js';
import { START_FEN, type Side } from '../../lib/position';

export interface SheetMove {
  /** The full-move number from the position's FEN. */
  number: number;
  side: Side;
  /** The position reached after this move, the start being zero. */
  ply: number;
  san: string;
}

export interface MovePair {
  /** The full-move number from the position's FEN. */
  number: number;
  /** Null when the line starts with a Black move. */
  white: SheetMove | null;
  /** Null while White's move is the last one played. */
  black: SheetMove | null;
}

export interface ScoreSheet {
  moves: SheetMove[];
  rows: MovePair[];
}

/**
 * The score sheet: every move replayed into standard notation from `startFen`, two per row. A line
 * that starts with Black keeps a row whose White cell is empty.
 */
export function scoreSheet(history: readonly string[], startFen: string = START_FEN): ScoreSheet {
  const chess = new Chess(startFen);
  const moves: SheetMove[] = [];
  const rows: MovePair[] = [];

  for (const uci of history) {
    // Read both before the move: chess.js increments the number after Black's move.
    const number = chess.moveNumber();
    const side = chess.turn() === 'w' ? 'white' : 'black';
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
    const entry: SheetMove = { number, side, ply, san: move.san };
    moves.push(entry);

    if (side === 'white') {
      rows.push({ number, white: entry, black: null });
      continue;
    }

    const last = rows[rows.length - 1];
    if (last && last.number === number && last.white !== null) last.black = entry;
    else rows.push({ number, white: null, black: entry });
  }

  return { moves, rows };
}

/** A move as the sheet and the review bar write it: `12. e4` for White, `12… e5` for Black. */
export function moveLabel(move: SheetMove): string {
  return `${move.number}${move.side === 'white' ? '.' : '…'} ${move.san}`;
}
