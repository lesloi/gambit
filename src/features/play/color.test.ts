import { describe, expect, it } from 'vitest';
import { drawColor, isPlayColor } from './color';

describe('play colour', () => {
  it('keeps a fixed side whatever the draw', () => {
    expect(drawColor('white', () => 0.9)).toBe('white');
    expect(drawColor('black', () => 0.1)).toBe('black');
  });

  it('draws a side on a random choice, White below one half', () => {
    expect(drawColor('random', () => 0)).toBe('white');
    expect(drawColor('random', () => 0.499_999)).toBe('white');
    expect(drawColor('random', () => 0.5)).toBe('black');
    expect(drawColor('random', () => 0.999_999)).toBe('black');
  });

  it('recognises only the colours the setup offers', () => {
    for (const value of ['white', 'black', 'random']) {
      expect(isPlayColor(value), value).toBe(true);
    }
    for (const value of [null, undefined, 'red', 'White', 42, {}, []]) {
      expect(isPlayColor(value), JSON.stringify(value)).toBe(false);
    }
  });
});
