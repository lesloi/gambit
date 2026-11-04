import { describe, expect, it } from 'vitest';
import { DEFAULT_ELO, HINT_SKILL, LEVELS, levelAt, levelIndex } from './level';

describe('play levels', () => {
  it('covers the range Maia was trained on, one bucket wide', () => {
    expect(LEVELS).toHaveLength(21);
    expect(LEVELS[0].elo).toBe(600);
    expect(LEVELS[LEVELS.length - 1].elo).toBe(2600);
    for (let index = 1; index < LEVELS.length; index += 1) {
      expect(LEVELS[index].elo - LEVELS[index - 1].elo).toBe(100);
    }
  });

  it('gives a stronger level a longer think time', () => {
    for (let index = 1; index < LEVELS.length; index += 1) {
      expect(LEVELS[index].movetimeMs).toBeGreaterThan(LEVELS[index - 1].movetimeMs);
    }
  });

  it('lands the default Elo on the nearest step', () => {
    expect(Math.abs(levelAt(levelIndex(DEFAULT_ELO)).elo - DEFAULT_ELO)).toBeLessThanOrEqual(50);
  });

  it('finds the nearest level for an Elo', () => {
    expect(levelIndex(600)).toBe(0);
    expect(levelIndex(1500)).toBe(9);
    expect(levelIndex(1549)).toBe(9);
    expect(levelIndex(1551)).toBe(10);
    expect(levelIndex(9999)).toBe(20);
  });

  it('clamps an index outside the slider', () => {
    expect(levelAt(-3)).toBe(LEVELS[0]);
    expect(levelAt(99)).toBe(LEVELS[20]);
  });

  it('asks the hint at full strength', () => {
    expect(HINT_SKILL).toBe(20);
  });
});
