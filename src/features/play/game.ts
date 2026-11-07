import { Chess } from 'chess.js';
import { moveHint, sideToMove, type MoveHint, type PromotionPiece } from '../../lib/chess';
import {
  canMate,
  gameEnd,
  START_FEN,
  type GameEnd,
  type GameResult,
  type Side,
} from '../../lib/position';

export { START_FEN } from '../../lib/position';

export interface PlayState {
  /** The position the game started from. */
  startFen: string;
  fen: string;
  /**
   * Every position reached from the start, for the repetition rule. A game that began from a
   * position counts its repetitions from there, not from a line the position was reached by.
   */
  positions: readonly string[];
  /** Every move played from the start position, in UCI. */
  moves: readonly string[];
  lastMove: [string, string] | null;
  userColor: Side;
  /** Whether the game has a clock; an untimed game never flags. */
  clocked: boolean;
  outcome: 'playing' | 'over';
  /** How the game ended, or null while it is still being played. */
  result: GameResult | null;
  /** Set once a hint is shown; the game then stays out of the blunder list. */
  assisted: boolean;
  hint: MoveHint | null;
}

/**
 * A game from `startFen`, which is the standard position unless a puzzle handed one over. The
 * halfmove clock and the fullmove number come from the FEN, so a position one move from the
 * 75-move draw can finish at once; `gameEnd` decides that at the start.
 */
export function startGame(
  userColor: Side = 'white',
  startFen: string = START_FEN,
  clocked = true,
): PlayState {
  const end = gameEnd(startFen, [startFen]);

  return {
    startFen,
    fen: startFen,
    positions: [startFen],
    moves: [],
    lastMove: null,
    userColor,
    clocked,
    outcome: end ? 'over' : 'playing',
    result: end ? resultOf(end) : null,
    assisted: false,
    hint: null,
  };
}

/**
 * The ply whose position the engine must answer on its own: the opening of a game the user plays
 * as Black, the position a resumed game was left at, and the position a failed engine has to take
 * over again. Null while it is the user's turn or once the game is over.
 */
export function engineTurnPly(state: PlayState): number | null {
  if (state.outcome !== 'playing' || sideToMove(state.fen) === state.userColor) return null;

  return state.moves.length;
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

export interface BoardPosition {
  fen: string;
  lastMove: [string, string] | null;
}

/**
 * The position after `ply` moves, the start at zero. A ply outside the game clamps to its nearer
 * end, so the live position stays the last one.
 */
export function positionAt(state: PlayState, ply: number): BoardPosition {
  const at = Math.max(0, Math.min(ply, state.moves.length));
  if (at === state.moves.length) return { fen: state.fen, lastMove: state.lastMove };
  if (at === 0) return { fen: state.positions[0], lastMove: null };

  const uci = state.moves[at - 1];
  return {
    fen: state.positions[at],
    lastMove: [uci.slice(0, 2), uci.slice(2, 4)],
  };
}

export function playUci(state: PlayState, uci: string): PlayState {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? (uci.slice(4, 5) as PromotionPiece) : undefined;
  return playMove(state, from, to, promotion);
}

/**
 * A clock event, not a position end: the flagged side loses unless the other side cannot mate.
 * An untimed game has no clock to fall, so the state is left alone.
 */
export function flagSide(state: PlayState, side: Side): PlayState {
  if (state.outcome !== 'playing' || !state.clocked) return state;

  const other = side === 'white' ? 'black' : 'white';
  const drawn = !canMate(state.fen, other);

  return {
    ...state,
    outcome: 'over',
    result: drawn ? { winner: null, reason: 'flag-draw' } : { winner: other, reason: 'flag' },
    hint: null,
  };
}

export function showHint(state: PlayState, uci: string): PlayState {
  if (state.outcome !== 'playing') return state;

  const hint = moveHint(state.fen, uci);
  if (hint === null) return state;

  return { ...state, assisted: true, hint };
}
