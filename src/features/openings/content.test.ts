import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { parseOpenings } from './content';

const source = readFileSync(new URL('../../../content/openings.json', import.meta.url), 'utf8');

describe('committed opening content', () => {
  const lines = parseOpenings(source);

  it('parses the whole set, with one card per line', () => {
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length);
  });

  it('covers both colours', () => {
    expect(lines.some((line) => line.color === 'white')).toBe(true);
    expect(lines.some((line) => line.color === 'black')).toBe(true);
  });

  it('replays every line legally and asks the user for a move', () => {
    for (const line of lines) {
      const chess = new Chess();
      let userMoves = 0;
      for (const uci of line.moves) {
        const userToMove = (chess.turn() === 'w') === (line.color === 'white');
        if (userToMove) userMoves += 1;
        expect(
          () =>
            chess.move({
              from: uci.slice(0, 2),
              to: uci.slice(2, 4),
              promotion: uci.slice(4) || undefined,
            }),
          line.id,
        ).not.toThrow();
      }
      expect(userMoves, line.id).toBeGreaterThan(0);
    }
  });
});

describe('opening content parsing', () => {
  it('skips an entry with an unknown colour, an illegal move, no user move or a duplicate id', () => {
    const good = {
      id: 'good',
      name: 'Bonne ligne',
      color: 'white',
      moves: ['d2d4', 'd7d5', 'c1f4'],
    };
    const text = JSON.stringify([
      good,
      { ...good, id: 'bad-color', color: 'green' },
      { ...good, id: 'bad-move', moves: ['d2d4', 'd7d8'] },
      { ...good, id: 'no-user-move', color: 'black', moves: ['e2e4'] },
      { ...good, name: '' },
      { ...good, moves: ['d2d4', 'd7d5'] },
    ]);

    expect(parseOpenings(text).map((line) => line.id)).toEqual(['good']);
  });

  it('returns nothing for a body that is not a list', () => {
    expect(parseOpenings('{"id":"not-a-list"}')).toEqual([]);
  });
});
