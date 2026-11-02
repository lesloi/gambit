import { describe, expect, it } from 'vitest';
import type { PositionEval, Score } from '../../engine/uci';
import { replayMoves, reviewGame, winPercent } from './analysis';

const CP = (cp: number): Score => ({ cp, mate: null });

/** Answers the engine's request for a position by index, and records every FEN it sees. */
function mockEngine(
  positions: ReturnType<typeof replayMoves>,
  table: Record<number, PositionEval>,
) {
  const seen: string[] = [];
  const evaluate = async (fen: string): Promise<PositionEval> => {
    seen.push(fen);
    const index = positions.findIndex((position) => position.fen === fen);
    return table[index] ?? { bestMove: null, score: null };
  };
  return { evaluate, seen };
}

async function reviewOneMove(beforeCp: number, afterBlackCp: number) {
  const moves = ['e2e4', 'e7e5'];
  const positions = replayMoves(moves);
  const { evaluate } = mockEngine(positions, {
    0: { bestMove: 'd2d4', score: CP(beforeCp) },
    1: { bestMove: 'e7e5', score: CP(afterBlackCp) },
  });
  return reviewGame(evaluate, { moves, userColor: 'white' });
}

const WHITE_GAME = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];

describe('replayMoves', () => {
  it('starts at the initial position and keeps the SAN, the mover and the last move', () => {
    const positions = replayMoves(['e2e4', 'e7e5']);

    expect(positions).toHaveLength(3);
    expect(positions[0]).toMatchObject({ san: null, lastMove: null, turn: 'white' });
    expect(positions[1]).toMatchObject({ san: 'e4', lastMove: ['e2', 'e4'], turn: 'black' });
    expect(positions[2]).toMatchObject({ san: 'e5', lastMove: ['e7', 'e5'], turn: 'white' });
    expect(positions[2].fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  });
});

describe('winPercent', () => {
  it('is even at equality and saturates on a mate', () => {
    expect(winPercent(CP(0))).toBeCloseTo(50);
    expect(winPercent({ cp: null, mate: 3 })).toBe(100);
    expect(winPercent({ cp: null, mate: -3 })).toBe(0);
  });
});

describe('reviewGame', () => {
  it('flags a user move that throws the winning chances away', async () => {
    const positions = replayMoves(WHITE_GAME);
    const { evaluate } = mockEngine(positions, {
      0: { bestMove: 'd2d4', score: CP(20) },
      1: { bestMove: 'e7e5', score: CP(500) },
      2: { bestMove: 'b1c3', score: CP(10) },
      3: { bestMove: 'b8c6', score: CP(20) },
      4: { bestMove: 'f1b5', score: CP(15) },
    });

    const findings = await reviewGame(evaluate, { moves: WHITE_GAME, userColor: 'white' });

    expect(findings).toHaveLength(1);
    expect(findings?.[0]).toMatchObject({
      ply: 0,
      moveNumber: 1,
      side: 'white',
      fen: positions[0].fen,
      playedSan: 'e4',
      bestSan: 'd4',
      kind: 'blunder',
    });
  });

  it('never judges the engine moves', async () => {
    const positions = replayMoves(WHITE_GAME);
    const { evaluate } = mockEngine(positions, {
      0: { bestMove: 'd2d4', score: CP(20) },
      1: { bestMove: 'e7e5', score: CP(500) },
      2: { bestMove: 'b1c3', score: CP(10) },
      3: { bestMove: 'b8c6', score: CP(-900) },
      4: { bestMove: 'f1b5', score: CP(15) },
    });

    const findings = await reviewGame(evaluate, { moves: WHITE_GAME, userColor: 'white' });

    expect(findings?.map((finding) => finding.ply)).toEqual([0]);
  });

  it('reads the score of a Black move from the user side', async () => {
    const positions = replayMoves(WHITE_GAME);
    const { evaluate } = mockEngine(positions, {
      0: { bestMove: 'e2e4', score: CP(20) },
      1: { bestMove: 'g8f6', score: CP(-100) },
      2: { bestMove: 'g1f3', score: CP(500) },
      3: { bestMove: 'b8c6', score: CP(20) },
      4: { bestMove: 'f1b5', score: CP(15) },
    });

    const findings = await reviewGame(evaluate, { moves: WHITE_GAME, userColor: 'black' });

    expect(findings?.[0]).toMatchObject({
      ply: 1,
      moveNumber: 1,
      side: 'black',
      playedSan: 'e5',
      bestSan: 'Nf6',
      kind: 'blunder',
    });
  });

  it('names a missed win when the position was already won', async () => {
    const positions = replayMoves(WHITE_GAME);
    const { evaluate } = mockEngine(positions, {
      0: { bestMove: 'd2d4', score: CP(400) },
      1: { bestMove: 'e7e5', score: CP(50) },
      2: { bestMove: 'b1c3', score: CP(10) },
      3: { bestMove: 'b8c6', score: CP(20) },
      4: { bestMove: 'f1b5', score: CP(15) },
    });

    const findings = await reviewGame(evaluate, { moves: WHITE_GAME, userColor: 'white' });

    expect(findings?.[0]).toMatchObject({ ply: 0, kind: 'missed-win' });
  });

  it('keeps a drop just under the blunder threshold out of the list', async () => {
    const findings = await reviewOneMove(0, 217);

    expect(findings).toEqual([]);
  });

  it('flags a drop just over the blunder threshold', async () => {
    const findings = await reviewOneMove(0, 243);

    expect(findings).toHaveLength(1);
  });

  it('labels a position just below the winning threshold a blunder', async () => {
    const findings = await reviewOneMove(217, 1000);

    expect(findings?.[0].kind).toBe('blunder');
  });

  it('labels a position just above the winning threshold a missed win', async () => {
    const findings = await reviewOneMove(243, 1000);

    expect(findings?.[0].kind).toBe('missed-win');
  });

  it('keeps a move that stays clearly winning out of the list', async () => {
    const positions = replayMoves(['e2e4', 'e7e5']);
    const { evaluate } = mockEngine(positions, {
      0: { bestMove: 'd2d4', score: CP(900) },
      1: { bestMove: 'e7e5', score: CP(-600) },
      2: { bestMove: 'g1f3', score: CP(20) },
    });

    const findings = await reviewGame(evaluate, { moves: ['e2e4', 'e7e5'], userColor: 'white' });

    expect(findings).toEqual([]);
  });

  it('scores a checkmate itself instead of asking the engine', async () => {
    const moves = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
    const positions = replayMoves(moves);
    const finalFen = positions[positions.length - 1].fen;
    const { evaluate, seen } = mockEngine(positions, {
      0: { bestMove: 'e2e4', score: CP(-100) },
      1: { bestMove: 'g1f3', score: CP(50) },
      2: { bestMove: 'b1c3', score: CP(-50) },
      3: { bestMove: 'd8h4', score: CP(500) },
    });
    const guarded = async (fen: string) => {
      if (fen === finalFen) throw new Error('The final position was sent to the engine');
      return evaluate(fen);
    };

    const findings = await reviewGame(guarded, { moves, userColor: 'white' });

    expect(seen).not.toContain(finalFen);
    expect(findings?.[0]).toMatchObject({ ply: 2, playedSan: 'g4', kind: 'blunder' });
  });

  it('reads a checkmate by the user as a win, not as a loss', async () => {
    const moves = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7'];
    const positions = replayMoves(moves);
    const finalFen = positions[positions.length - 1].fen;
    const { evaluate, seen } = mockEngine(positions, {
      0: { bestMove: 'd2d4', score: CP(20) },
      1: { bestMove: 'g8f6', score: CP(20) },
      2: { bestMove: 'g1f3', score: CP(20) },
      3: { bestMove: 'b8c6', score: CP(20) },
      4: { bestMove: 'g1f3', score: CP(20) },
      5: { bestMove: 'g8f6', score: CP(20) },
      6: { bestMove: 'h5f7', score: { cp: null, mate: 2 } },
    });

    const findings = await reviewGame(evaluate, { moves, userColor: 'white' });

    expect(seen).not.toContain(finalFen);
    expect(findings).toEqual([]);
  });

  it('skips a move whose score the engine did not report', async () => {
    const positions = replayMoves(WHITE_GAME);
    const { evaluate } = mockEngine(positions, {
      0: { bestMove: 'd2d4', score: null },
      1: { bestMove: 'e7e5', score: CP(500) },
      2: { bestMove: 'b1c3', score: CP(10) },
      3: { bestMove: 'b8c6', score: CP(20) },
      4: { bestMove: 'f1b5', score: CP(15) },
    });

    const findings = await reviewGame(evaluate, { moves: WHITE_GAME, userColor: 'white' });

    expect(findings).toEqual([]);
  });

  it('reports its progress and stops when the review is cancelled', async () => {
    const positions = replayMoves(WHITE_GAME);
    const progress: string[] = [];
    let evaluations = 0;
    const { evaluate } = mockEngine(positions, {});
    const counted = async (fen: string): Promise<PositionEval> => {
      evaluations += 1;
      return evaluate(fen);
    };

    const findings = await reviewGame(
      counted,
      { moves: WHITE_GAME, userColor: 'white' },
      {
        onProgress: (done, total) => progress.push(`${done}/${total}`),
        cancelled: () => evaluations >= 2,
      },
    );

    expect(findings).toBeNull();
    expect(evaluations).toBe(2);
    expect(progress).toEqual(['1/5']);
  });
});
