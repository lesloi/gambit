import { fr } from '../../i18n/fr';

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

/**
 * The setup's choices: no clock first, then the presets. The untimed choice is a real entry, not
 * a 0/0 sentinel that the stored preference or the resume card would misread.
 */
export const PLAY_CLOCKS: readonly (TimeControl | null)[] = [null, ...TIME_CONTROLS];

export const DEFAULT_TIME_CONTROL_INDEX = PLAY_CLOCKS.indexOf(DEFAULT_TIME_CONTROL);

export function timeControlAt(index: number): TimeControl | null {
  const clamped = Math.min(Math.max(Math.round(index), 0), PLAY_CLOCKS.length - 1);
  return PLAY_CLOCKS[clamped] ?? null;
}

/** The preset a stored pair names, or the untimed choice for null; -1 when it is not offered. */
export function timeControlIndex(control: TimeControl | null): number {
  if (control === null) return PLAY_CLOCKS.indexOf(null);

  return PLAY_CLOCKS.findIndex(
    (preset) =>
      preset !== null &&
      preset.controlMs === control.controlMs &&
      preset.incrementMs === control.incrementMs,
  );
}

/** Chess convention: minutes plus increment in seconds; "Sans pendule" when there is no clock. */
export function formatTimeControl(control: TimeControl | null): string {
  if (control === null) return fr.play.untimed;
  return `${control.controlMs / 60_000} + ${control.incrementMs / 1_000}`;
}
