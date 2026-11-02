import { describe, expect, it } from 'vitest';
import { afterMove, createClock, flagged, formatClock, remainingMs, stopClock } from './clock';

const T0 = 1_000_000;
const TEN_MINUTES = 600_000;

describe('play clock', () => {
  it('starts full and idle', () => {
    const clock = createClock(TEN_MINUTES);

    expect(remainingMs(clock, T0)).toEqual({ white: TEN_MINUTES, black: TEN_MINUTES });
    expect(flagged(clock, T0)).toBeNull();
  });

  it('does not charge the first move, then runs the opponent clock', () => {
    const clock = afterMove(createClock(TEN_MINUTES), 'white', T0);

    expect(remainingMs(clock, T0 + 5_000)).toEqual({ white: TEN_MINUTES, black: 595_000 });
  });

  it('charges the elapsed time to the side that moved', () => {
    const clock = afterMove(createClock(TEN_MINUTES), 'white', T0);
    const next = afterMove(clock, 'black', T0 + 5_000);

    expect(remainingMs(next, T0 + 8_000)).toEqual({ white: 597_000, black: 595_000 });
  });

  it('flags the side whose clock reached zero', () => {
    const clock = afterMove(createClock(TEN_MINUTES), 'white', T0);

    expect(flagged(clock, T0 + 599_999)).toBeNull();
    expect(flagged(clock, T0 + 600_000)).toBe('black');
    expect(remainingMs(clock, T0 + 900_000)).toEqual({ white: TEN_MINUTES, black: 0 });
  });

  it('stops the clock and keeps the time left', () => {
    const clock = afterMove(createClock(TEN_MINUTES), 'white', T0);
    const stopped = stopClock(clock, T0 + 5_000);

    expect(remainingMs(stopped, T0 + 60_000)).toEqual({ white: TEN_MINUTES, black: 595_000 });
    expect(flagged(stopped, T0 + 60_000)).toBeNull();
  });

  it('formats the remaining time as minutes and seconds', () => {
    expect(formatClock(TEN_MINUTES)).toBe('10:00');
    expect(formatClock(599_001)).toBe('10:00');
    expect(formatClock(599_000)).toBe('9:59');
    expect(formatClock(9_000)).toBe('0:09');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-500)).toBe('0:00');
  });
});
