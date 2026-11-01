/** The journal names a card by its mode and the id of the content it comes from. */
export type CardMode = 'puzzle' | 'endgame' | 'opening';

const CARD_MODES: readonly CardMode[] = ['puzzle', 'endgame', 'opening'];

export interface CardRef {
  mode: CardMode;
  /** The id of the content the card comes from, without the mode prefix. */
  contentId: string;
}

export function cardId(mode: CardMode, contentId: string): string {
  return `${mode}:${contentId}`;
}

/**
 * Reads a card id back. Null for a card written by another version or by hand, so a reader skips it
 * instead of inventing a mode.
 */
export function parseCardId(id: string): CardRef | null {
  const separator = id.indexOf(':');
  if (separator <= 0 || separator === id.length - 1) return null;
  const mode = id.slice(0, separator);
  if (!CARD_MODES.includes(mode as CardMode)) return null;
  return { mode: mode as CardMode, contentId: id.slice(separator + 1) };
}
