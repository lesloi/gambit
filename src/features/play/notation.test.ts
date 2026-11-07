import { describe, expect, it } from 'vitest';
import { moveLabel, scoreSheet } from './notation';

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const MID_GAME = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 32';

describe('score sheet', () => {
  it('pairs the moves two per row, numbered from one', () => {
    const { rows } = scoreSheet(['e2e4', 'e7e5', 'g1f3', 'b8c6']);

    expect(rows.map((row) => [row.number, row.white?.san, row.black?.san])).toEqual([
      [1, 'e4', 'e5'],
      [2, 'Nf3', 'Nc6'],
    ]);
  });

  it('numbers a line from the FEN when Black moves first', () => {
    const { rows } = scoreSheet(['e7e5', 'g1f3'], AFTER_E4);

    expect(rows.map((row) => [row.number, row.white?.san ?? null, row.black?.san ?? null])).toEqual(
      [
        [1, null, 'e5'],
        [2, 'Nf3', null],
      ],
    );
  });

  it('keeps the fullmove number of a mid-game position', () => {
    const { rows } = scoreSheet(['e2e4', 'e7e5'], MID_GAME);

    expect(rows.map((row) => [row.number, row.white?.san, row.black?.san])).toEqual([
      [32, 'e4', 'e5'],
    ]);
  });

  it('numbers the moves of a Black-first line from the FEN', () => {
    const { moves } = scoreSheet(['e7e5', 'g1f3'], AFTER_E4);

    expect(moves).toEqual([
      { number: 1, side: 'black', ply: 1, san: 'e5' },
      { number: 2, side: 'white', ply: 2, san: 'Nf3' },
    ]);
  });

  it('numbers each move and the position it reaches', () => {
    const { moves } = scoreSheet(['e2e4', 'e7e5', 'g1f3']);

    expect(moves).toEqual([
      { number: 1, side: 'white', ply: 1, san: 'e4' },
      { number: 1, side: 'black', ply: 2, san: 'e5' },
      { number: 2, side: 'white', ply: 3, san: 'Nf3' },
    ]);
  });

  it('leaves Black empty while White made the last move', () => {
    const { rows } = scoreSheet(['e2e4', 'e7e5', 'g1f3']);

    expect(rows[rows.length - 1]).toMatchObject({ number: 2, black: null });
  });

  it('writes castling and check in standard notation', () => {
    const { rows } = scoreSheet(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1g1']);

    expect(rows[2]).toMatchObject({ number: 3 });
    expect(rows[2].white?.san).toBe('Bb5');
    expect(rows[2].black?.san).toBe('Nf6');
    expect(rows[3]).toMatchObject({ number: 4, black: null });
    expect(rows[3].white?.san).toBe('O-O');

    const mate = scoreSheet(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(mate.rows[1].black?.san).toBe('Qh4#');
  });

  it('writes a promotion with its piece and check', () => {
    const { moves } = scoreSheet([
      'e2e4',
      'd7d5',
      'e4d5',
      'g8f6',
      'd5d6',
      'b8d7',
      'd6c7',
      'd7b6',
      'c7d8q',
    ]);

    expect(moveLabel(moves[moves.length - 1])).toBe('5. cxd8=Q+');
  });

  it('stops at the first move the board would refuse', () => {
    const { rows } = scoreSheet(['e2e4', 'e7e5', 'e2e4']);

    expect(rows.map((row) => [row.number, row.white?.san, row.black?.san])).toEqual([
      [1, 'e4', 'e5'],
    ]);
  });

  it('has no rows before the first move', () => {
    expect(scoreSheet([])).toEqual({ moves: [], rows: [] });
  });
});

describe('move label', () => {
  it('writes White with a dot and Black with an ellipsis', () => {
    expect(moveLabel({ number: 12, side: 'white', ply: 23, san: 'e4' })).toBe('12. e4');
    expect(moveLabel({ number: 12, side: 'black', ply: 24, san: 'e5' })).toBe('12… e5');
  });
});
