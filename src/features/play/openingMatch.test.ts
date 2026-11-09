import { describe, expect, it } from 'vitest';
import { START_FEN } from '../../lib/position';
import type { OpeningLine } from '../openings/opening';
import { matchOpening, sameMove } from './openingMatch';

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const LONDON: OpeningLine = {
  id: 'london',
  name: 'London',
  color: 'white',
  note: 'A line',
  moves: ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3'],
};

describe('matchOpening', () => {
  it('keeps the line when the game stops inside it', () => {
    const report = matchOpening(['d2d4', 'd7d5', 'c1f4'], 'white', START_FEN, [LONDON]);

    expect(report).toMatchObject({ line: LONDON, followed: 3, deviation: null });
  });

  it('names the user move that left the line', () => {
    const report = matchOpening(['d2d4', 'd7d5', 'e2e3'], 'white', START_FEN, [LONDON]);

    expect(report?.followed).toBe(2);
    expect(report?.deviation).toMatchObject({
      ply: 3,
      side: 'white',
      playedUci: 'e2e3',
      playedSan: 'e3',
      expectedUci: 'c1f4',
      expectedSan: 'Bf4',
    });
  });

  it('names an opponent move that left the line without blaming the user', () => {
    const report = matchOpening(['d2d4', 'g8f6', 'c1f4'], 'white', START_FEN, [LONDON]);

    expect(report?.followed).toBe(1);
    expect(report?.deviation).toMatchObject({
      ply: 2,
      side: 'black',
      playedSan: 'Nf6',
      expectedSan: 'd5',
    });
  });

  it('reports no deviation once the line has ended', () => {
    const short: OpeningLine = { ...LONDON, moves: ['e2e4'] };

    const report = matchOpening(['e2e4', 'e7e5'], 'white', START_FEN, [short]);

    expect(report).toMatchObject({ followed: 1, deviation: null });
  });

  it('matches a Black line that starts with the opponent move', () => {
    const black: OpeningLine = {
      ...LONDON,
      id: 'french',
      name: 'French',
      color: 'black',
      moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5'],
    };

    const report = matchOpening(['e2e4', 'e7e6', 'd2d4', 'd7d5'], 'black', START_FEN, [black]);

    expect(report).toMatchObject({ line: black, followed: 4, deviation: null });
  });

  it('returns null when the first move is outside the repertoire', () => {
    expect(matchOpening(['e2e4'], 'white', START_FEN, [LONDON])).toBeNull();
  });

  it('returns null for a line of the other colour', () => {
    expect(matchOpening(['d2d4'], 'black', START_FEN, [LONDON])).toBeNull();
  });

  it('returns null for a game that starts from a position', () => {
    expect(matchOpening(['e7e5'], 'black', AFTER_E4, [LONDON])).toBeNull();
  });

  it('keeps the first line in content order when two lines share the prefix', () => {
    const first: OpeningLine = { ...LONDON, id: 'first' };
    const second: OpeningLine = { ...LONDON, id: 'second', moves: ['d2d4', 'd7d5', 'g1f3'] };

    const report = matchOpening(['d2d4', 'd7d5', 'e2e3'], 'white', START_FEN, [first, second]);

    expect(report?.line.id).toBe('first');
    expect(report?.followed).toBe(2);
  });
});

describe('sameMove', () => {
  it('compares UCI moves without case and refuses a missing side', () => {
    expect(sameMove('e7e8q', 'e7e8Q')).toBe(true);
    expect(sameMove('e7e8q', 'e7e8r')).toBe(false);
    expect(sameMove(undefined, 'e7e8q')).toBe(false);
  });
});
