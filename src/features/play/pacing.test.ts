import { describe, expect, it } from 'vitest';
import { thinkTimeMs } from './pacing';
import { TIME_CONTROLS } from './timeControl';

/** A fixed draw, so the jitter is known and the assertions stay exact. */
const steady = () => 0.5;

describe('engine pacing', () => {
  it('spends a third of an even forty-move share of the control', () => {
    // Arrange: 3+0 leaves 180 s for 40 moves, 4.5 s each, a third of it per move.
    const control = { controlMs: 3 * 60_000, incrementMs: 0 };

    // Act
    const budget = thinkTimeMs(control, control.controlMs, steady);

    // Assert
    expect(budget).toBe(1_500);
  });

  it('adds the increment to what a move may spend', () => {
    const control = { controlMs: 3 * 60_000, incrementMs: 2_000 };

    expect(thinkTimeMs(control, control.controlMs, steady)).toBe(3_500);
  });

  it('caps a long control so the game keeps moving', () => {
    const rapid = { controlMs: 10 * 60_000, incrementMs: 0 };
    const classical = { controlMs: 15 * 60_000, incrementMs: 10_000 };

    expect(thinkTimeMs(rapid, rapid.controlMs, steady)).toBe(4_000);
    expect(thinkTimeMs(classical, classical.controlMs, steady)).toBe(4_000);
  });

  it('keeps a floor on a control too short for the share', () => {
    const bullet = { controlMs: 60_000, incrementMs: 0 };

    expect(thinkTimeMs(bullet, bullet.controlMs, steady)).toBe(500);
  });

  it('never spends more than a fifth of the time left', () => {
    // Arrange: 10+0 with ten seconds on the engine's clock.
    const control = TIME_CONTROLS[3];

    // Act
    const budget = thinkTimeMs(control, 10_000, steady);

    // Assert
    expect(budget).toBe(2_000);
  });

  it('thinks less and less as the clock drains', () => {
    const control = TIME_CONTROLS[0];

    // Act: a second left is worth a fifth of it, not the level's share.
    const budget = thinkTimeMs(control, 1_000, steady);

    // Assert
    expect(budget).toBe(200);
  });

  it('asks for no time at all on a clock already flagged', () => {
    expect(thinkTimeMs(TIME_CONTROLS[0], 0, steady)).toBe(0);
  });

  it('varies the think time around the share by a fifth', () => {
    const control = { controlMs: 3 * 60_000, incrementMs: 0 };

    expect(thinkTimeMs(control, control.controlMs, () => 0)).toBe(1_200);
    expect(thinkTimeMs(control, control.controlMs, () => 1)).toBe(1_800);
  });
});
