import { describe, expect, it } from 'vitest';
import { materialOf } from './material';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const AFTER_EXD5 = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';
const AFTER_KXF7 = 'r1bq3r/pppp1kpp/2n5/2b1p3/4P3/8/PPPP1PPP/RNBQK2R w KQ - 0 7';
const AFTER_BXA8Q = 'Qnbqkb1r/p3pppp/8/8/6n1/8/PPPP1PPP/RNBQKBNR b KQk - 0 5';

describe('materialOf', () => {
  it('starts even with nothing taken', () => {
    expect(materialOf(START, [])).toEqual({
      captured: { white: [], black: [] },
      advantage: 0,
    });
  });

  it('counts a taken pawn as one point of advantage', () => {
    expect(materialOf(AFTER_EXD5, ['e2e4', 'd7d5', 'e4d5'])).toEqual({
      captured: { white: ['p'], black: [] },
      advantage: 1,
    });
  });

  it('counts an en passant capture like any other', () => {
    const material = materialOf('rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3', [
      'e2e4',
      'a7a6',
      'e4e5',
      'd7d5',
      'e5d6',
    ]);

    expect(material).toEqual({ captured: { white: ['p'], black: [] }, advantage: 1 });
  });

  it('sorts each list heaviest first and keeps the order of equal pieces', () => {
    const moves = [
      'e2e4',
      'e7e5',
      'g1f3',
      'b8c6',
      'f1c4',
      'f8c5',
      'f3g5',
      'g8h6',
      'g5f7',
      'h6f7',
      'c4f7',
      'e8f7',
    ];

    expect(materialOf(AFTER_KXF7, moves)).toEqual({
      captured: { white: ['n', 'p'], black: ['n', 'b'] },
      advantage: -2,
    });
  });

  it('counts a promotion as material while the captured list stays the taken pieces', () => {
    const moves = ['e2e4', 'd7d5', 'e4d5', 'c7c6', 'd5c6', 'g8f6', 'c6b7', 'f6g4', 'b7a8q'];

    expect(materialOf(AFTER_BXA8Q, moves)).toEqual({
      captured: { white: ['r', 'p', 'p', 'p'], black: [] },
      advantage: 16,
    });
  });

  it('reads the advantage from the board when no move is replayed', () => {
    expect(materialOf('4k3/8/8/8/8/8/8/4K2Q w - - 0 1', [])).toEqual({
      captured: { white: [], black: [] },
      advantage: 9,
    });
  });

  it('stops at the first move the board would refuse', () => {
    expect(materialOf(AFTER_E5, ['e2e4', 'e7e5', 'e2e4'])).toEqual({
      captured: { white: [], black: [] },
      advantage: 0,
    });
  });
});
