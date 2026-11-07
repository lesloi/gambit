import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_CONTROL_INDEX,
  formatTimeControl,
  PLAY_CLOCKS,
  timeControlAt,
  timeControlIndex,
} from './timeControl';

describe('time controls', () => {
  it('defaults to the 10+0 control the game used to be fixed at', () => {
    expect(PLAY_CLOCKS[DEFAULT_TIME_CONTROL_INDEX]).toEqual({
      controlMs: 600_000,
      incrementMs: 0,
    });
  });

  it('offers the untimed choice before the clocked controls', () => {
    expect(PLAY_CLOCKS[0]).toBeNull();
    expect(timeControlAt(0)).toBeNull();
    expect(timeControlIndex(null)).toBe(0);
    expect(formatTimeControl(null)).toBe('Sans pendule');
  });

  it('formats a control as its minutes plus its increment in seconds', () => {
    expect(formatTimeControl({ controlMs: 180_000, incrementMs: 2_000 })).toBe('3 + 2');
    expect(formatTimeControl({ controlMs: 300_000, incrementMs: 0 })).toBe('5 + 0');
    expect(formatTimeControl({ controlMs: 900_000, incrementMs: 10_000 })).toBe('15 + 10');
  });

  it('finds the preset matching a pair', () => {
    expect(timeControlIndex({ controlMs: 180_000, incrementMs: 2_000 })).toBe(2);
    expect(timeControlIndex({ controlMs: 600_000, incrementMs: 0 })).toBe(4);
    expect(timeControlIndex({ controlMs: 900_000, incrementMs: 10_000 })).toBe(5);
  });

  it('has no match for a pair it does not offer', () => {
    expect(timeControlIndex({ controlMs: 600_000, incrementMs: 10_000 })).toBe(-1);
  });

  it('clamps a preset index to the offered list', () => {
    expect(timeControlAt(-1)).toBeNull();
    expect(timeControlAt(PLAY_CLOCKS.length)).toEqual(PLAY_CLOCKS[PLAY_CLOCKS.length - 1]);
  });
});
