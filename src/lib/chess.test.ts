import { describe, expect, it } from 'vitest';
import { moveHint, normalizePremove, type PremovePiece } from './chess';

function piecesAt(pieces: Record<string, PremovePiece>) {
  return (square: string) => pieces[square];
}

const whiteKing: PremovePiece = { role: 'king', color: 'white' };
const whiteRook: PremovePiece = { role: 'rook', color: 'white' };
const blackKing: PremovePiece = { role: 'king', color: 'black' };
const blackRook: PremovePiece = { role: 'rook', color: 'black' };

describe('move hint', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('names a legal move in standard notation', () => {
    const hint = moveHint(START, 'g1f3');

    expect(hint).toEqual({ from: 'g1', to: 'f3', uci: 'g1f3', san: 'Nf3' });
  });

  it('reads the piece of a promotion from the UCI suffix', () => {
    const hint = moveHint('7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8q');

    expect(hint).toEqual({ from: 'a7', to: 'a8', uci: 'a7a8q', san: 'a8=Q+' });
  });

  it('shows nothing for a move the position does not allow', () => {
    expect(moveHint(START, 'e2e5')).toBeNull();
  });
});

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
