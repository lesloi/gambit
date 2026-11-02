export interface TimeControl {
  /** How much time each side starts with, in milliseconds. */
  controlMs: number;
  /** How much time a side gains after each move, in milliseconds. */
  incrementMs: number;
}

/** 10+0, the control the game was fixed at before the choice existed. */
const DEFAULT_TIME_CONTROL: TimeControl = { controlMs: 10 * 60_000, incrementMs: 0 };

export const TIME_CONTROLS: readonly TimeControl[] = [
  { controlMs: 3 * 60_000, incrementMs: 0 },
  { controlMs: 3 * 60_000, incrementMs: 2_000 },
  { controlMs: 5 * 60_000, incrementMs: 0 },
  DEFAULT_TIME_CONTROL,
  { controlMs: 15 * 60_000, incrementMs: 10_000 },
];

export const DEFAULT_TIME_CONTROL_INDEX = TIME_CONTROLS.indexOf(DEFAULT_TIME_CONTROL);

export function timeControlAt(index: number): TimeControl {
  const clamped = Math.min(Math.max(Math.round(index), 0), TIME_CONTROLS.length - 1);
  return TIME_CONTROLS[clamped];
}

/** The preset a stored pair names, or -1 when it is not one the screen offers. */
export function timeControlIndex(control: TimeControl): number {
  return TIME_CONTROLS.findIndex(
    (preset) =>
      preset.controlMs === control.controlMs && preset.incrementMs === control.incrementMs,
  );
}

/** Chess convention: minutes plus increment in seconds, as on a scoresheet or a pairing list. */
export function formatTimeControl(control: TimeControl): string {
  return `${control.controlMs / 60_000} + ${control.incrementMs / 1_000}`;
}
