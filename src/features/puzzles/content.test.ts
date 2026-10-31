import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUZZLE_FILTERS,
  loadPuzzles,
  parsePuzzles,
  puzzleLength,
  selectPuzzles,
  type PuzzleFilters,
} from './content';
import type { Puzzle } from './puzzle';

const puzzles: Puzzle[] = [
  {
    id: 'mate-in-one',
    fen: '6k1/5ppp/8/8/8/8/5PPP/RR4K1 w - - 0 1',
    solution: ['a1a8'],
    themes: ['backRankMate', 'mateIn1'],
    rating: 900,
  },
  {
    id: 'fork-in-two',
    fen: 'r5k1/5ppp/8/3Q4/8/8/PPP2PPP/3R2K1 w - - 0 1',
    solution: ['d5d8', 'a8d8', 'd1d8'],
    themes: ['fork', 'sacrifice'],
    rating: 1250,
  },
  {
    id: 'fork-in-three',
    fen: 'r5k1/5ppp/8/3Q4/8/8/PPP2PPP/3R2K1 w - - 0 1',
    solution: ['d5d8', 'a8d8', 'd1d8', 'g8f8', 'd8f8'],
    themes: ['fork'],
    rating: 1500,
  },
  {
    id: 'pin-long',
    fen: 'r5k1/5ppp/8/3Q4/8/8/PPP2PPP/3R2K1 w - - 0 1',
    solution: ['d5d8', 'a8d8', 'd1d8', 'g8f8', 'd8f8', 'f7f6', 'f8f6'],
    themes: ['pin'],
    rating: 1650,
  },
  {
    id: 'pin-longest',
    fen: 'r5k1/5ppp/8/3Q4/8/8/PPP2PPP/3R2K1 w - - 0 1',
    solution: ['d5d8', 'a8d8', 'd1d8', 'g8f8', 'd8f8', 'f7f6', 'f8f6', 'h7h6', 'f6h6'],
    themes: ['pin'],
    rating: 2199,
  },
];

const filters = (patch: Partial<PuzzleFilters>): PuzzleFilters => ({
  ...DEFAULT_PUZZLE_FILTERS,
  ...patch,
});

const ids = (list: readonly Puzzle[]): string[] => list.map((puzzle) => puzzle.id);

async function gzippedUrl(text: string): Promise<string> {
  const { gzipSync } = await import('node:zlib');
  return `data:application/gzip;base64,${gzipSync(Buffer.from(text, 'utf8')).toString('base64')}`;
}

describe('puzzle content', () => {
  it('measures a puzzle by the plies of its stored solution', () => {
    expect(puzzleLength(puzzles[0]!)).toBe(1);
    expect(puzzleLength(puzzles[2]!)).toBe(5);
  });

  it('reads one puzzle per line and keeps their order', () => {
    const text = `${JSON.stringify(puzzles[0])}\n${JSON.stringify(puzzles[1])}\n`;

    expect(ids(parsePuzzles(text))).toEqual(['mate-in-one', 'fork-in-two']);
  });

  it('skips blank lines, malformed JSON and entries missing a field', () => {
    const text = [
      '',
      JSON.stringify(puzzles[0]),
      '{not json',
      JSON.stringify({ id: 'no-fen', solution: ['a1a8'], themes: [], rating: 900 }),
      JSON.stringify({ ...puzzles[1], solution: [] }),
      JSON.stringify(puzzles[1]),
      '',
    ].join('\n');

    expect(ids(parsePuzzles(text))).toEqual(['mate-in-one', 'fork-in-two']);
  });

  it('serves every puzzle without a filter', () => {
    expect(selectPuzzles(puzzles, DEFAULT_PUZZLE_FILTERS)).toHaveLength(puzzles.length);
  });

  it('filters by length, with the long bucket open-ended', () => {
    expect(ids(selectPuzzles(puzzles, filters({ length: '1' })))).toEqual(['mate-in-one']);
    expect(ids(selectPuzzles(puzzles, filters({ length: '3' })))).toEqual(['fork-in-two']);
    expect(ids(selectPuzzles(puzzles, filters({ length: '5' })))).toEqual(['fork-in-three']);
    expect(ids(selectPuzzles(puzzles, filters({ length: 'long' })))).toEqual([
      'pin-long',
      'pin-longest',
    ]);
  });

  it('filters by the rating band', () => {
    expect(ids(selectPuzzles(puzzles, filters({ rating: 'low' })))).toEqual(['mate-in-one']);
    expect(ids(selectPuzzles(puzzles, filters({ rating: 'middle' })))).toEqual([
      'fork-in-two',
      'fork-in-three',
    ]);
    expect(ids(selectPuzzles(puzzles, filters({ rating: 'high' })))).toEqual([
      'pin-long',
      'pin-longest',
    ]);
  });

  it('combines length and rating', () => {
    expect(ids(selectPuzzles(puzzles, filters({ length: '3', rating: 'middle' })))).toEqual([
      'fork-in-two',
    ]);
    expect(selectPuzzles(puzzles, filters({ length: '1', rating: 'high' }))).toEqual([]);
  });

  it('loads a gzipped JSONL archive from a URL', async () => {
    const url = await gzippedUrl(`${JSON.stringify(puzzles[0])}\n`);

    await expect(loadPuzzles(url)).resolves.toEqual([puzzles[0]]);
  });

  it('fails when the archive decodes but holds no puzzle', async () => {
    const url = await gzippedUrl('\n');

    await expect(loadPuzzles(url)).rejects.toThrow('empty archive');
  });
});
