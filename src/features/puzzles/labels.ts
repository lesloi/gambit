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

const SACRIFICE = new Set([
  'sacrifice',
  'attraction',
  'deflection',
  'clearance',
  'interference',
  'intermezzo',
]);
const ATTACK_TWO = new Set(['fork', 'doubleCheck', 'discoveredAttack', 'discoveredCheck']);
const ALIGNED = new Set(['skewer', 'xRayAttack']);
const BLOCKED = new Set(['pin', 'capturingDefender']);
const QUIET = new Set(['quietMove', 'defensiveMove', 'zugzwang']);
const PROMOTION = new Set(['promotion', 'underPromotion', 'advancedPawn', 'enPassant']);
const ATTACK = new Set(['kingsideAttack', 'queensideAttack', 'attackingF2F7', 'exposedKing']);

/**
 * The families, in the order they win when a puzzle carries several motifs: a mate is what the
 * line is for, whatever sets it up. The export sorts its tags, so the order cannot come from it.
 */
const HINT_FAMILIES: readonly {
  nudge: keyof typeof fr.puzzle.hints;
  matches: (theme: string) => boolean;
}[] = [
  {
    nudge: 'mate',
    matches: (theme) => theme.startsWith('mateIn') || theme.endsWith('Mate'),
  },
  { nudge: 'sacrifice', matches: (theme) => SACRIFICE.has(theme) },
  { nudge: 'fork', matches: (theme) => ATTACK_TWO.has(theme) },
  { nudge: 'line', matches: (theme) => ALIGNED.has(theme) },
  { nudge: 'pin', matches: (theme) => BLOCKED.has(theme) },
  { nudge: 'defence', matches: (theme) => QUIET.has(theme) },
  { nudge: 'promotion', matches: (theme) => PROMOTION.has(theme) },
  { nudge: 'endgame', matches: (theme) => theme.endsWith('Endgame') },
  { nudge: 'attack', matches: (theme) => ATTACK.has(theme) },
];

/** The sentence a first hint gives: the family of the motif, not its name. */
export function hintNudge(themes: readonly string[]): string {
  const family = HINT_FAMILIES.find(({ matches }) => themes.some(matches));
  return fr.puzzle.hints[family?.nudge ?? 'loose'];
}
