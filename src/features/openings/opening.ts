import { Chess, type Move } from 'chess.js';
import type { PromotionPiece } from '../../lib/chess';

export type LineColor = 'white' | 'black';

/** A repertoire line, played from the initial position. The user plays `color`. */
export interface OpeningLine {
  id: string;
  name: string;
  color: LineColor;
  /** UCI from the initial position. The line alternates sides. */
  moves: readonly string[];
}

export type OpeningOutcome = 'playing' | 'solved' | 'failed';

export interface OpeningState {
  line: OpeningLine;
  outcome: OpeningOutcome;
  fen: string;
  /** Index of the next move of the line. */
  index: number;
  lastMove: [string, string] | null;
  userColor: LineColor;
  /** The repertoire move the user must play now, in UCI, or null when the line is over. */
  expected: string | null;
  /** The move the user played when it was refused, in UCI. */
  wrongMove: string | null;
  /** The repertoire move that was expected, in SAN, when the user's move was refused. */
  expectedSan: string | null;
}

function applyUci(chess: Chess, uci: string): Move {
  return chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4) || undefined,
  });
}

function isUserTurn(chess: Chess, color: LineColor): boolean {
  return (chess.turn() === 'w') === (color === 'white');
}

/**
 * Builds the line's start on the board. A Black line has the opponent's first move already played,
 * so the first thing the user sees is the position they answer; a White line starts untouched.
 */
export function startOpening(line: OpeningLine): OpeningState {
  const chess = new Chess();
  let index = 0;
  let lastMove: [string, string] | null = null;

  while (index < line.moves.length && !isUserTurn(chess, line.color)) {
    const move = applyUci(chess, line.moves[index]!);
    lastMove = [move.from, move.to];
    index += 1;
  }

  const solved = index >= line.moves.length;
  return {
    line,
    outcome: solved ? 'solved' : 'playing',
    fen: chess.fen(),
    index,
    lastMove,
    userColor: line.color,
    expected: solved ? null : line.moves[index]!,
    wrongMove: null,
    expectedSan: null,
  };
}

export function playOpeningMove(
  state: OpeningState,
  from: string,
  to: string,
  promotion?: PromotionPiece,
): OpeningState {
  if (state.outcome !== 'playing' || !state.expected) return state;

  const chess = new Chess(state.fen);
  let move: Move;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    return state;
  }

  const played = `${from}${to}${move.promotion ?? ''}`;
  if (played !== state.expected) {
    // The repertoire move is the only answer: an alternative that also works is not the line
    // the user is learning. The wrong move stays on the board, as in a puzzle.
    const best = new Chess(state.fen);
    const expected = applyUci(best, state.expected);
    return {
      ...state,
      outcome: 'failed',
      fen: chess.fen(),
      lastMove: [move.from, move.to],
      expected: null,
      wrongMove: played,
      expectedSan: expected.san,
    };
  }

  let index = state.index + 1;
  let lastMove: [string, string] = [move.from, move.to];

  // The app answers for the opponent until the user has to move again or the line ends.
  while (index < state.line.moves.length && !isUserTurn(chess, state.userColor)) {
    const reply = applyUci(chess, state.line.moves[index]!);
    lastMove = [reply.from, reply.to];
    index += 1;
  }

  const solved = index >= state.line.moves.length;
  return {
    ...state,
    outcome: solved ? 'solved' : 'playing',
    fen: chess.fen(),
    index,
    lastMove,
    expected: solved ? null : state.line.moves[index]!,
    wrongMove: null,
    expectedSan: null,
  };
}

/** Puts the line back at its start after a miss or a finished attempt. */
export function restartOpening(state: OpeningState): OpeningState {
  return startOpening(state.line);
}
