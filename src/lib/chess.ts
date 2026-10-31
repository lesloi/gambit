import { Chess } from 'chess.js';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

/** The colour to move in a position, for the board and the turn label. */
export function sideToMove(fen: string): 'white' | 'black' {
  return new Chess(fen).turn() === 'w' ? 'white' : 'black';
}

const PROMOTION_ORDER: readonly PromotionPiece[] = ['q', 'r', 'b', 'n'];

/** The pieces the move can promote to, in the order the chooser shows them. Empty otherwise. */
export function promotionPieces(fen: string, from: string, to: string): PromotionPiece[] {
  const chess = new Chess(fen);
  const legal = new Set(
    chess
      .moves({ verbose: true })
      .filter((move) => move.from === from && move.to === to)
      .map((move) => move.promotion),
  );
  return PROMOTION_ORDER.filter((piece) => legal.has(piece));
}

/** The legal destinations of the side to move, in the shape chessground expects. */
export function legalDests(fen: string): Map<string, string[]> {
  const chess = new Chess(fen);
  const dests = new Map<string, string[]>();
  for (const move of chess.moves({ verbose: true })) {
    const list = dests.get(move.from) ?? [];
    list.push(move.to);
    dests.set(move.from, list);
  }
  return dests;
}
