import { fr } from '../../i18n/fr';
import type { MoveClass, MoveMark } from './review';

export const CLASS_LABEL: Record<MoveClass, string> = {
  best: fr.play.analysis.counts.best,
  excellent: fr.play.analysis.counts.excellent,
  good: fr.play.analysis.counts.good,
  inaccuracy: fr.play.analysis.counts.inaccuracy,
  mistake: fr.play.analysis.counts.mistake,
  blunder: fr.play.analysis.counts.blunder,
  'missed-win': fr.play.analysis.counts.missedWin,
  'turning-point': fr.play.analysis.counts.turningPoint,
  unknown: fr.play.analysis.unrated,
};

/** The classes the summary counts, in the order the report shows them. */
export const CLASS_ORDER: readonly MoveClass[] = [
  'best',
  'excellent',
  'good',
  'inaccuracy',
  'mistake',
  'blunder',
  'missed-win',
  'turning-point',
];

export const CLASS_TONE: Record<MoveClass, string> = {
  best: 'bg-ok-soft text-ok',
  excellent: 'bg-accent-soft text-ink',
  good: 'bg-line-soft text-ink-muted',
  inaccuracy: 'bg-line text-ink-muted',
  mistake: 'bg-bad-soft text-bad',
  blunder: 'bg-bad-soft text-bad',
  'missed-win': 'bg-accent-soft text-accent-ink',
  'turning-point': 'bg-ok-soft text-ok',
  unknown: 'bg-line text-ink-muted',
};

export const CLASS_COUNT_TONE: Record<MoveClass, string> = {
  best: 'text-ok',
  excellent: 'text-ink',
  good: 'text-ink',
  inaccuracy: 'text-ink-muted',
  mistake: 'text-bad',
  blunder: 'text-bad',
  'missed-win': 'text-accent-ink',
  'turning-point': 'text-ok',
  unknown: 'text-ink-muted',
};

export const MARK_LABEL: Record<MoveMark, string> = {
  best: fr.play.analysis.counts.best,
  inaccuracy: fr.play.analysis.counts.inaccuracy,
  mistake: fr.play.analysis.counts.mistake,
  blunder: fr.play.analysis.counts.blunder,
  'missed-win': fr.play.analysis.counts.missedWin,
  'turning-point': fr.play.analysis.counts.turningPoint,
};

export const MARK_GLYPH: Record<MoveMark, string> = {
  best: '★',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  'missed-win': '✗',
  'turning-point': '↗',
};

export const MARK_TONE: Record<MoveMark, string> = {
  best: 'text-ok',
  inaccuracy: 'text-ink-muted',
  mistake: 'text-bad',
  blunder: 'text-bad',
  'missed-win': 'text-accent-ink',
  'turning-point': 'text-ok',
};
