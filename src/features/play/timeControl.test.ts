import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_CONTROL_INDEX,
  formatTimeControl,
  timeControlAt,
  timeControlIndex,
  TIME_CONTROLS,
} from './timeControl';

describe('time controls', () => {
  it('defaults to the 10+0 control the game used to be fixed at', () => {
    expect(TIME_CONTROLS[DEFAULT_TIME_CONTROL_INDEX]).toEqual({
      controlMs: 600_000,
      incrementMs: 0,
    });
  });

  it('formats a control as its minutes plus its increment in seconds', () => {
    expect(formatTimeControl({ controlMs: 180_000, incrementMs: 2_000 })).toBe('3 + 2');
    expect(formatTimeControl({ controlMs: 300_000, incrementMs: 0 })).toBe('5 + 0');
    expect(formatTimeControl({ controlMs: 900_000, incrementMs: 10_000 })).toBe('15 + 10');
  });

  it('finds the preset matching a pair', () => {
    expect(timeControlIndex({ controlMs: 180_000, incrementMs: 2_000 })).toBe(1);
    expect(timeControlIndex({ controlMs: 600_000, incrementMs: 0 })).toBe(3);
    expect(timeControlIndex({ controlMs: 900_000, incrementMs: 10_000 })).toBe(4);
  });

  it('has no match for a pair it does not offer', () => {
    expect(timeControlIndex({ controlMs: 600_000, incrementMs: 10_000 })).toBe(-1);
  });

  it('clamps a preset index to the offered list', () => {
    expect(timeControlAt(-1)).toEqual(TIME_CONTROLS[0]);
    expect(timeControlAt(TIME_CONTROLS.length)).toEqual(TIME_CONTROLS[TIME_CONTROLS.length - 1]);
  });
});
