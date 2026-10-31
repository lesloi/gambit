import { fr } from '../../i18n/fr';

/** A motif in French, falling back to the export's tag name for one without a label yet. */
export function themeLabel(theme: string): string {
  return (fr.puzzle.themes as Record<string, string>)[theme] ?? theme;
}

/** The cost of a puzzle: the plies of its solution, not the user's moves. */
export function lengthLabel(plies: number): string {
  return plies === 1 ? fr.puzzle.lengthOne : fr.puzzle.lengthMany.replace('{count}', String(plies));
}
