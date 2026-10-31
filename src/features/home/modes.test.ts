import { describe, expect, it } from 'vitest';
import { fr } from '../../i18n/fr';
import { MODES } from './modes';

describe('training modes', () => {
  it('exposes the four modes of the first version', () => {
    expect(MODES.map((mode) => mode.id)).toEqual(['puzzles', 'endgames', 'openings', 'play']);
  });

  it('names and describes every mode in French', () => {
    for (const mode of MODES) {
      expect(fr.modes[mode.id].name.length).toBeGreaterThan(0);
      expect(fr.modes[mode.id].goal.length).toBeGreaterThan(0);
    }
  });

  it('marks the puzzle demo as the only available mode', () => {
    expect(MODES.filter((mode) => mode.available).map((mode) => mode.id)).toEqual(['puzzles']);
  });

  it('groups the three training modes apart from playing', () => {
    expect(MODES.filter((mode) => mode.group === 'train').map((mode) => mode.id)).toEqual([
      'puzzles',
      'endgames',
      'openings',
    ]);
    expect(MODES.filter((mode) => mode.group === 'play').map((mode) => mode.id)).toEqual(['play']);
  });
});
