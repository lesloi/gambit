import { describe, expect, it } from 'vitest';
import {
  legalDests,
  playMove,
  promotionPieces,
  revealSolution,
  startPuzzle,
  type PromotionPiece,
  type Puzzle,
} from './puzzle';

const puzzle: Puzzle = {
  id: 'test-back-rank',
  fen: 'r5k1/5ppp/8/3Q4/8/8/PPP2PPP/3R2K1 w - - 0 1',
  solution: ['d5d8', 'a8d8', 'd1d8'],
  themes: ['backRankMate', 'mateIn2', 'sacrifice'],
  rating: 1500,
  fullLine: true,
};

const solvedFen = '3R2k1/5ppp/8/8/8/8/PPP2PPP/6K1 b - - 0 2';
const promotionPuzzle: Puzzle = {
  id: 'test-under-promotion',
  fen: 'k7/6P1/8/8/8/8/8/6K1 w - - 0 1',
  solution: ['g7g8n'],
  themes: ['underPromotion'],
  rating: 1200,
  fullLine: true,
};

/** Two rooks on the back rank: Ra8# and Rb8# are both mates, the stored answer is one of them. */
const doubleMate: Puzzle = {
  id: 'test-double-mate',
  fen: '6k1/5ppp/8/8/8/8/5PPP/RR4K1 w - - 0 1',
  solution: ['a1a8'],
  themes: ['backRankMate', 'mateIn1'],
  rating: 900,
  fullLine: true,
};

/** Ra8# is available, but the stored answer is a quiet move: the puzzle is not a mate in one. */
const quietAnswer: Puzzle = {
  id: 'test-quiet-answer',
  fen: '7k/6pp/8/8/8/8/1Q6/R5K1 w - - 0 1',
  solution: ['b2b3'],
  themes: ['fork'],
  rating: 1000,
  fullLine: true,
};

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

  it('solves on any mating move when the answer is mate in one', () => {
    const state = playMove(startPuzzle(doubleMate), 'b1', 'b8');

    expect(state.outcome).toBe('solved');
    expect(state.expected).toBeNull();
    expect(state.lastMove).toEqual(['b1', 'b8']);
  });

  it('refuses a mating move when the stored answer is not a mate', () => {
    const state = playMove(startPuzzle(quietAnswer), 'a1', 'a8');

    expect(state.outcome).toBe('failed');
    expect(state.bestSan).toBe('Qb3');
  });

  it('solves when the chosen under-promotion matches the solution', () => {
    const state = playMove(startPuzzle(promotionPuzzle), 'g7', 'g8', 'n');

    expect(state.outcome).toBe('solved');
    expect(state.fen).toBe('k5N1/8/8/8/8/8/8/6K1 b - - 0 1');
  });

  it('refuses another promotion and names the right one', () => {
    const state = playMove(startPuzzle(promotionPuzzle), 'g7', 'g8', 'b');

    expect(state.outcome).toBe('failed');
    expect(state.wrongMove).toBe('g7g8b');
    expect(state.bestSan).toBe('g8=N');
  });

  it('leaves the state untouched when a promotion arrives without a piece', () => {
    const before = startPuzzle(promotionPuzzle);

    expect(playMove(before, 'g7', 'g8')).toBe(before);
  });

  it('offers only the promotion pieces that keep the move legal', () => {
    expect(promotionPieces(promotionPuzzle.fen, 'g7', 'g8')).toEqual(['q', 'r', 'b', 'n']);
    expect(promotionPieces(promotionPuzzle.fen, 'g1', 'g2')).toEqual([]);
  });

  it('replays a stored line to the end', () => {
    let state = startPuzzle(puzzle);
    for (let ply = 0; ply < puzzle.solution.length; ply += 2) {
      const uci = puzzle.solution[ply]!;
      state = playMove(
        state,
        uci.slice(0, 2),
        uci.slice(2, 4),
        (uci.slice(4) || undefined) as PromotionPiece | undefined,
      );
    }

    expect(state.outcome).toBe('solved');
  });
});
