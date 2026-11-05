import type { CardMode } from '../../db/cards';
import type { ModeId } from './modes';

/** Maps the card kinds the session plans to the home's mode ids; playing has no card. */
const MODE_OF_KIND: Record<CardMode, ModeId> = {
  puzzle: 'puzzles',
  endgame: 'endgames',
  opening: 'openings',
};

/**
 * The due cards of a plan, counted by mode. The plan puts its due prefix before the new cards, so
 * only the first `dueCount` cards are due; a new card must not be counted as one.
 */
export function dueCountsByMode(
  cards: readonly { kind: CardMode }[],
  dueCount: number,
): Record<ModeId, number> {
  const counts: Record<ModeId, number> = { puzzles: 0, endgames: 0, openings: 0, play: 0 };
  const limit = Math.max(0, Math.floor(dueCount));
  for (const card of cards.slice(0, limit)) {
    counts[MODE_OF_KIND[card.kind]] += 1;
  }
  return counts;
}
