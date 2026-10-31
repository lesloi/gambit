import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parsePuzzles } from './content';

/**
 * The committed archive, read as the app reads it. Kept apart from the fast suite: it parses
 * 12,000 puzzles, and replaying their lines would cost seconds.
 */
const archive = gunzipSync(
  readFileSync(new URL('../../../content/puzzles.jsonl.gz', import.meta.url)),
).toString('utf8');

const puzzles = parsePuzzles(archive);

describe('committed puzzle subset', () => {
  it('parses every line the generator wrote', () => {
    expect(puzzles).toHaveLength(12_000);
    expect(new Set(puzzles.map((puzzle) => puzzle.id)).size).toBe(12_000);
  });

  it('gives every puzzle a motif, a rating in the shipped band and a non-empty line', () => {
    for (const puzzle of puzzles) {
      expect(puzzle.themes.length, puzzle.id).toBeGreaterThan(0);
      expect(puzzle.rating, puzzle.id).toBeGreaterThanOrEqual(800);
      expect(puzzle.rating, puzzle.id).toBeLessThanOrEqual(2200);
      expect(puzzle.solution.length, puzzle.id).toBeGreaterThan(0);
    }
  });
});
