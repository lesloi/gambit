import { describe, expect, it } from 'vitest';
import { DEFAULT_LEVEL_INDEX, HINT_SKILL, LEVELS, levelAt, levelIndex } from './level';

describe('play levels', () => {
  it('offers eleven levels from the engine floor to full strength', () => {
    expect(LEVELS).toHaveLength(11);
    expect(LEVELS[0]).toMatchObject({ elo: 1350, skill: 0 });
    expect(LEVELS[10]).toMatchObject({ elo: 2850, skill: 20 });
  });

  it('raises the skill and the think time with the level', () => {
    for (let index = 1; index < LEVELS.length; index += 1) {
      expect(LEVELS[index].skill).toBeGreaterThan(LEVELS[index - 1].skill);
      expect(LEVELS[index].movetimeMs).toBeGreaterThan(LEVELS[index - 1].movetimeMs);
    }
  });

  it('keeps the default in the list', () => {
    expect(levelAt(DEFAULT_LEVEL_INDEX)).toBe(LEVELS[DEFAULT_LEVEL_INDEX]);
  });

  it('finds the nearest level for a stored Elo', () => {
    expect(levelIndex(1500)).toBe(1);
    expect(levelIndex(1510)).toBe(1);
    expect(levelIndex(1574)).toBe(1);
    expect(levelIndex(1576)).toBe(2);
    expect(levelIndex(9999)).toBe(10);
  });

  it('clamps an index outside the slider', () => {
    expect(levelAt(-3)).toBe(LEVELS[0]);
    expect(levelAt(99)).toBe(LEVELS[10]);
  });

  it('asks the hint at full strength', () => {
    expect(HINT_SKILL).toBe(20);
  });
});
