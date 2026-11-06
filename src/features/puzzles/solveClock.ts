/**
 * A stopwatch for one attempt. It only counts the time it is running, so a hidden tab pauses it
 * without charging the absence; stopping it is a pause that is never resumed.
 */
export interface SolveClock {
  /** Milliseconds accumulated by the segments that already ran. */
  elapsed: number;
  /** When the running segment started, or null when the clock is paused. */
  since: number | null;
}

export function startClock(now: number, running = true): SolveClock {
  return { elapsed: 0, since: running ? now : null };
}

export function pauseClock(clock: SolveClock, now: number): SolveClock {
  if (clock.since === null) return clock;
  return { elapsed: clock.elapsed + Math.max(0, now - clock.since), since: null };
}

/** Continues a paused clock; a clock already running keeps its current segment. */
export function resumeClock(clock: SolveClock, now: number): SolveClock {
  return clock.since === null ? { ...clock, since: now } : clock;
}

export function elapsedMs(clock: SolveClock, now: number): number {
  if (clock.since === null) return clock.elapsed;
  return clock.elapsed + Math.max(0, now - clock.since);
}
