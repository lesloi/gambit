import { describe, expect, it } from 'vitest';
import { normalizePremove, type PremovePiece } from './chess';

function piecesAt(pieces: Record<string, PremovePiece>) {
  return (square: string) => pieces[square];
}

const whiteKing: PremovePiece = { role: 'king', color: 'white' };
const whiteRook: PremovePiece = { role: 'rook', color: 'white' };
const blackKing: PremovePiece = { role: 'king', color: 'black' };
const blackRook: PremovePiece = { role: 'rook', color: 'black' };

describe('premove normalization', () => {
  it('turns a white king-on-rook premove into a king-side castle', () => {
    const pieceAt = piecesAt({ e1: whiteKing, h1: whiteRook });

    expect(normalizePremove('e1', 'h1', pieceAt)).toEqual({ from: 'e1', to: 'g1' });
  });

  it('turns a white king-on-rook premove into a queen-side castle', () => {
    const pieceAt = piecesAt({ e1: whiteKing, a1: whiteRook });

    expect(normalizePremove('e1', 'a1', pieceAt)).toEqual({ from: 'e1', to: 'c1' });
  });

  it('turns a black king-on-rook premove into a king-side castle', () => {
    const pieceAt = piecesAt({ e8: blackKing, h8: blackRook });

    expect(normalizePremove('e8', 'h8', pieceAt)).toEqual({ from: 'e8', to: 'g8' });
  });

  it('leaves a king that is not on its starting square alone', () => {
    const pieceAt = piecesAt({ g1: whiteKing, h1: whiteRook });

    expect(normalizePremove('g1', 'h1', pieceAt)).toEqual({ from: 'g1', to: 'h1' });
  });

  it('leaves a normal premove alone', () => {
    const pieceAt = piecesAt({ e2: { role: 'pawn', color: 'white' } });

    expect(normalizePremove('e2', 'e4', pieceAt)).toEqual({ from: 'e2', to: 'e4' });
  });

  it('leaves a king moving onto an enemy rook alone', () => {
    const pieceAt = piecesAt({ e1: whiteKing, h1: blackRook });

    expect(normalizePremove('e1', 'h1', pieceAt)).toEqual({ from: 'e1', to: 'h1' });
  });
});
