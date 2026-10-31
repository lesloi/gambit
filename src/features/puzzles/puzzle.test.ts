import { describe, expect, it } from 'vitest';
import { DEMO_PUZZLES } from './demo';
import { legalDests, playMove, revealSolution, startPuzzle } from './puzzle';

const puzzle = DEMO_PUZZLES[0];
const solvedFen = '3R2k1/5ppp/8/8/8/8/PPP2PPP/6K1 b - - 0 2';

describe('puzzle session', () => {
  it('asks for the first move of the solution', () => {
    const state = startPuzzle(puzzle);

    expect(state.outcome).toBe('playing');
    expect(state.expected).toBe('d5d8');
    expect(state.fen).toBe(puzzle.fen);
  });

  it('applies the forced reply and waits for the user again', () => {
    const state = playMove(startPuzzle(puzzle), 'd5', 'd8');

    expect(state.outcome).toBe('playing');
    expect(state.lastMove).toEqual(['a8', 'd8']);
    expect(state.expected).toBe('d1d8');
    expect(state.fen).toBe('3r2k1/5ppp/8/8/8/8/PPP2PPP/3R2K1 w - - 0 2');
  });

  it('marks the puzzle solved after the last move', () => {
    const first = playMove(startPuzzle(puzzle), 'd5', 'd8');
    const state = playMove(first, 'd1', 'd8');

    expect(state.outcome).toBe('solved');
    expect(state.expected).toBeNull();
    expect(state.fen).toBe(solvedFen);
  });

  it('refuses another legal move and names the right one', () => {
    const state = playMove(startPuzzle(puzzle), 'd5', 'f7');

    expect(state.outcome).toBe('failed');
    expect(state.bestSan).toBe('Qd8+');
    expect(state.wrongMove).toBe('d5f7');
    expect(state.expected).toBeNull();
  });

  it('leaves the state untouched on an illegal move', () => {
    const before = startPuzzle(puzzle);

    expect(playMove(before, 'd5', 'd5')).toBe(before);
  });

  it('reveals the whole line from the puzzle position after a failure', () => {
    const failed = playMove(startPuzzle(puzzle), 'd5', 'f7');
    const revealed = revealSolution(failed);

    expect(revealed.outcome).toBe('revealed');
    expect(revealed.fen).toBe(solvedFen);
  });

  it('lists the legal destinations of the side to move', () => {
    const dests = legalDests(puzzle.fen);

    expect(dests.get('d5')).toContain('d8');
    expect(dests.get('d5')).toContain('f7');
    expect(dests.get('a2')).toEqual(['a3', 'a4']);
  });
});
