import { describe, expect, it } from 'vitest';
import type { GameResult } from '../../lib/position';
import { performanceRating } from './performance';

const WIN = (): GameResult => ({ winner: 'white', reason: 'mate' });
const LOSS = (): GameResult => ({ winner: 'black', reason: 'mate' });
const DRAW = (): GameResult => ({ winner: null, reason: 'stalemate' });

describe('performanceRating', () => {
  it('moves the opponent rating by the 400-point rule around a win, a draw and a loss', () => {
    expect(performanceRating(WIN(), 'white', 2000)).toBe(2400);
    expect(performanceRating(DRAW(), 'white', 2000)).toBe(2000);
    expect(performanceRating(LOSS(), 'white', 2000)).toBe(1600);
  });

  it('reads the result from the user side', () => {
    expect(performanceRating(WIN(), 'black', 2000)).toBe(1600);
    expect(performanceRating(LOSS(), 'black', 2000)).toBe(2400);
  });

  it('has no performance without a result', () => {
    expect(performanceRating(null, 'white', 2000)).toBeNull();
  });

  it('does not go below zero for a low opponent', () => {
    expect(performanceRating(LOSS(), 'white', 600)).toBe(200);
    expect(performanceRating(LOSS(), 'white', 300)).toBe(0);
  });
});
