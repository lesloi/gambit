import { describe, expect, it } from 'vitest';
import { fr } from '../../i18n/fr';
import { hintNudge } from './labels';

describe('hintNudge', () => {
  it('gives the nudge of a motif family, never the motif name', () => {
    const nudge = hintNudge(['fork']);

    expect(nudge).toBe(fr.puzzle.hints.fork);
    expect(nudge).not.toBe(fr.puzzle.themes.fork);
  });

  it('prefers the mate over the sacrifice that sets it up', () => {
    expect(hintNudge(['sacrifice', 'backRankMate', 'mateIn2'])).toBe(fr.puzzle.hints.mate);
  });

  it('reads the quiet move before the endgame that holds it', () => {
    expect(hintNudge(['pawnEndgame', 'quietMove'])).toBe(fr.puzzle.hints.defence);
  });

  it('falls back to a generic nudge for a motif it does not know', () => {
    expect(hintNudge(['brandNewMotif'])).toBe(fr.puzzle.hints.loose);
    expect(hintNudge([])).toBe(fr.puzzle.hints.loose);
  });
});
