import { fr } from '../../i18n/fr';
import { ratingBand } from './content';

/** A motif in French, falling back to the export's tag name for one without a label yet. */
export function themeLabel(theme: string): string {
  return (fr.puzzle.themes as Record<string, string>)[theme] ?? theme;
}

/** The named level a rating falls in, shown beside the number so both readers find their mark. */
export function levelLabel(rating: number): string {
  return fr.puzzle.setup.ratings[ratingBand(rating)];
}

/** The cost of a puzzle: the plies of its solution, not the user's moves. */
export function lengthLabel(plies: number): string {
  return plies === 1 ? fr.puzzle.lengthOne : fr.puzzle.lengthMany.replace('{count}', String(plies));
}
