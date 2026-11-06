import { describe, expect, it } from 'vitest';
import { elapsedMs, pauseClock, resumeClock, startClock } from './solveClock';

describe('solve clock', () => {
  it('counts the time it has been running', () => {
    const clock = startClock(1_000);

    expect(elapsedMs(clock, 1_000)).toBe(0);
    expect(elapsedMs(clock, 4_000)).toBe(3_000);
  });

  it('can start paused for a puzzle opened in a hidden tab', () => {
    const clock = startClock(1_000, false);

    expect(elapsedMs(clock, 9_000)).toBe(0);
    expect(elapsedMs(resumeClock(clock, 9_000), 10_000)).toBe(1_000);
  });

  it('stops counting while paused and resumes from the total', () => {
    const paused = pauseClock(startClock(1_000), 4_000);

    expect(elapsedMs(paused, 60_000)).toBe(3_000);

    const resumed = resumeClock(paused, 60_000);

    expect(elapsedMs(resumed, 62_000)).toBe(5_000);
  });

  it('keeps every pause out of the total across several absences', () => {
    const first = resumeClock(pauseClock(startClock(0), 2_000), 10_000);
    const second = pauseClock(first, 12_000);

    expect(elapsedMs(second, 90_000)).toBe(4_000);
  });

  it('ignores a pause on a paused clock and a resume on a running clock', () => {
    const paused = pauseClock(startClock(0), 1_000);

    expect(pauseClock(paused, 5_000)).toEqual(paused);

    const running = startClock(0);

    expect(resumeClock(running, 5_000)).toEqual(running);
  });

  it('never counts backwards when the timestamps jump', () => {
    const running = startClock(5_000);

    expect(elapsedMs(running, 4_000)).toBe(0);
    expect(pauseClock(running, 4_000)).toEqual({ elapsed: 0, since: null });
  });
});
