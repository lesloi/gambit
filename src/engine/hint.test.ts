import { describe, expect, it } from 'vitest';
import { HINT_SKILL } from './hint';

describe('hint strength', () => {
  it('asks the hint at full strength', () => {
    expect(HINT_SKILL).toBe(20);
  });
});
