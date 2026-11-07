import type { Score } from '../../engine/uci';
import type { Side } from '../../lib/position';
import { userScore, winPercent, WINNING_WIN_PERCENT } from './analysis';

/** How long Stockfish looks at the position a game starts from, in milliseconds. */
export const START_EVAL_MOVETIME_MS = 300;

/** The chance below which the start position is called difficult. */
export const DIFFICULT_WIN_PERCENT = 30;

export type StartLabel = 'winning' | 'even' | 'difficult' | 'mate-for' | 'mate-against';

export interface StartVerdict {
  label: StartLabel;
  /** The user's chance to win, rounded to a percentage. */
  winPercent: number;
  /** The evaluation from the user's side: "+2,3", "-1,2" or "M5". */
  score: string;
}

/**
 * What the position a game starts from is worth to the user. Mate and the two thresholds use the
 * same winning chance as the game review, so the badge, the blunders and the end verdict agree.
 */
export function startVerdict(score: Score, turn: Side, userColor: Side): StartVerdict | null {
  const user = userScore(score, turn, userColor);
  if (user.cp === null && user.mate === null) return null;

  const chance = Math.round(winPercent(user));
  if (user.mate !== null) {
    return {
      label: user.mate > 0 ? 'mate-for' : 'mate-against',
      winPercent: chance,
      score: user.mate > 0 ? `M${user.mate}` : `-M${-user.mate}`,
    };
  }

  const label: StartLabel =
    chance >= WINNING_WIN_PERCENT
      ? 'winning'
      : chance <= DIFFICULT_WIN_PERCENT
        ? 'difficult'
        : 'even';

  return { label, winPercent: chance, score: formatScore(user.cp ?? 0) };
}

/** A pawn score with one decimal, a plus sign and the French comma. */
function formatScore(cp: number): string {
  const pawns = (cp / 100).toFixed(1).replace('.', ',');
  return cp > 0 ? `+${pawns}` : pawns;
}
