import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../src/features/puzzles/puzzle';
import type { Entry } from './lichess';
import { primaryTheme, selectSubset, serializePuzzles } from './subset';

/** An entry whose position is unique to its id, so duplicates are always explicit. */
function entry(id: string, rating: number, motifs: string[], popularity = 50, plays = 1000): Entry {
  return {
    id,
    fen: `position ${id}`,
    moves: ['a1a2', 'h7h8'],
    rating,
    motifs,
    popularity,
    plays,
  };
}

const OPTIONS = { target: 8, minRating: 800, maxRating: 2200, bandSize: 100 };

function select(entries: Entry[], options = OPTIONS) {
  return selectSubset(() => entries, options);
}

describe('primary theme', () => {
  it('classifies a puzzle by its rarest motif', () => {
    const counts = new Map([
      ['fork', 10],
      ['pin', 3],
    ]);

    expect(primaryTheme(['fork', 'pin'], counts)).toBe('pin');
  });

  it('breaks a tie on the alphabetical order, so a bucket never depends on chance', () => {
    const counts = new Map([
      ['skewer', 4],
      ['pin', 4],
    ]);

    expect(primaryTheme(['skewer', 'pin'], counts)).toBe('pin');
  });
});

describe('selection', () => {
  it('takes the same number of puzzles from every motif and every rating band', async () => {
    const entries = [
      entry('f8', 800, ['fork']),
      entry('f9', 850, ['fork']),
      entry('fa', 900, ['fork']),
      entry('p8', 800, ['pin']),
      entry('p9', 850, ['pin']),
      entry('pa', 900, ['pin']),
      entry('f8b', 810, ['fork']),
      entry('p9b', 910, ['pin']),
    ];

    const subset = await select(entries, { ...OPTIONS, target: 4 });

    expect(subset.themes).toEqual({ fork: 2, pin: 2 });
    expect(subset.bands).toEqual({ '800': 2, '900': 2 });
  });

  it('lets the other buckets take the slots a rare motif cannot fill, up to the target', async () => {
    const entries = [
      entry('f1', 800, ['fork']),
      entry('f2', 800, ['fork']),
      entry('f3', 800, ['fork']),
      entry('f4', 900, ['fork']),
      entry('f5', 900, ['fork']),
      entry('f6', 900, ['fork']),
      entry('p1', 800, ['pin']),
      entry('p4', 900, ['pin']),
      entry('p5', 900, ['pin']),
      entry('p6', 900, ['pin']),
    ];

    const subset = await select(entries, { ...OPTIONS, target: 9 });

    expect(subset.entries).toHaveLength(9);
    expect(subset.entries.map((puzzle) => puzzle.id)).toContain('p1');
  });

  it('returns the whole supply when the target is out of reach', async () => {
    const entries = [entry('a', 800, ['fork']), entry('b', 900, ['pin'])];

    const subset = await select(entries, { ...OPTIONS, target: 20 });

    expect(subset.entries).toHaveLength(2);
  });

  it('fills the target exactly with the best puzzles a bucket holds', async () => {
    const entries = [
      entry('a1', 800, ['fork']),
      entry('a2', 800, ['fork']),
      entry('b1', 900, ['pin']),
      entry('b2', 900, ['pin']),
      entry('c1', 1000, ['skewer']),
      entry('c2', 1000, ['skewer']),
    ];

    const subset = await select(entries, { ...OPTIONS, target: 5 });

    expect(subset.entries).toHaveLength(5);
    expect(Object.values(subset.themes).every((count) => count >= 1)).toBe(true);
  });

  it('prefers the most popular puzzle of a bucket', async () => {
    const entries = [entry('weak', 800, ['fork'], 71), entry('strong', 800, ['fork'], 99)];

    const subset = await select(entries, { ...OPTIONS, target: 1 });

    expect(subset.entries.map((puzzle) => puzzle.id)).toEqual(['strong']);
  });

  it('gives the last slots one each to the best buckets, never piling them on one', async () => {
    const entries = [
      // The fork bucket holds the most popular puzzles, so a naive top-up would take them all.
      entry('f1', 800, ['fork'], 99),
      entry('f2', 800, ['fork'], 98),
      entry('f3', 800, ['fork'], 97),
      entry('f4', 800, ['fork'], 96),
      entry('f5', 800, ['fork'], 95),
      entry('p1', 900, ['pin'], 60),
      entry('p2', 900, ['pin'], 59),
      entry('p3', 900, ['pin'], 58),
      entry('p4', 900, ['pin'], 57),
      entry('p5', 900, ['pin'], 56),
      entry('s1', 1000, ['skewer'], 50),
      entry('s2', 1000, ['skewer'], 49),
      entry('s3', 1000, ['skewer'], 48),
      entry('s4', 1000, ['skewer'], 47),
      entry('s5', 1000, ['skewer'], 46),
    ];

    const subset = await select(entries, { ...OPTIONS, target: 11 });

    expect(subset.themes).toEqual({ fork: 4, pin: 4, skewer: 3 });
  });

  it('keeps the better copy of a position that appears twice', async () => {
    const entries = [
      { ...entry('weak', 800, ['fork'], 71), fen: 'same position' },
      { ...entry('strong', 900, ['fork'], 99), fen: 'same position' },
    ];

    const subset = await select(entries, { ...OPTIONS, target: 10 });

    expect(subset.entries.map((puzzle) => puzzle.id)).toEqual(['strong']);
    expect(subset.duplicates).toBe(1);
  });

  it('picks the same puzzles whatever the order of the input', async () => {
    const entries = Array.from({ length: 30 }, (_, index) =>
      entry(`id${index}`, 800 + (index % 3) * 100, index % 2 ? ['fork'] : ['pin']),
    );

    const forward = select(entries);
    const backward = select([...entries].reverse());

    expect(backward).toEqual(forward);
  });

  it('orders the subset by identifier, so a regeneration only shows what changed', async () => {
    const entries = [
      entry('ccc', 800, ['fork']),
      entry('aaa', 800, ['fork']),
      entry('bbb', 800, ['fork']),
    ];

    const subset = await select(entries);

    expect(subset.entries.map((puzzle) => puzzle.id)).toEqual(['aaa', 'bbb', 'ccc']);
  });
});

describe('serialisation', () => {
  it('writes one compact object per line, in the shape the app reads', async () => {
    const puzzle: Puzzle = {
      id: '000Pw',
      fen: '6k1/5p1p/4p3/4q3/3n4/2Q3P1/PP1N1P1P/6K1 b - - 3 37',
      solution: ['d4e2', 'g1f1', 'e2c3'],
      rating: 1530,
      themes: ['fork'],
      fullLine: true,
    };

    expect(serializePuzzles([puzzle])).toBe(
      '{"id":"000Pw","fen":"6k1/5p1p/4p3/4q3/3n4/2Q3P1/PP1N1P1P/6K1 b - - 3 37","solution":["d4e2","g1f1","e2c3"],"rating":1530,"themes":["fork"],"fullLine":true}\n',
    );
  });
});
