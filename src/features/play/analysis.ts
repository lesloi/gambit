import { Chess } from 'chess.js';
import type { PositionEval, Score } from '../../engine/uci';
import type { PromotionPiece } from '../../lib/chess';
import { gameEnd, START_FEN, type Side } from '../../lib/position';
import type { OpeningLine } from '../openings/opening';
import { buildReport, type GameReport } from './review';

export { winPercent, userScore } from './score';
export { BLUNDER_WIN_POINTS, WINNING_WIN_PERCENT } from './review';

/**
 * How long the engine looks at each position, in milliseconds. A review used to need only the
 * moves that lost twenty points, so 300 ms was enough; the classes and the accuracy read finer
 * differences, so the search gets a little longer.
 */
export const ANALYSIS_MOVETIME_MS = 500;

/**
 * The one-off search behind the line panel. It is read, not skimmed, and two lines split the
 * search: a little longer than the pass keeps the depths close enough for the "clearly better"
 * badge to mean something.
 */
export const LINES_MOVETIME_MS = 1200;

export interface GamePosition {
  fen: string;
  /** The move that reached this position in SAN, or null at the start. */
  san: string | null;
  lastMove: [string, string] | null;
  turn: Side;
  /** The full-move number of the move about to be played from this position. */
  moveNumber: number;
}

export interface Finding {
  /** The move's index in the game, from zero. */
  ply: number;
  moveNumber: number;
  side: Side;
  /** The position before the move, the one the board shows. */
  fen: string;
  /** The move that reached `fen`, highlighted on the board. */
  lastMove: [string, string] | null;
  playedSan: string;
  bestUci: string;
  bestSan: string;
  kind: 'blunder' | 'missed-win';
}

export type Evaluate = (fen: string) => Promise<PositionEval>;

export interface ReviewOptions {
  onProgress?: (done: number, total: number) => void;
  /** Checked between positions, so leaving the screen stops the review. */
  cancelled?: () => boolean;
  /** The repertoire the game is compared with, for the book moves and the opening report. */
  openings?: readonly OpeningLine[];
}

/** Replays the game's moves from its start position, for the board and the analysis. */
export function replayMoves(
  moves: readonly string[],
  startFen: string = START_FEN,
): GamePosition[] {
  const chess = new Chess(startFen);
  const positions: GamePosition[] = [
    {
      fen: chess.fen(),
      san: null,
      lastMove: null,
      turn: chess.turn() === 'w' ? 'white' : 'black',
      moveNumber: chess.moveNumber(),
    },
  ];

  for (const uci of moves) {
    const move = chess.move(moveFromUci(uci));
    positions.push({
      fen: chess.fen(),
      san: move.san,
      lastMove: [move.from, move.to],
      turn: chess.turn() === 'w' ? 'white' : 'black',
      moveNumber: chess.moveNumber(),
    });
  }

  return positions;
}

/**
 * Reads the game once: every position is evaluated at full strength, then the report turns the
 * scores into a class for every move, an accuracy for each side, an evaluation curve and the
 * moments worth looking at.
 */
export async function reviewGameReport(
  evaluate: Evaluate,
  game: { moves: readonly string[]; userColor: Side; startFen?: string },
  options: ReviewOptions = {},
): Promise<GameReport | null> {
  const positions = replayMoves(game.moves, game.startFen);
  const fens = positions.map((position) => position.fen);
  const terminals = fens.map((fen, index) => terminalScore(fen, fens.slice(0, index + 1)));
  const total = terminals.filter((score) => score === null).length;

  const evals: (PositionEval | null)[] = [];
  let done = 0;
  for (let index = 0; index < positions.length; index += 1) {
    if (options.cancelled?.()) return null;

    const terminal = terminals[index];
    if (terminal !== null) {
      evals.push({ bestMove: null, score: terminal });
      continue;
    }

    evals.push(await evaluate(fens[index]));
    if (options.cancelled?.()) return null;

    done += 1;
    options.onProgress?.(done, total);
  }

  return buildReport({
    positions,
    evals,
    moves: game.moves,
    userColor: game.userColor,
    startFen: game.startFen ?? START_FEN,
    openings: options.openings ?? [],
  });
}

/**
 * The findings the score sheet used to show, derived from the report so the older callers keep
 * their contract. Only the user's moves are judged, and only the two kinds that were kept.
 */
export async function reviewGame(
  evaluate: Evaluate,
  game: { moves: readonly string[]; userColor: Side; startFen?: string },
  options: ReviewOptions = {},
): Promise<Finding[] | null> {
  const report = await reviewGameReport(evaluate, game, options);
  if (report === null) return null;

  return report.moves
    .filter(
      (move) =>
        move.side === game.userColor &&
        move.bestUci !== null &&
        move.bestSan !== null &&
        (move.class === 'blunder' || move.class === 'missed-win'),
    )
    .map((move) => ({
      ply: move.ply - 1,
      moveNumber: move.moveNumber,
      side: move.side,
      fen: move.fenBefore,
      lastMove: move.lastMoveBefore,
      playedSan: move.san,
      bestUci: move.bestUci!,
      bestSan: move.bestSan!,
      kind: move.class as 'blunder' | 'missed-win',
    }));
}

/**
 * The findings keyed by the score sheet's ply. A finding names the position before the move, while
 * the sheet counts the move that produced a position from one, so the played move is one ahead.
 */
export function findingsBySheetPly(findings: readonly Finding[]): ReadonlyMap<number, Finding> {
  return new Map(findings.map((finding) => [finding.ply + 1, finding]));
}

/** A position that already ended is scored from the rules, never from the engine. */
function terminalScore(fen: string, positions: readonly string[]): Score | null {
  const end = gameEnd(fen, positions);
  if (end === null) return null;

  // The side to move is the one that got mated.
  return end.kind === 'mate' ? { cp: null, mate: -1 } : { cp: 0, mate: null };
}

function moveFromUci(uci: string): { from: string; to: string; promotion?: PromotionPiece } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? (uci.slice(4, 5) as PromotionPiece) : undefined,
  };
}
