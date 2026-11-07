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

  it('keeps every committed entry', () => {
    const entries = JSON.parse(source) as unknown[];

    const endgames = parseEndgames(source);

    expect(endgames).toHaveLength(entries.length);
  });

  it('gives every endgame a legal position, a result, a goal and a plan', () => {
    for (const endgame of parseEndgames(source)) {
      expect(() => new Chess(endgame.fen), endgame.id).not.toThrow();
      expect(['win', 'draw'], endgame.id).toContain(endgame.result);
      expect(endgame.name.length, endgame.id).toBeGreaterThan(0);
      expect(endgame.goal.length, endgame.id).toBeGreaterThan(0);
      expect(endgame.hint.length, endgame.id).toBeGreaterThan(0);
    }
  });
});

describe('endgame content parsing', () => {
  const good = {
    id: 'good',
    name: 'Bien',
    fen: '8/8/8/4k3/8/8/5K2/6Q1 w - - 0 1',
    result: 'win',
    goal: 'Mater.',
    hint: 'Rapproche le roi avant de mater.',
  };

  it('skips an entry with an illegal position, an unknown result or a missing field', () => {
    const text = JSON.stringify([
      good,
      { ...good, id: 'bad-fen', fen: 'not-a-fen' },
      { ...good, id: 'bad-result', result: 'loss' },
      { ...good, id: 'no-goal', goal: undefined },
      { ...good, id: 'no-hint', hint: undefined },
      { ...good, id: 'empty-hint', hint: '' },
      { ...good, id: 'over', fen: '8/8/8/4k3/8/8/4K3/8 w - - 0 1', result: 'draw', goal: 'Nulle.' },
    ]);

    expect(parseEndgames(text).map((endgame) => endgame.id)).toEqual(['good']);
  });

  it('returns nothing for a body that is not a list', () => {
    expect(parseEndgames('{"id":"not-a-list"}')).toEqual([]);
  });
});
