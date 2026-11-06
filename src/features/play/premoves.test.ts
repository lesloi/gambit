import { describe, expect, it } from 'vitest';
import { playUci, startGame, type PlayState } from './game';
import { MAX_PREMOVES, consumePremove, enqueuePremove, type Premove } from './premoves';

const PROMOTION_FEN = '7k/P7/8/8/8/8/8/7K w - - 0 1';

function stateAt(fen: string): PlayState {
  return { ...startGame(), fen, positions: [fen] };
}

describe('premove queue', () => {
  it('keeps premoves in the order they were made', () => {
    const queue = enqueuePremove(enqueuePremove([], { from: 'e2', to: 'e4' }), {
      from: 'g1',
      to: 'f3',
    });

    expect(queue).toEqual([
      { from: 'e2', to: 'e4' },
      { from: 'g1', to: 'f3' },
    ]);
  });

  it('caps the queue at five and ignores the next premove', () => {
    let queue: readonly Premove[] = [];
    for (let index = 0; index < MAX_PREMOVES; index += 1) {
      queue = enqueuePremove(queue, { from: 'a2', to: 'a3' });
    }

    const capped = enqueuePremove(queue, { from: 'b2', to: 'b3' });

    expect(capped).toHaveLength(MAX_PREMOVES);
    expect(capped).toEqual(queue);
    // A fresh array makes the board re-read the position and drop chessground's rejected premove.
    expect(capped).not.toBe(queue);
    expect(capped).not.toContainEqual({ from: 'b2', to: 'b3' });
  });

  it('plays the first premove and keeps the rest for the next reply', () => {
    const before = startGame();

    const result = consumePremove(before, [
      { from: 'e2', to: 'e4' },
      { from: 'g1', to: 'f3' },
    ]);

    expect(result.played).toBe(true);
    expect(result.state.moves).toEqual(['e2e4']);
    expect(result.queue).toEqual([{ from: 'g1', to: 'f3' }]);
  });

  it('plays the queue in order across engine replies', () => {
    let state = startGame();
    const first = consumePremove(state, [
      { from: 'e2', to: 'e4' },
      { from: 'g1', to: 'f3' },
    ]);
    state = playUci(first.state, 'e7e5');

    const second = consumePremove(state, first.queue);

    expect(second.state.moves).toEqual(['e2e4', 'e7e5', 'g1f3']);
    expect(second.queue).toEqual([]);
  });

  it('drops the whole queue when the first premove is illegal', () => {
    const before = startGame();

    const result = consumePremove(before, [
      { from: 'e2', to: 'e5' },
      { from: 'g1', to: 'f3' },
    ]);

    expect(result.played).toBe(false);
    expect(result.state).toBe(before);
    expect(result.queue).toEqual([]);
  });

  it('queens a premove that promotes', () => {
    const result = consumePremove(stateAt(PROMOTION_FEN), [{ from: 'a7', to: 'a8' }]);

    expect(result.played).toBe(true);
    expect(result.state.moves).toEqual(['a7a8q']);
    expect(result.state.fen).toContain('Q');
  });

  it('leaves the game alone when no premove is queued', () => {
    const before = startGame();

    const result = consumePremove(before, []);

    expect(result).toEqual({ state: before, queue: [], played: false });
  });
});
