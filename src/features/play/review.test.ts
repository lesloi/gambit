import { describe, expect, it } from 'vitest';
import type { PositionEval, Score } from '../../engine/uci';
import { START_FEN } from '../../lib/position';
import type { OpeningLine } from '../openings/opening';
import { replayMoves } from './analysis';
import {
  accuracyWeights,
  aggregateAccuracy,
  buildReport,
  classifyMove,
  isForced,
  markOf,
  materialTotal,
  moveAccuracy,
  phaseOf,
  selectKeyMoments,
  type MoveReview,
} from './review';

const CP = (cp: number): Score => ({ cp, mate: null });

function reportFor(
  moves: string[],
  table: Record<number, PositionEval>,
  options: { userColor?: 'white' | 'black'; startFen?: string; openings?: OpeningLine[] } = {},
) {
  const startFen = options.startFen ?? START_FEN;
  const positions = replayMoves(moves, startFen);
  const evals = positions.map((_, index) => table[index] ?? { bestMove: null, score: null });
  return buildReport({
    positions,
    evals,
    moves,
    userColor: options.userColor ?? 'white',
    startFen,
    openings: options.openings ?? [],
  });
}

function move(patch: Partial<MoveReview> = {}): MoveReview {
  return {
    ply: 1,
    moveNumber: 1,
    side: 'white',
    san: 'e4',
    uci: 'e2e4',
    fenBefore: START_FEN,
    lastMoveBefore: null,
    bestUci: 'e2e4',
    bestSan: 'e4',
    scoreBefore: CP(0),
    scoreAfter: CP(0),
    winBefore: 50,
    winAfter: 50,
    drop: 0,
    cpLoss: 0,
    class: 'best',
    phase: 'opening',
    book: false,
    forced: false,
    deviation: false,
    ...patch,
  };
}

describe('classifyMove', () => {
  const classify = (patch: Partial<Parameters<typeof classifyMove>[0]> = {}) =>
    classifyMove({
      drop: 0,
      playedUci: 'e2e4',
      bestUci: 'e2e4',
      winBefore: 50,
      winAfter: 50,
      forced: false,
      ...patch,
    });

  it('names the engine move best and a near-equal alternative excellent', () => {
    expect(classify()).toBe('best');
    expect(classify({ playedUci: 'd2d4' })).toBe('excellent');
  });

  it('grades the win points given away', () => {
    expect(classify({ drop: 3 })).toBe('good');
    expect(classify({ drop: 7 })).toBe('inaccuracy');
    expect(classify({ drop: 15 })).toBe('mistake');
    expect(classify({ drop: 25, winBefore: 50, winAfter: 25 })).toBe('blunder');
  });

  it('names a lost win a missed win, not a blunder', () => {
    expect(classify({ drop: 25, winBefore: 80, winAfter: 55 })).toBe('missed-win');
  });

  it('names a move that turns a bad position into a win a turnaround', () => {
    expect(classify({ winBefore: 45, winAfter: 75 })).toBe('turning-point');
  });

  it('does not judge a forced move or a move without a score', () => {
    expect(classify({ forced: true })).toBe('unknown');
    expect(classify({ drop: null })).toBe('unknown');
    expect(classify({ winBefore: null })).toBe('unknown');
  });
});

describe('moveAccuracy', () => {
  it('is perfect without a loss and follows lichess’s curve with one', () => {
    expect(moveAccuracy(0)).toBe(100);
    expect(moveAccuracy(-5)).toBe(100);
    expect(moveAccuracy(5)).toBeCloseTo(80.8153, 3);
    expect(moveAccuracy(20)).toBeCloseTo(41.0168, 3);
    expect(moveAccuracy(100)).toBe(0);
  });
});

describe('aggregateAccuracy', () => {
  it('blends the weighted mean with the harmonic mean', () => {
    expect(
      aggregateAccuracy([
        { accuracy: 100, weight: 1 },
        { accuracy: 50, weight: 1 },
      ]),
    ).toBeCloseTo(70.8333, 3);
  });

  it('floors a zero at one for the harmonic mean, as lichess does', () => {
    expect(
      aggregateAccuracy([
        { accuracy: 100, weight: 1 },
        { accuracy: 0, weight: 1 },
      ]),
    ).toBeCloseTo(25.9901, 3);
  });

  it('has no accuracy without a move', () => {
    expect(aggregateAccuracy([])).toBeNull();
  });
});

describe('accuracyWeights', () => {
  it('gives a flat game the floor weight on every move', () => {
    expect(accuracyWeights([50, 50, 50])).toEqual([0.5, 0.5]);
  });

  it('clamps a volatile window to twelve', () => {
    expect(accuracyWeights([0, 100])).toEqual([12]);
  });

  it('drops a window that holds a missing score', () => {
    expect(accuracyWeights([50, null, 50])).toEqual([null, null]);
  });

  it('shifts the first window by its fill copies, as lichess does', () => {
    // Thirty moves make a three-position window with one copy of the first window. The block
    // pattern makes a window that spans a boundary volatile and one inside a block flat.
    const values = Array.from({ length: 31 }, (_, index) =>
      Math.floor(index / 3) % 2 === 0 ? 0 : 100,
    );

    const weights = accuracyWeights(values);

    expect(weights.slice(0, 5)).toEqual([0.5, 0.5, 12, 12, 0.5]);
  });
});

describe('materialTotal and phaseOf', () => {
  it('counts the initial material and splits a game from the start position', () => {
    expect(materialTotal(START_FEN)).toBe(78);
    expect(phaseOf(START_FEN, 1)).toBe('opening');
    expect(phaseOf(START_FEN, 20)).toBe('opening');
    expect(phaseOf(START_FEN, 21)).toBe('middlegame');
  });

  it('calls a bare-king position an endgame', () => {
    const endgame = '8/8/8/8/8/8/4k3/4K3 w - - 0 40';

    expect(materialTotal(endgame)).toBe(0);
    expect(phaseOf(endgame, 40)).toBe('endgame');
  });

  it('does not call the first moves of a position an opening', () => {
    const midGame = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 32';

    expect(phaseOf(START_FEN, 2, midGame)).toBe('middlegame');
  });
});

describe('isForced', () => {
  it('sees a position with one legal move and one with many', () => {
    const forced = '2b3nr/rp2k2p/n1p1p1pB/p4pP1/PP1p4/2qP1P2/R1K1P1BP/3Qb1NR w - - 0 25';

    expect(isForced(forced)).toBe(true);
    expect(isForced(START_FEN)).toBe(false);
  });
});

describe('markOf', () => {
  it('marks the notable classes and leaves the rest plain', () => {
    expect(markOf('best')).toBe('best');
    expect(markOf('inaccuracy')).toBe('inaccuracy');
    expect(markOf('mistake')).toBe('mistake');
    expect(markOf('blunder')).toBe('blunder');
    expect(markOf('missed-win')).toBe('missed-win');
    expect(markOf('turning-point')).toBe('turning-point');
    expect(markOf('excellent')).toBeNull();
    expect(markOf('good')).toBeNull();
    expect(markOf('unknown')).toBeNull();
  });
});

describe('selectKeyMoments', () => {
  it('keeps the biggest losses and one turnaround, in game order', () => {
    const moves = [
      move({ ply: 1, drop: 25, class: 'blunder' }),
      move({ ply: 2, drop: 24, class: 'blunder' }),
      move({ ply: 3, drop: 23, class: 'blunder' }),
      move({ ply: 4, drop: 22, class: 'blunder' }),
      move({ ply: 5, drop: 21, class: 'blunder' }),
      move({ ply: 6, drop: 20, class: 'blunder' }),
      move({ ply: 7, drop: 0, class: 'turning-point', winBefore: 45, winAfter: 80 }),
    ];

    expect(selectKeyMoments(moves, 'white').map((entry) => entry.ply)).toEqual([1, 2, 3, 4, 7]);
  });

  it('breaks a tie by the earlier move', () => {
    const moves = [
      move({ ply: 5, drop: 25, class: 'blunder' }),
      move({ ply: 2, drop: 25, class: 'blunder' }),
    ];

    expect(selectKeyMoments(moves, 'white').map((entry) => entry.ply)).toEqual([2, 5]);
  });

  it('leaves the repertoire and the opponent out', () => {
    expect(selectKeyMoments([move({ drop: 30, class: 'blunder', book: true })], 'white')).toEqual(
      [],
    );
    expect(
      selectKeyMoments([move({ side: 'black', drop: 30, class: 'blunder' })], 'white'),
    ).toEqual([]);
  });
});

describe('buildReport', () => {
  it('reports both sides from a game where every move is best', () => {
    const report = reportFor(['e2e4', 'e7e5'], {
      0: { bestMove: 'e2e4', score: CP(10) },
      1: { bestMove: 'e7e5', score: CP(-10) },
      2: { bestMove: 'g1f3', score: CP(10) },
    });

    expect(report.moves).toHaveLength(2);
    expect(report.moves[0]).toMatchObject({
      ply: 1,
      side: 'white',
      san: 'e4',
      class: 'best',
      book: false,
      phase: 'opening',
    });
    expect(report.moves[1]).toMatchObject({ ply: 2, side: 'black', san: 'e5', class: 'best' });
    expect(report.user.accuracy).toBe(100);
    expect(report.opponent.accuracy).toBe(100);
    expect(report.user.counts.best).toBe(1);
    expect(report.evalCurve).toHaveLength(3);
    expect(report.evalCurve[0]?.userWin).toBeGreaterThan(50);
    expect(report.keyMoments).toEqual([]);
  });

  it('grades a blunder, its accuracy and the key moment', () => {
    const report = reportFor(['e2e4', 'e7e5'], {
      0: { bestMove: 'd2d4', score: CP(20) },
      1: { bestMove: 'e7e5', score: CP(500) },
      2: { bestMove: 'g1f3', score: CP(10) },
    });

    expect(report.moves[0]).toMatchObject({ class: 'blunder', bestSan: 'd4' });
    expect(report.user.counts.blunder).toBe(1);
    expect(report.user.accuracy).toBeLessThan(20);
    expect(report.keyMoments.map((entry) => entry.ply)).toEqual([1]);
    expect(report.evalCurve[1]?.userWin).toBeLessThan(20);
  });

  it('marks the repertoire moves without putting them in the histogram', () => {
    const line: OpeningLine = {
      id: 'london',
      name: 'London',
      color: 'white',
      note: 'A line',
      moves: ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3'],
    };

    const report = reportFor(
      ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3'],
      {
        0: { bestMove: 'd2d4', score: CP(0) },
        1: { bestMove: 'd7d5', score: CP(0) },
        2: { bestMove: 'c1f4', score: CP(0) },
        3: { bestMove: 'g8f6', score: CP(0) },
        4: { bestMove: 'e2e3', score: CP(0) },
      },
      { openings: [line] },
    );

    expect(report.opening).toMatchObject({ followed: 5, deviation: null });
    expect(report.moves.every((entry) => entry.book)).toBe(true);
    expect(report.user.bookMoves).toBe(3);
    expect(report.user.counts.best).toBe(0);
    expect(report.user.accuracy).toBe(100);
  });

  it('keeps a missing score out of the accuracy and the curve', () => {
    const report = reportFor(['e2e4', 'e7e5'], {
      0: { bestMove: 'e2e4', score: null },
      1: { bestMove: 'e7e5', score: CP(0) },
      2: { bestMove: 'g1f3', score: CP(0) },
    });

    expect(report.moves[0]?.class).toBe('unknown');
    expect(report.user.accuracy).toBeNull();
    expect(report.evalCurve[0]?.userWin).toBeNull();
  });

  it('has no accuracy for a game with no move', () => {
    const report = reportFor([], {});

    expect(report.moves).toEqual([]);
    expect(report.user.accuracy).toBeNull();
    expect(report.evalCurve).toEqual([{ ply: 0, userWin: null }]);
    expect(report.keyMoments).toEqual([]);
  });

  it('keeps the one-move accuracy on a short game', () => {
    const report = reportFor(['e2e4'], {
      0: { bestMove: 'e2e4', score: CP(377) },
      1: { bestMove: 'e7e5', score: CP(-110) },
    });

    expect(report.moves[0]?.class).toBe('missed-win');
    expect(report.user.accuracy).toBeCloseTo(moveAccuracy(report.moves[0]!.drop!), 6);
    expect(report.user.accuracy).toBeGreaterThan(39);
    expect(report.user.accuracy).toBeLessThan(42);
  });
});
