import { Chess, type Move } from 'chess.js';

export interface Puzzle {
  id: string;
  fen: string;
  /** The solution in UCI. It starts with the user's move; the sides alternate. */
  solution: readonly string[];
  /** Lichess themes of the puzzle, shown only once the puzzle is over. */
  themes: readonly string[];
  rating: number;
}

export type PuzzleOutcome = 'playing' | 'solved' | 'failed' | 'revealed';

export interface PuzzleState {
  puzzle: Puzzle;
  outcome: PuzzleOutcome;
  fen: string;
  /** Index of the next move of the solution. Even indexes are the user's moves. */
  index: number;
  lastMove: [string, string] | null;
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

export function startPuzzle(puzzle: Puzzle): PuzzleState {
  return {
    puzzle,
    outcome: 'playing',
    fen: puzzle.fen,
    index: 0,
    lastMove: null,
    expected: puzzle.solution[0] ?? null,
    wrongMove: null,
    bestSan: null,
  };
}

export function playMove(state: PuzzleState, from: string, to: string): PuzzleState {
  if (state.outcome !== 'playing' || !state.expected) return state;

  const chess = new Chess(state.fen);
  let move: Move;
  try {
    move = chess.move({ from, to, promotion: 'q' });
  } catch {
    return state;
  }

  const played = `${from}${to}${move.promotion ?? ''}`;
  if (played !== state.expected) {
    const best = new Chess(state.fen);
    const bestMove = moveFromUci(best, state.expected);
    return {
      ...state,
      outcome: 'failed',
      fen: chess.fen(),
      lastMove: [from, to],
      expected: null,
      wrongMove: played,
      bestSan: bestMove.san,
    };
  }

  let index = state.index + 1;
  let lastMove: [string, string] = [move.from, move.to];

  // The opponent's reply is forced: apply it, then wait for the user again.
  if (index < state.puzzle.solution.length) {
    const reply = moveFromUci(chess, state.puzzle.solution[index]);
    lastMove = [reply.from, reply.to];
    index += 1;
  }

  const solved = index >= state.puzzle.solution.length;
  return {
    ...state,
    outcome: solved ? 'solved' : 'playing',
    fen: chess.fen(),
    index,
    lastMove,
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
    expected: null,
  };
}

/** The legal destinations of the side to move, in the shape chessground expects. */
export function legalDests(fen: string): Map<string, string[]> {
  const chess = new Chess(fen);
  const dests = new Map<string, string[]>();
  for (const move of chess.moves({ verbose: true })) {
    const list = dests.get(move.from) ?? [];
    list.push(move.to);
    dests.set(move.from, list);
  }
  return dests;
}
