import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { parseEndgames } from './content';

const source = readFileSync(new URL('../../../content/endgames.json', import.meta.url), 'utf8');

describe('committed endgame content', () => {
  it('parses the whole set', () => {
    const endgames = parseEndgames(source);

    expect(endgames.length).toBeGreaterThan(0);
    expect(new Set(endgames.map((endgame) => endgame.id)).size).toBe(endgames.length);
  });

  it('gives every endgame a legal position, a result and a goal', () => {
    for (const endgame of parseEndgames(source)) {
      expect(() => new Chess(endgame.fen), endgame.id).not.toThrow();
      expect(['win', 'draw'], endgame.id).toContain(endgame.result);
      expect(endgame.name.length, endgame.id).toBeGreaterThan(0);
      expect(endgame.goal.length, endgame.id).toBeGreaterThan(0);
    }
  });
});

describe('endgame content parsing', () => {
  it('skips an entry with an illegal position, an unknown result or a missing field', () => {
    const text = JSON.stringify([
      {
        id: 'good',
        name: 'Bien',
        fen: '8/8/8/4k3/8/8/5K2/6Q1 w - - 0 1',
        result: 'win',
        goal: 'Mater.',
      },
      { id: 'bad-fen', name: 'Faux', fen: 'not-a-fen', result: 'win', goal: 'Mater.' },
      {
        id: 'bad-result',
        name: 'Faux',
        fen: '8/8/8/4k3/8/8/5K2/6Q1 w - - 0 1',
        result: 'loss',
        goal: 'Mater.',
      },
      { id: 'no-goal', name: 'Sans but', fen: '8/8/8/4k3/8/8/5K2/6Q1 w - - 0 1', result: 'win' },
    ]);

    expect(parseEndgames(text).map((endgame) => endgame.id)).toEqual(['good']);
  });

  it('returns nothing for a body that is not a list', () => {
    expect(parseEndgames('{"id":"not-a-list"}')).toEqual([]);
  });
});
