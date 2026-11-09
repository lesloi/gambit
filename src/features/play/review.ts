import { Chess } from 'chess.js';
import type { PositionEval, Score } from '../../engine/uci';
import { START_FEN, type Side } from '../../lib/position';
import type { OpeningLine } from '../openings/opening';
import type { GamePosition } from './analysis';
import { matchOpening, sameMove, type OpeningReport } from './openingMatch';
import { scoreCp, userScore, winPercent } from './score';

/** Win points a move must give away to count as a blunder. */
export const BLUNDER_WIN_POINTS = 20;

/** Winning chance above which the position before the move was already won. */
export const WINNING_WIN_PERCENT = 70;

const EXCELLENT_WIN_POINTS = 2;
const GOOD_WIN_POINTS = 5;
const INACCURACY_WIN_POINTS = 10;
const TURNING_WIN_PERCENT = 50;
const KEY_MOMENT_WIN_POINTS = 5;
const KEY_MOMENT_LIMIT = 5;
const ENDGAME_MATERIAL = 20;
const OPENING_PLIES = 20;

export type MoveClass =
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed-win'
  | 'turning-point'
  | 'unknown';

/** The classes the score sheet marks with a glyph; the rest stay plain. */
export type MoveMark =
  'best' | 'inaccuracy' | 'mistake' | 'blunder' | 'missed-win' | 'turning-point';

export type Phase = 'opening' | 'middlegame' | 'endgame';

export interface MoveReview {
  /** The score sheet's ply, from one. */
  ply: number;
  moveNumber: number;
  side: Side;
  san: string;
  uci: string;
  /** The position before the move, the one the board shows for a finding. */
  fenBefore: string;
  lastMoveBefore: [string, string] | null;
  bestUci: string | null;
  bestSan: string | null;
  /** Both scores are from the side to move at their own position. */
  scoreBefore: Score | null;
  scoreAfter: Score | null;
  /** The mover's winning chance before and after the move. */
  winBefore: number | null;
  winAfter: number | null;
  /** Win points the mover gave away, never negative. Null when a score is missing. */
  drop: number | null;
  /** The same loss in centipawns, for the average. */
  cpLoss: number | null;
  class: MoveClass;
  phase: Phase;
  /** The move is inside the user's repertoire line; it is not judged in the summary. */
  book: boolean;
  /** The position had only one legal move, so the user had no choice. */
  forced: boolean;
  /** The user left the repertoire here. */
  deviation: boolean;
}

export interface EvalPoint {
  ply: number;
  /** The user's winning chance after this position, or null when the engine had no score. */
  userWin: number | null;
}

export type ClassCounts = Record<MoveClass, number>;

export interface PhaseAccuracy {
  accuracy: number | null;
  moves: number;
}

export interface SideReport {
  /** Every move played by the side, including the repertoire's and the unjudged ones. */
  moves: number;
  accuracy: number | null;
  /** Average centipawn loss, in centipawns. */
  acpl: number | null;
  counts: ClassCounts;
  phases: Record<Phase, PhaseAccuracy>;
  bookMoves: number;
}

export interface GameReport {
  /** One entry per move, both sides, ordered by ply. */
  moves: MoveReview[];
  user: SideReport;
  opponent: SideReport;
  /** The user's winning chance after every position, the start included. */
  evalCurve: EvalPoint[];
  keyMoments: MoveReview[];
  opening: OpeningReport | null;
  userColor: Side;
  startFen: string;
}

export interface ClassifyInput {
  drop: number | null;
  playedUci: string;
  bestUci: string | null;
  winBefore: number | null;
  winAfter: number | null;
  forced: boolean;
}

/**
 * A move's class from the win points it gave away. A forced move and a move without a score are
 * `unknown`: the user had no choice, or the engine said nothing, and neither is a judgement.
 */
export function classifyMove(input: ClassifyInput): MoveClass {
  if (input.forced || input.drop === null || input.winBefore === null || input.winAfter === null) {
    return 'unknown';
  }

  const { drop, playedUci, bestUci, winBefore, winAfter } = input;
  if (drop < EXCELLENT_WIN_POINTS) {
    if (winBefore < TURNING_WIN_PERCENT && winAfter >= WINNING_WIN_PERCENT) return 'turning-point';
    return playedUci === bestUci ? 'best' : 'excellent';
  }
  if (drop < GOOD_WIN_POINTS) return 'good';
  if (drop < INACCURACY_WIN_POINTS) return 'inaccuracy';
  if (drop < BLUNDER_WIN_POINTS) return 'mistake';
  if (winBefore >= WINNING_WIN_PERCENT) return 'missed-win';
  return 'blunder';
}

/** The glyph a move gets in the score sheet, or null when it stays plain. */
export function markOf(kind: MoveClass): MoveMark | null {
  switch (kind) {
    case 'best':
    case 'inaccuracy':
    case 'mistake':
    case 'blunder':
    case 'missed-win':
    case 'turning-point':
      return kind;
    default:
      return null;
  }
}

/**
 * A move's accuracy, from the win points it gave away. The formula and its uncertainty bonus are
 * lichess's (`AccuracyPercent.scala`, modules/analyse), so a move reads the same way here.
 */
export function moveAccuracy(drop: number): number {
  if (drop <= 0) return 100;

  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * drop) - 3.166924740191411 + 1;
  return Math.min(100, Math.max(0, raw));
}

/**
 * The blend lichess uses for a game: the volatility-weighted mean of the moves and their harmonic
 * mean, averaged. The harmonic mean is what makes one bad move count more than one good move.
 */
export function aggregateAccuracy(
  samples: readonly { accuracy: number; weight: number }[],
): number | null {
  if (samples.length === 0) return null;

  let weight = 0;
  let weighted = 0;
  let inverse = 0;
  for (const sample of samples) {
    weight += sample.weight;
    weighted += sample.accuracy * sample.weight;
    // Lichess floors an accuracy at one for the harmonic mean, so a zero can lower the score
    // without swallowing the whole game.
    inverse += 1 / Math.max(1, sample.accuracy);
  }

  const mean = weighted / weight;
  const harmonic = samples.length / inverse;
  return (mean + harmonic) / 2;
}

function standardDeviation(values: readonly (number | null)[]): number | null {
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length < 2 || numbers.length !== values.length) return null;

  const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  const variance = numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numbers.length;
  return Math.min(12, Math.max(0.5, Math.sqrt(variance)));
}

/**
 * The weight of each move in a game, from the volatility of the winning chance around it. The
 * size of the window and the copies of the first window are lichess's; a flat game gives every
 * move the same floor weight instead of letting one quiet stretch dominate.
 */
export function accuracyWeights(winPercents: readonly (number | null)[]): (number | null)[] {
  const moves = Math.max(0, winPercents.length - 1);
  if (moves === 0) return [];

  const windowSize = Math.min(8, Math.max(2, Math.floor(moves / 10)));
  const first = winPercents.slice(0, Math.min(windowSize, winPercents.length));
  const fill = Math.max(0, Math.min(windowSize, winPercents.length) - 2);
  const windows: (number | null)[][] = [];
  for (let index = 0; index < fill; index += 1) windows.push(first);
  for (let index = 0; index + windowSize <= winPercents.length; index += 1) {
    windows.push(winPercents.slice(index, index + windowSize));
  }

  return windows.slice(0, moves).map(standardDeviation);
}

/**
 * The winning chance of the side to move after every position, for the weight windows. Lichess
 * weights the moves from one point of view; this curve flips with the side to move, so the
 * weights can differ a little for the same game. The per-move losses and the blend are the same.
 */
function sideToMoveWinPercents(moves: readonly MoveReview[]): (number | null)[] {
  if (moves.length === 0) return [];

  const values: (number | null)[] = [];
  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index]!;
    if (index === 0) {
      values.push(move.scoreBefore === null ? null : winPercent(move.scoreBefore));
    }
    values.push(move.scoreAfter === null ? null : winPercent(move.scoreAfter));
  }
  return values;
}

function gameAccuracy(moves: readonly MoveReview[], side: Side): number | null {
  const weights = accuracyWeights(sideToMoveWinPercents(moves));
  const samples: { accuracy: number; weight: number }[] = [];

  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index]!;
    if (move.side !== side || move.class === 'unknown' || move.drop === null) continue;
    const weight = weights[index];
    if (weight === null || weight === undefined) continue;
    samples.push({ accuracy: moveAccuracy(move.drop), weight });
  }

  return aggregateAccuracy(samples);
}

function averageLoss(moves: readonly MoveReview[], side: Side): number | null {
  const losses = moves
    .filter((move) => move.side === side && move.class !== 'unknown' && move.cpLoss !== null)
    .map((move) => move.cpLoss!);
  if (losses.length === 0) return null;

  return losses.reduce((sum, loss) => sum + loss, 0) / losses.length;
}

function phaseReport(moves: readonly MoveReview[], side: Side, phase: Phase): PhaseAccuracy {
  const samples = moves
    .filter(
      (move) =>
        move.side === side &&
        move.phase === phase &&
        move.class !== 'unknown' &&
        move.drop !== null,
    )
    .map((move) => ({ accuracy: moveAccuracy(move.drop!), weight: 1 }));

  return { accuracy: aggregateAccuracy(samples), moves: samples.length };
}

function sideReport(moves: readonly MoveReview[], side: Side): SideReport {
  const own = moves.filter((move) => move.side === side);
  const counts: ClassCounts = {
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    'missed-win': 0,
    'turning-point': 0,
    unknown: 0,
  };

  for (const move of own) {
    // A repertoire move is judged in the accuracy, never in the histogram or the key moments:
    // a line the owner chose is not a mistake just because a short search disagrees.
    if (move.book || move.class === 'unknown') continue;
    counts[move.class] += 1;
  }

  return {
    moves: own.length,
    accuracy: gameAccuracy(moves, side),
    acpl: averageLoss(moves, side),
    counts,
    phases: {
      opening: phaseReport(moves, side, 'opening'),
      middlegame: phaseReport(moves, side, 'middlegame'),
      endgame: phaseReport(moves, side, 'endgame'),
    },
    bookMoves: own.filter((move) => move.book).length,
  };
}

/** The user's moves that tell the story: the biggest losses, then one turnaround. */
export function selectKeyMoments(moves: readonly MoveReview[], userColor: Side): MoveReview[] {
  const candidates = moves.filter(
    (move) => move.side === userColor && !move.book && !move.forced && move.class !== 'unknown',
  );
  const losses = candidates
    .filter((move) => move.drop !== null && move.drop >= KEY_MOMENT_WIN_POINTS)
    .sort((left, right) => right.drop! - left.drop! || left.ply - right.ply);
  const turning = candidates
    .filter((move) => move.class === 'turning-point')
    .sort((left, right) => {
      const leftGain = (left.winAfter ?? 0) - (left.winBefore ?? 0);
      const rightGain = (right.winAfter ?? 0) - (right.winBefore ?? 0);
      return rightGain - leftGain || left.ply - right.ply;
    })
    .slice(0, 1);

  const chosen = [...losses.slice(0, KEY_MOMENT_LIMIT - turning.length), ...turning];
  const unique = new Map(chosen.map((move) => [move.ply, move]));
  return [...unique.values()].sort((left, right) => left.ply - right.ply);
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** The material on the board, both sides, in pawns; kings count zero. */
export function materialTotal(fen: string): number {
  let total = 0;
  for (const row of new Chess(fen).board()) {
    for (const piece of row) {
      if (piece === null) continue;
      total += PIECE_VALUE[piece.type] ?? 0;
    }
  }
  return total;
}

/**
 * The phase a move belongs to. The opening is a fixed first ten moves; the endgame starts when
 * twenty points of material are left, a rough line that keeps the report honest without a
 * tablebase. A game from a position has no opening to speak of.
 */
export function phaseOf(fen: string, ply: number, startFen: string = START_FEN): Phase {
  if (startFen === START_FEN && ply <= OPENING_PLIES) return 'opening';
  return materialTotal(fen) <= ENDGAME_MATERIAL ? 'endgame' : 'middlegame';
}

/** A position with one legal move leaves no choice to judge. */
export function isForced(fen: string): boolean {
  try {
    return new Chess(fen).moves().length === 1;
  } catch {
    return false;
  }
}

function sanOf(fen: string, uci: string): string | null {
  try {
    return new Chess(fen).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4, 5) || undefined,
    }).san;
  } catch {
    return null;
  }
}

export interface BuildReportInput {
  positions: readonly GamePosition[];
  evals: readonly (PositionEval | null)[];
  moves: readonly string[];
  userColor: Side;
  startFen: string;
  openings: readonly OpeningLine[];
}

/** Turns the replayed game and its evaluations into the report the review shows. */
export function buildReport(input: BuildReportInput): GameReport {
  const { positions, evals, moves, userColor, startFen, openings } = input;
  const opening = matchOpening(moves, userColor, startFen, openings);
  const reviews: MoveReview[] = [];

  for (let ply = 1; ply < positions.length; ply += 1) {
    const before = positions[ply - 1]!;
    const after = positions[ply]!;
    const engineBefore = evals[ply - 1] ?? null;
    const engineAfter = evals[ply] ?? null;
    const mover = before.turn;
    const scoreBefore = engineBefore?.score ?? null;
    const scoreAfter = engineAfter?.score ?? null;
    // The score after the move belongs to the opponent; the mover's view flips it.
    const moverAfter = scoreAfter === null ? null : userScore(scoreAfter, after.turn, mover);
    const winBefore = scoreBefore === null ? null : winPercent(scoreBefore);
    const winAfter = moverAfter === null ? null : winPercent(moverAfter);
    const drop = winBefore === null || winAfter === null ? null : Math.max(0, winBefore - winAfter);
    const cpBefore = scoreBefore === null ? null : scoreCp(scoreBefore);
    const cpAfter = moverAfter === null ? null : scoreCp(moverAfter);
    const cpLoss = cpBefore === null || cpAfter === null ? null : Math.max(0, cpBefore - cpAfter);
    const bestUci = engineBefore?.bestMove ?? null;
    const bestSan = bestUci === null ? null : sanOf(before.fen, bestUci);
    const book =
      opening !== null &&
      ply <= opening.followed &&
      sameMove(opening.line.moves[ply - 1], moves[ply - 1]);
    const forced = isForced(before.fen);
    const klass = classifyMove({
      drop,
      playedUci: moves[ply - 1]!,
      bestUci,
      winBefore,
      winAfter,
      forced,
    });

    reviews.push({
      ply,
      moveNumber: before.moveNumber,
      side: mover,
      san: after.san ?? '',
      uci: moves[ply - 1]!,
      fenBefore: before.fen,
      lastMoveBefore: before.lastMove,
      bestUci,
      bestSan,
      scoreBefore,
      scoreAfter,
      winBefore,
      winAfter,
      drop,
      cpLoss,
      class: klass,
      phase: phaseOf(after.fen, ply, startFen),
      book,
      forced,
      deviation: opening?.deviation?.ply === ply,
    });
  }

  const evalCurve: EvalPoint[] = positions.map((position, ply) => {
    const score = evals[ply]?.score ?? null;
    return {
      ply,
      userWin: score === null ? null : winPercent(userScore(score, position.turn, userColor)),
    };
  });

  return {
    moves: reviews,
    user: sideReport(reviews, userColor),
    opponent: sideReport(reviews, userColor === 'white' ? 'black' : 'white'),
    evalCurve,
    keyMoments: selectKeyMoments(reviews, userColor),
    opening,
    userColor,
    startFen,
  };
}
