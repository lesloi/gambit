import { Chess, type Move } from 'chess.js';
import type { PromotionPiece } from '../../lib/chess';

export { legalDests, promotionPieces } from '../../lib/chess';
export type { PromotionPiece } from '../../lib/chess';

export interface Puzzle {
  id: string;
  fen: string;
  /** The solution in UCI. It starts with the user's move; the sides alternate. */
  solution: readonly string[];
  /** Lichess themes of the puzzle, shown only once the puzzle is over. */
  themes: readonly string[];
  rating: number;
  /**
   * Whether every reply of the opponent is the engine's first choice and no alternative is within
   * the build's margin. Only these puzzles are served by the full-line drill.
   */
  fullLine: boolean;
}

export type PuzzleOutcome = 'playing' | 'solved' | 'failed' | 'revealed';

export interface SolutionPly {
  /** The full-move number of the move, from the puzzle's own FEN. */
  number: number;
  side: 'white' | 'black';
  /** The position reached after this move, the start being zero. */
  ply: number;
  san: string;
  fen: string;
  lastMove: [string, string];
}

export interface SolutionRow {
  /** The full-move number, starting from the puzzle's own FEN. */
  number: number;
  /** Null when the line starts with a Black move. */
  white: SolutionPly | null;
  /** Null while White's move is the last one of the line. */
  black: SolutionPly | null;
}

export interface SolutionSheet {
  plies: SolutionPly[];
  rows: SolutionRow[];
}

export interface PuzzleState {
  puzzle: Puzzle;
  outcome: PuzzleOutcome;
  fen: string;
  /** Index of the next move of the solution. Even indexes are the user's moves. */
  index: number;
  lastMove: [string, string] | null;
  /** The moves played from the puzzle position, in UCI, replies included. */
  moves: readonly string[];
  /** The move the user must play now, in UCI, or null when the puzzle is over. */
  expected: string | null;
  /** The move the user played when it was refused, in UCI. */
  wrongMove: string | null;
  /** The move that was expected, in SAN, when the user's move was refused. */
  bestSan: string | null;
}

function moveFromUci(chess: Chess, uci: string): Move {
  return chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4) || undefined,
  });
}

function givesMate(fen: string, uci: string): boolean {
  const chess = new Chess(fen);
  moveFromUci(chess, uci);
  return chess.isCheckmate();
}

/**
 * A line from the puzzle position as a score sheet, numbered and positioned from its own FEN. It
 * defaults to the stored solution; the moves the user played are passed while they play.
 */
export function solutionSheet(
  puzzle: Puzzle,
  history: readonly string[] = puzzle.solution,
): SolutionSheet {
  const chess = new Chess(puzzle.fen);
  const plies: SolutionPly[] = [];
  const rows: SolutionRow[] = [];

  for (const uci of history) {
    const side = chess.turn() === 'w' ? 'white' : 'black';
    const number = chess.moveNumber();
    let move: Move;
    try {
      move = moveFromUci(chess, uci);
    } catch {
      // A move the board refuses ends the sheet rather than breaking it.
      break;
    }

    const ply: SolutionPly = {
      number,
      side,
      ply: plies.length + 1,
      san: move.san,
      fen: chess.fen(),
      lastMove: [move.from, move.to],
    };
    plies.push(ply);

    if (side === 'white') {
      rows.push({ number, white: ply, black: null });
      continue;
    }

    const last = rows[rows.length - 1];
    if (last && last.number === number && last.black === null) last.black = ply;
    else rows.push({ number, white: null, black: ply });
  }

  return { plies, rows };
}

export function startPuzzle(puzzle: Puzzle): PuzzleState {
  return {
    puzzle,
    outcome: 'playing',
    fen: puzzle.fen,
    index: 0,
    lastMove: null,
    moves: [],
    expected: puzzle.solution[0] ?? null,
    wrongMove: null,
    bestSan: null,
  };
}

export function playMove(
  state: PuzzleState,
  from: string,
  to: string,
  promotion?: PromotionPiece,
): PuzzleState {
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
    // The export allows several mates where the answer is mate in one, so any mate solves. The
    // scope stays there on purpose: the stored line proves nothing about a longer answer.
    if (
      state.index === 0 &&
      state.puzzle.solution.length === 1 &&
      chess.isCheckmate() &&
      givesMate(state.fen, state.expected)
    ) {
      return {
        ...state,
        outcome: 'solved',
        fen: chess.fen(),
        index: state.puzzle.solution.length,
        lastMove: [move.from, move.to],
        moves: [...state.moves, played],
        expected: null,
        wrongMove: null,
        bestSan: null,
      };
    }

    const best = new Chess(state.fen);
    const bestMove = moveFromUci(best, state.expected);
    return {
      ...state,
      outcome: 'failed',
      fen: chess.fen(),
      lastMove: [from, to],
      moves: [...state.moves, played],
      expected: null,
      wrongMove: played,
      bestSan: bestMove.san,
    };
  }

  let index = state.index + 1;
  let lastMove: [string, string] = [move.from, move.to];
  const moves = [...state.moves, played];

  // The opponent's reply is forced: apply it, then wait for the user again.
  if (index < state.puzzle.solution.length) {
    const uci = state.puzzle.solution[index];
    const reply = moveFromUci(chess, uci);
    lastMove = [reply.from, reply.to];
    moves.push(uci);
    index += 1;
  }

  const solved = index >= state.puzzle.solution.length;
  return {
    ...state,
    outcome: solved ? 'solved' : 'playing',
    fen: chess.fen(),
    index,
    lastMove,
    moves,
    expected: solved ? null : state.puzzle.solution[index],
    wrongMove: null,
    bestSan: null,
  };
}

/** Shows the whole solution, from the puzzle position even after a wrong move. */
export function revealSolution(state: PuzzleState): PuzzleState {
  if (state.outcome === 'solved') return state;

  const chess = new Chess(state.puzzle.fen);
  let lastMove: [string, string] | null = null;
  for (const uci of state.puzzle.solution) {
    const move = moveFromUci(chess, uci);
    lastMove = [move.from, move.to];
  }

  return {
    ...state,
    outcome: 'revealed',
    fen: chess.fen(),
    index: state.puzzle.solution.length,
    lastMove,
    moves: [...state.puzzle.solution],
    expected: null,
  };
}
