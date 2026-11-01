import { Chess } from 'chess.js';
import type { PromotionPiece } from '../../lib/chess';
import { gameEnd, type GameEnd, type GameResult, type Side } from '../../lib/position';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface MoveHint {
  from: string;
  to: string;
  uci: string;
  /** The move in standard notation, for the live region that announces the hint. */
  san: string;
}

export interface PlayState {
  fen: string;
  /** Every position reached, first the start, for the repetition rule. */
  positions: readonly string[];
  /** Every move played from the initial position, in UCI. */
  moves: readonly string[];
  lastMove: [string, string] | null;
  userColor: Side;
  outcome: 'playing' | 'over';
  /** How the game ended, or null while it is still being played. */
  result: GameResult | null;
  /** Set once a hint is shown; the game then stays out of the blunder list. */
  assisted: boolean;
  hint: MoveHint | null;
}

export function startGame(): PlayState {
  return {
    fen: START_FEN,
    positions: [START_FEN],
    moves: [],
    lastMove: null,
    userColor: 'white',
    outcome: 'playing',
    result: null,
    assisted: false,
    hint: null,
  };
}

function resultOf(end: GameEnd): GameResult {
  return { winner: end.kind === 'mate' ? end.winner : null, reason: end.kind };
}

export function playMove(
  state: PlayState,
  from: string,
  to: string,
  promotion?: PromotionPiece,
): PlayState {
  if (state.outcome !== 'playing') return state;

  const chess = new Chess(state.fen);
  let move;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    return state;
  }

  const fen = chess.fen();
  const positions = [...state.positions, fen];
  const end = gameEnd(fen, positions);
  const uci = `${move.from}${move.to}${move.promotion ?? ''}`;

  return {
    ...state,
    fen,
    positions,
    moves: [...state.moves, uci],
    lastMove: [move.from, move.to],
    outcome: end ? 'over' : 'playing',
    result: end ? resultOf(end) : null,
    hint: null,
  };
}

export function playUci(state: PlayState, uci: string): PlayState {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? (uci.slice(4, 5) as PromotionPiece) : undefined;
  return playMove(state, from, to, promotion);
}

/** A clock event, not a position end: the flagged side loses. */
export function flagSide(state: PlayState, side: Side): PlayState {
  if (state.outcome !== 'playing') return state;

  return {
    ...state,
    outcome: 'over',
    result: { winner: side === 'white' ? 'black' : 'white', reason: 'flag' },
    hint: null,
  };
}

export function showHint(state: PlayState, uci: string): PlayState {
  if (state.outcome !== 'playing') return state;

  const chess = new Chess(state.fen);
  let move;
  try {
    move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4, 5) || undefined,
    });
  } catch {
    return state;
  }

  return {
    ...state,
    assisted: true,
    hint: { from: move.from, to: move.to, uci, san: move.san },
  };
}
