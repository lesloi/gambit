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

export interface Premove {
  from: string;
  to: string;
}

export interface PremovePiece {
  role: string;
  color: string;
}

export type PieceAt = (square: string) => PremovePiece | undefined;

/** Chessground lets a king premove onto its rook; chess.js only knows the two-square castle. */
export function normalizePremove(from: string, to: string, pieceAt: PieceAt): Premove {
  const moving = pieceAt(from);
  const target = pieceAt(to);
  if (moving?.role !== 'king' || target?.role !== 'rook' || target.color !== moving.color) {
    return { from, to };
  }

  const rank = moving.color === 'white' ? '1' : '8';
  if (from !== `e${rank}`) return { from, to };
  if (to === `h${rank}`) return { from, to: `g${rank}` };
  if (to === `a${rank}`) return { from, to: `c${rank}` };
  return { from, to };
}
