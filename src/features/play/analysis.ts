import { Chess } from 'chess.js';
import type { PositionEval, Score } from '../../engine/uci';
import type { PromotionPiece } from '../../lib/chess';
import { gameEnd, type Side } from '../../lib/position';

/** How long the engine looks at each position, in milliseconds. */
export const ANALYSIS_MOVETIME_MS = 300;

/** Points of winning chance a move must give away to count as a blunder. */
export const BLUNDER_WIN_POINTS = 20;

/** Winning chance above which the position before the move was already won. */
export const WINNING_WIN_PERCENT = 70;

/** The scale of the logistic that turns centipawns into a winning percentage. */
const WIN_PERCENT_SCALE = 0.00368208;

export interface GamePosition {
  fen: string;
  /** The move that reached this position in SAN, or null at the start. */
  san: string | null;
  lastMove: [string, string] | null;
  turn: Side;
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
}

/** Replays the game's moves from the initial position, for the board and the analysis. */
export function replayMoves(moves: readonly string[]): GamePosition[] {
  const chess = new Chess();
  const positions: GamePosition[] = [
    { fen: chess.fen(), san: null, lastMove: null, turn: 'white' },
  ];

  for (const uci of moves) {
    const move = chess.move(moveFromUci(uci));
    positions.push({
      fen: chess.fen(),
      san: move.san,
      lastMove: [move.from, move.to],
      turn: chess.turn() === 'w' ? 'white' : 'black',
    });
  }

  return positions;
}

/**
 * Reviews every user move once: each position is evaluated at full strength, and a move is kept
 * when it costs the user at least [BLUNDER_WIN_POINTS] of winning chance. A position that was
 * already won makes it a missed win instead of a blunder.
 */
export async function reviewGame(
  evaluate: Evaluate,
  game: { moves: readonly string[]; userColor: Side },
  options: ReviewOptions = {},
): Promise<Finding[] | null> {
  const positions = replayMoves(game.moves);
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

  const findings: Finding[] = [];
  for (let ply = 0; ply < positions.length - 1; ply += 1) {
    const before = evals[ply];
    const after = evals[ply + 1];
    if (positions[ply].turn !== game.userColor || !before?.score || !after?.score) continue;
    if (!before.bestMove) continue;

    const beforeScore = userScore(before.score, positions[ply].turn, game.userColor);
    const afterScore = userScore(after.score, positions[ply + 1].turn, game.userColor);
    const wonBefore = winPercent(beforeScore);
    const wonAfter = winPercent(afterScore);
    if (wonBefore - wonAfter < BLUNDER_WIN_POINTS) continue;

    const bestSan = sanOf(fens[ply], before.bestMove);
    if (bestSan === null) continue;

    findings.push({
      ply,
      moveNumber: Math.floor(ply / 2) + 1,
      side: positions[ply].turn,
      fen: fens[ply],
      lastMove: positions[ply].lastMove,
      playedSan: positions[ply + 1].san ?? '',
      bestUci: before.bestMove,
      bestSan,
      kind: wonBefore >= WINNING_WIN_PERCENT ? 'missed-win' : 'blunder',
    });
  }

  return findings;
}

/** The chance the side holding the score wins, from 0 to 100. */
export function winPercent(score: Score): number {
  // Stockfish's `mate 0` means the side to move is already mated, not a draw.
  if (score.mate !== null) return score.mate > 0 ? 100 : 0;

  return 100 / (1 + Math.exp(-WIN_PERCENT_SCALE * (score.cp ?? 0)));
}

/** A score written from the side to move to the user's point of view. */
function userScore(score: Score, sideToMove: Side, userColor: Side): Score {
  if (sideToMove === userColor) return score;

  return {
    cp: score.cp === null ? null : -score.cp,
    mate: score.mate === null ? null : -score.mate,
  };
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

function sanOf(fen: string, uci: string): string | null {
  try {
    return new Chess(fen).move(moveFromUci(uci)).san;
  } catch {
    return null;
  }
}
