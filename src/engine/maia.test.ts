import { describe, expect, it } from 'vitest';
import {
  MAIA_HISTORY,
  MAIA_MOVES,
  maiaMoveIndex,
  maiaTokens,
  mirrorFen,
  mirrorMove,
  movePolicy,
  sampleMove,
  seededRandom,
} from './maia';

describe('Maia move space', () => {
  it('lists every from/to pair, then the promotions, in upstream order', () => {
    expect(MAIA_MOVES).toHaveLength(4352);
    expect(MAIA_MOVES[0]).toBe('a1a1');
    // e2 is square 12, e4 is square 28: 12 * 64 + 28.
    expect(MAIA_MOVES[796]).toBe('e2e4');
    expect(MAIA_MOVES[4096]).toBe('a7a8q');
    expect(MAIA_MOVES[4351]).toBe('h7h8n');
  });

  it('finds a move in the space and reports an unknown one', () => {
    expect(maiaMoveIndex('e2e4')).toBe(796);
    expect(maiaMoveIndex('e9e4')).toBeUndefined();
  });

  it('mirrors a move across the board and back', () => {
    expect(mirrorMove('e2e4')).toBe('e7e5');
    expect(mirrorMove(mirrorMove('g1f3'))).toBe('g1f3');
  });

  it('keeps the promotion piece when it mirrors a promotion', () => {
    expect(mirrorMove('a7a8q')).toBe('a2a1q');
  });
});

describe('Maia policy', () => {
  it('gives the whole probability to the top move at temperature zero', () => {
    const logits = [0, 3, 1];

    const policy = movePolicy(logits, [0, 1, 2], 0);

    expect(policy).toEqual([{ index: 1, probability: 1 }]);
  });

  it('spreads the probability over the legal moves only', () => {
    const logits = [0, 1, 5]; // the top logit belongs to a move that is not legal

    const policy = movePolicy(logits, [0, 1], 1);

    expect(policy.map((move) => move.index)).toEqual([0, 1]);
    expect(policy[1].probability).toBeGreaterThan(policy[0].probability);
    expect(policy.reduce((sum, move) => sum + move.probability, 0)).toBeCloseTo(1, 10);
  });

  it('keeps the ranking at a low temperature and flattens it at a high one', () => {
    const logits = [0, 1];

    const cold = movePolicy(logits, [0, 1], 0.1);
    const hot = movePolicy(logits, [0, 1], 10);

    expect(cold[1].probability).toBeGreaterThan(hot[1].probability);
  });

  it('falls back to the top move when the temperature is too low to divide', () => {
    const policy = movePolicy([1, 0], [0, 1], 1e-320);

    expect(policy).toEqual([{ index: 0, probability: 1 }]);
  });

  it('has nothing to draw when no move is legal', () => {
    expect(movePolicy([0, 1], [], 1)).toEqual([]);
    expect(sampleMove([], seededRandom(1))).toBeNull();
  });
});

describe('Maia sampler', () => {
  it('draws the same move from the same seed', () => {
    const policy = movePolicy([0, 1, 1], [0, 1, 2], 1);

    const first = sampleMove(policy, seededRandom(42));
    const second = sampleMove(policy, seededRandom(42));

    expect(first).toBe(second);
  });

  it('draws from the whole distribution over many games', () => {
    const policy = movePolicy([0, 0, 0], [0, 1, 2], 1);
    const random = seededRandom(7);

    const drawn = new Set(Array.from({ length: 60 }, () => sampleMove(policy, random)));

    expect(drawn).toEqual(new Set([0, 1, 2]));
  });

  it('never draws outside the policy', () => {
    const policy = movePolicy([5, 0, 0], [1], 1);
    const random = seededRandom(3);

    const drawn = Array.from({ length: 20 }, () => sampleMove(policy, random));

    expect(new Set(drawn)).toEqual(new Set([1]));
  });
});

describe('Maia position tokens', () => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('writes the twelve planes of every position, oldest first', () => {
    const tokens = maiaTokens([START]);

    expect(tokens).toHaveLength(64 * 12 * MAIA_HISTORY);
    // a2 is square 8, and a white pawn is plane 0 of the first position.
    expect(tokens[8 * 12 * MAIA_HISTORY]).toBe(1);
    // a7 is square 48, and a black pawn is plane 6.
    expect(tokens[48 * 12 * MAIA_HISTORY + 6]).toBe(1);
    // The same square one position later is twelve channels along, not a block of its own.
    expect(tokens[8 * 12 * MAIA_HISTORY + 12]).toBe(1);
  });

  it('pads a young game with its first position', () => {
    const tokens = maiaTokens([START]);
    const stride = 12 * MAIA_HISTORY;

    for (let position = 1; position < MAIA_HISTORY; position += 1) {
      expect(tokens[8 * stride + position * 12]).toBe(1);
    }
  });

  it('reads a Black position from White’s side of the board', () => {
    const afterBlack = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const mirrored = mirrorFen(afterBlack);

    expect(maiaTokens([afterBlack])).toEqual(maiaTokens([mirrored]));
  });

  it('puts the board back when a position is mirrored twice', () => {
    const black = 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq e3 4 1';

    // The model always reads White to move, so a mirrored position says `w`, not `b`.
    expect(mirrorFen(mirrorFen(black))).toBe('r3k2r/8/8/8/8/8/8/R3K2R w KQkq e3 4 1');
  });
});
