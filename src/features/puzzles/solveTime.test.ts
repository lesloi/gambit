import { describe, expect, it } from 'vitest';
import { formatSolveTime } from './solveTime';

describe('formatSolveTime', () => {
  it('shows whole seconds under a minute', () => {
    const cases = [0, 1, 999, 1_000, 24_000, 59_999];
    const expected = ['0:00', '0:00', '0:00', '0:01', '0:24', '0:59'];

    const shown = cases.map(formatSolveTime);

    expect(shown).toEqual(expected);
  });

  it('rolls over to minutes at one minute', () => {
    expect(formatSolveTime(60_000)).toBe('1:00');
    expect(formatSolveTime(61_000)).toBe('1:01');
    expect(formatSolveTime(599_000)).toBe('9:59');
    expect(formatSolveTime(3_599_000)).toBe('59:59');
  });

  it('adds the hour past sixty minutes', () => {
    expect(formatSolveTime(3_600_000)).toBe('1:00:00');
    expect(formatSolveTime(3_661_000)).toBe('1:01:01');
    expect(formatSolveTime(7_384_000)).toBe('2:03:04');
  });

  it('never shows a negative time', () => {
    expect(formatSolveTime(-1)).toBe('0:00');
    expect(formatSolveTime(-60_000)).toBe('0:00');
  });
});
