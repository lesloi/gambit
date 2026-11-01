import { describe, expect, it } from 'vitest';
import type { Endgame } from '../endgames/endgame';
import type { OpeningLine } from '../openings/opening';
import type { Puzzle } from '../puzzles/puzzle';
import { cellId, primaryTheme, sessionCatalog } from './catalog';

function puzzle(id: string, themes: string[], rating: number): Puzzle {
  return {
    id,
    fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    solution: ['a1a2'],
    themes,
    rating,
    fullLine: true,
  };
}

const endgame: Endgame = {
  id: 'kqk',
  name: 'Dame contre roi',
  fen: '8/8/8/4k3/8/8/5K2/6Q1 w - - 0 1',
  result: 'win',
  goal: 'Mater.',
};

const opening: OpeningLine = {
  id: 'london',
  name: 'London',
  color: 'white',
  moves: ['d2d4', 'd7d5'],
};

describe('primaryTheme', () => {
  it('takes the rarest theme, so a common tag does not swallow the others', () => {
    const counts = new Map([
      ['fork', 10],
      ['pin', 2],
    ]);

    expect(primaryTheme(['fork', 'pin'], counts)).toBe('pin');
  });

  it('breaks a tie alphabetically, like the content pipeline', () => {
    const counts = new Map([
      ['pin', 2],
      ['fork', 2],
    ]);

    expect(primaryTheme(['pin', 'fork'], counts)).toBe('fork');
  });
});

describe('the session catalog', () => {
  // fork and pin appear the same number of times, so the first alphabetically wins the tie.
  const puzzles = [
    puzzle('a', ['fork', 'pin'], 900),
    puzzle('b', ['fork'], 1000),
    puzzle('c', ['pin'], 1300),
    puzzle('d', ['fork', 'pin'], 1700),
    puzzle('no-theme', [], 1200),
  ];
  const catalog = sessionCatalog(puzzles, [endgame], [opening]);

  it('gives each puzzle exactly one cell, its rarest theme at its own band', () => {
    expect(catalog.cellByPuzzle.get('a')).toBe(cellId('fork', 'low'));
    expect(catalog.cellByPuzzle.get('b')).toBe(cellId('fork', 'low'));
    expect(catalog.cellByPuzzle.get('c')).toBe(cellId('pin', 'middle'));
    expect(catalog.cellByPuzzle.get('d')).toBe(cellId('fork', 'high'));
  });

  it('keeps the puzzles of a cell in archive order', () => {
    expect(catalog.cells.get(cellId('fork', 'low'))?.puzzles.map((item) => item.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('does not make a cell for a puzzle without a theme', () => {
    expect(catalog.cellByPuzzle.has('no-theme')).toBe(false);
    expect([...catalog.cells.values()].some((cell) => cell.puzzles.includes(puzzles[4]!))).toBe(
      false,
    );
  });

  it('indexes every content set for the session', () => {
    expect(catalog.puzzleById.get('a')).toBe(puzzles[0]);
    expect(catalog.endgameById.get('kqk')).toBe(endgame);
    expect(catalog.openingById.get('london')).toBe(opening);
  });
});
