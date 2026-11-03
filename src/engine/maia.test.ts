import { describe, expect, it } from 'vitest';
import {
  MAIA_MOVES,
  maiaMoveIndex,
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
