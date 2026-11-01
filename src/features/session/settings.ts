import { RATING_BANDS, type PuzzleBand } from '../puzzles/content';
import { browserStorage, type SessionStorage } from './storage';

export interface SessionSettings {
  /** How many new cards the next session introduces. */
  newCards: number;
  /** The rating band the new puzzle cells come from; the due cells follow the journal. */
  band: PuzzleBand;
}

/** Five new cards, and the low band as the cold-start prior (DECISIONS.md#product). */
export const DEFAULT_SESSION_SETTINGS: SessionSettings = { newCards: 5, band: 'low' };

export const NEW_CARD_CHOICES = [0, 3, 5, 10, 15] as const;

export const SESSION_SETTINGS_STORAGE_KEY = 'gambit:session-settings';

/** A preference, out of the backup like the puzzle filters: losing it only costs the default. */
export function readSessionSettings(
  storage: SessionStorage | null = browserStorage(),
): SessionSettings {
  if (!storage) return DEFAULT_SESSION_SETTINGS;

  try {
    const raw = storage.getItem(SESSION_SETTINGS_STORAGE_KEY);
    if (raw === null) return DEFAULT_SESSION_SETTINGS;
    return toSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SESSION_SETTINGS;
  }
}

export function saveSessionSettings(
  settings: SessionSettings,
  storage: SessionStorage | null = browserStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(
      SESSION_SETTINGS_STORAGE_KEY,
      JSON.stringify({ newCards: settings.newCards, band: settings.band }),
    );
  } catch {
    // A full or blocked storage only costs the preference; the screen keeps working.
  }
}

/** Each field is checked on its own, so a future band resets one value instead of both. */
function toSettings(value: unknown): SessionSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return DEFAULT_SESSION_SETTINGS;
  }

  const { newCards, band } = value as Record<string, unknown>;
  return {
    newCards: isNewCardChoice(newCards) ? newCards : DEFAULT_SESSION_SETTINGS.newCards,
    band: isBand(band) ? band : DEFAULT_SESSION_SETTINGS.band,
  };
}

function isNewCardChoice(value: unknown): value is number {
  return NEW_CARD_CHOICES.includes(value as (typeof NEW_CARD_CHOICES)[number]);
}

function isBand(value: unknown): value is PuzzleBand {
  return RATING_BANDS.includes(value as PuzzleBand);
}
