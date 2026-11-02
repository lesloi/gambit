import { describe, expect, it } from 'vitest';
import { movePairs } from './notation';

describe('score sheet', () => {
  it('pairs the moves two per row, numbered from one', () => {
    const pairs = movePairs(['e2e4', 'e7e5', 'g1f3', 'b8c6']);

    expect(pairs).toEqual([
      { number: 1, white: 'e4', black: 'e5' },
      { number: 2, white: 'Nf3', black: 'Nc6' },
    ]);
  });

  it('leaves Black empty while White made the last move', () => {
    const pairs = movePairs(['e2e4', 'e7e5', 'g1f3']);

    expect(pairs[pairs.length - 1]).toEqual({ number: 2, white: 'Nf3', black: null });
  });

  it('writes castling and check in standard notation', () => {
    const pairs = movePairs(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6', 'e1g1']);

    expect(pairs[2]).toEqual({ number: 3, white: 'Bb5', black: 'Nf6' });
    expect(pairs[3]).toEqual({ number: 4, white: 'O-O', black: null });

    const mate = movePairs(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(mate[1]).toEqual({ number: 2, white: 'g4', black: 'Qh4#' });
  });

  it('stops at the first move the board would refuse', () => {
    const pairs = movePairs(['e2e4', 'e7e5', 'e2e4']);

    expect(pairs).toEqual([{ number: 1, white: 'e4', black: 'e5' }]);
  });

  it('has no rows before the first move', () => {
    expect(movePairs([])).toEqual([]);
  });
});
