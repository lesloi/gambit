import { describe, expect, it } from 'vitest';
import { dueCountsByMode } from './sessionPreview';

describe('due counts by mode', () => {
  it('counts only the due prefix, never the new cards', () => {
    const cards = [
      { kind: 'puzzle' },
      { kind: 'puzzle' },
      { kind: 'endgame' },
      { kind: 'opening' },
      { kind: 'puzzle' },
    ] as const;

    expect(dueCountsByMode(cards, 3)).toEqual({
      puzzles: 2,
      endgames: 1,
      openings: 0,
      play: 0,
    });
  });

  it('has nothing due when the due prefix is empty', () => {
    expect(dueCountsByMode([{ kind: 'puzzle' }], 0)).toEqual({
      puzzles: 0,
      endgames: 0,
      openings: 0,
      play: 0,
    });
  });

  it('counts every card when the due prefix covers the queue', () => {
    expect(dueCountsByMode([{ kind: 'endgame' }, { kind: 'opening' }], 5)).toEqual({
      puzzles: 0,
      endgames: 1,
      openings: 1,
      play: 0,
    });
  });

  it('treats a negative prefix as empty', () => {
    expect(dueCountsByMode([{ kind: 'puzzle' }], -1)).toEqual({
      puzzles: 0,
      endgames: 0,
      openings: 0,
      play: 0,
    });
  });
});
