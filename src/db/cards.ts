/** The journal names a card by its mode and the id of the content it comes from. */
export type CardMode = 'puzzle' | 'endgame' | 'opening';

export function cardId(mode: CardMode, contentId: string): string {
  return `${mode}:${contentId}`;
}
