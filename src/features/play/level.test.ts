import { describe, expect, it } from 'vitest';
import { DEFAULT_ELO, HINT_SKILL, LEVELS, levelAt, levelIndexIn, levelsFor } from './level';

describe('play levels', () => {
  it('offers eleven Stockfish levels from its floor to full strength', () => {
    const levels = levelsFor('stockfish');

    expect(levels).toHaveLength(11);
    expect(levels[0]).toMatchObject({ elo: 1350, skill: 0 });
    expect(levels[10]).toMatchObject({ elo: 2850, skill: 20 });
  });

  it('raises the Stockfish skill with the level', () => {
    const levels = levelsFor('stockfish');

    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index].skill).toBeGreaterThan(levels[index - 1].skill);
    }
  });

  it('covers the range Maia was trained on, one bucket wide', () => {
    const levels = levelsFor('maia');

    expect(levels).toHaveLength(21);
    expect(levels[0].elo).toBe(600);
    expect(levels[levels.length - 1].elo).toBe(2600);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index].elo - levels[index - 1].elo).toBe(100);
    }
  });

  it('gives both opponents a think time that grows with the level', () => {
    for (const opponent of ['stockfish', 'maia'] as const) {
      const levels = levelsFor(opponent);
      for (let index = 1; index < levels.length; index += 1) {
        expect(levels[index].movetimeMs).toBeGreaterThan(levels[index - 1].movetimeMs);
      }
    }
  });

  it('lands the default Elo on the nearest step of either list', () => {
    for (const opponent of ['stockfish', 'maia'] as const) {
      const levels = levelsFor(opponent);
      const shown = levelAt(levels, levelIndexIn(levels, DEFAULT_ELO)).elo;
      expect(Math.abs(shown - DEFAULT_ELO)).toBeLessThanOrEqual(50);
    }
  });

  it('finds the nearest level for an Elo', () => {
    const levels = LEVELS.stockfish;

    expect(levelIndexIn(levels, 1500)).toBe(1);
    expect(levelIndexIn(levels, 1574)).toBe(1);
    expect(levelIndexIn(levels, 1576)).toBe(2);
    expect(levelIndexIn(levels, 9999)).toBe(10);
  });

  it('clamps an index outside the slider', () => {
    const levels = LEVELS.stockfish;

    expect(levelAt(levels, -3)).toBe(levels[0]);
    expect(levelAt(levels, 99)).toBe(levels[10]);
  });

  it('asks the hint at full strength', () => {
    expect(HINT_SKILL).toBe(20);
  });
});
