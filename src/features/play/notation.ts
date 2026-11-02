import { Chess } from 'chess.js';

export interface MovePair {
  /** The full-move number, starting at 1. */
  number: number;
  white: string;
  /** Null while White's move is the last one played. */
  black: string | null;
}

/** The score sheet: the moves of a game replayed into standard notation, two per row. */
export function movePairs(moves: readonly string[]): MovePair[] {
  const chess = new Chess();
  const pairs: MovePair[] = [];

  for (const uci of moves) {
    let san: string;
    try {
      san = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4, 5) || undefined,
      }).san;
    } catch {
      // A move the board never accepted ends the sheet rather than breaking it.
      return pairs;
    }

    const last = pairs[pairs.length - 1];
    if (last !== undefined && last.black === null) last.black = san;
    else pairs.push({ number: pairs.length + 1, white: san, black: null });
  }

  return pairs;
}
