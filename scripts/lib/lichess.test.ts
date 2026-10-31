import { describe, expect, it } from 'vitest';
import { FILTERS, entryFromRow, parseExportRow, passesFilters, placePuzzle } from './lichess';

// Rows copied from the Lichess export of 2026-10-02, columns:
// PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
const FORK_ROW =
  '000Pw,6k1/5p1p/4p3/4q3/3nN3/2Q3P1/PP3P1P/6K1 w - - 2 37,e4d2 d4e2 g1f1 e2c3,1530,76,92,630,crushing endgame fork short,https://lichess.org/au2lCK5o#73,,';
const NO_MOTIF_ROW =
  '0000D,5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27,d3d6 f8d8 d6d8 f6d8,1529,74,96,37506,advantage endgame short,https://lichess.org/F8M8OS71#53,,';
const LOW_RATED_ROW =
  '009tE,6k1/6pp/p1N2p2/1pP2bP1/5P2/8/PPP5/3K4 b - - 1 28,f6g5 c6e7 g8f7 e7f5,624,91,89,856,crushing endgame fork short,https://lichess.org/fUV1iXBx/black#56,,';

describe('Lichess export row', () => {
  it('reads the columns of an export row', () => {
    const row = parseExportRow(FORK_ROW);

    expect(row).toMatchObject({
      id: '000Pw',
      rating: 1530,
      ratingDeviation: 76,
      popularity: 92,
      plays: 630,
      themes: ['crushing', 'endgame', 'fork', 'short'],
      moves: ['e4d2', 'd4e2', 'g1f1', 'e2c3'],
    });
  });

  it('tolerates the carriage return of a Windows line ending', () => {
    expect(parseExportRow(`${FORK_ROW}\r`)?.id).toBe('000Pw');
  });

  it('refuses a line that is not an export row', () => {
    expect(parseExportRow('PuzzleId,FEN,Moves,Rating')).toBeNull();
    expect(parseExportRow('')).toBeNull();
    expect(parseExportRow('000Pw,not-a-fen,,1530,76,92,630,fork,,,')).toBeNull();
  });
});

describe('entry', () => {
  it('keeps the motifs and drops the tags that describe the export', () => {
    const entry = entryFromRow(
      parseExportRow(
        '003mh,r4k1r/1pp2p2/p2p3p/3N4/3P2q1/8/PPP5/1K2Q1NR b - - 1 23,a8e8 e1e8 f8e8 d5f6 e8e7 f6g4,1325,77,86,459,advantage attraction fork long middlegame sacrifice,https://lichess.org/HSa4keKZ/black#46,,',
      )!,
    );

    expect(entry?.motifs).toEqual(['attraction', 'fork', 'sacrifice']);
  });

  it('refuses a puzzle that carries no motif', () => {
    expect(entryFromRow(parseExportRow(NO_MOTIF_ROW)!)).toBeNull();
  });
});

describe('puzzle', () => {
  const entry = entryFromRow(parseExportRow(FORK_ROW)!)!;

  it("starts the puzzle on the opponent's move, so the user plays first", () => {
    expect(placePuzzle(entry)).toEqual({
      ok: true,
      puzzle: {
        id: '000Pw',
        fen: '6k1/5p1p/4p3/4q3/3n4/2Q3P1/PP1N1P1P/6K1 b - - 3 37',
        solution: ['d4e2', 'g1f1', 'e2c3'],
        rating: 1530,
        themes: ['fork'],
      },
    });
  });

  it('refuses a line that chess.js cannot replay', () => {
    const broken = { ...entry, moves: ['d2e2', 'd4e2', 'g1f1', 'e2c3'] };

    expect(placePuzzle(broken)).toEqual({ ok: false, reason: 'illegal' });
  });

  it('refuses a line that stops before the user could move', () => {
    expect(placePuzzle({ ...entry, moves: ['e4d2'] })).toEqual({ ok: false, reason: 'illegal' });
  });
});

describe('filter', () => {
  it('keeps a puzzle inside the band with enough plays and popularity', () => {
    expect(passesFilters(parseExportRow(FORK_ROW)!, FILTERS)).toBe(true);
  });

  it('refuses a puzzle rated below the band', () => {
    expect(passesFilters(parseExportRow(LOW_RATED_ROW)!, FILTERS)).toBe(false);
  });

  it('refuses a puzzle that is too rare, too unpopular or too unsure', () => {
    const row = parseExportRow(FORK_ROW)!;

    expect(passesFilters({ ...row, plays: FILTERS.minPlays - 1 }, FILTERS)).toBe(false);
    expect(passesFilters({ ...row, popularity: FILTERS.minPopularity - 1 }, FILTERS)).toBe(false);
    expect(
      passesFilters({ ...row, ratingDeviation: FILTERS.maxRatingDeviation + 1 }, FILTERS),
    ).toBe(false);
  });
});
