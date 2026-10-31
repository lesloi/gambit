import { Chess } from 'chess.js';
import type { PromotionPiece } from '../../lib/chess';

export type EndgameResult = 'win' | 'draw';

export interface Endgame {
  id: string;
  name: string;
  /** The user plays the side to move in this position. */
  fen: string;
  /** What the user has to achieve from this side: win the game, or hold the draw. */
  result: EndgameResult;
  goal: string;
}

export type EndgameOutcome = 'playing' | 'solved' | 'failed';

export type EndgameEnd =
  | { kind: 'mate'; winner: 'white' | 'black' }
  | { kind: 'stalemate' }
  | { kind: 'insufficient' }
  | { kind: 'fifty-move' }
  | { kind: 'threefold' };

export interface EndgameState {
  endgame: Endgame;
  outcome: EndgameOutcome;
  fen: string;
  /** Every position reached, first the start, for the repetition rule. */
  positions: readonly string[];
  lastMove: [string, string] | null;
  userColor: 'white' | 'black';
  /** Why the game ended, or null while it is still being played. */
  end: EndgameEnd | null;
}

function colorToMove(chess: Chess): 'white' | 'black' {
  return chess.turn() === 'w' ? 'white' : 'black';
}

/**
 * The four first fields identify a position: the halfmove clock and the move number change without
 * the position changing, so threefold repetition must ignore them.
 */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** How the game ended, or null while it is still being played. */
export function endgameEnd(fen: string, positions: readonly string[]): EndgameEnd | null {
  const chess = new Chess(fen);

  if (chess.isCheckmate()) {
    // The side to move is the one mated, so the other side gave mate.
    return { kind: 'mate', winner: chess.turn() === 'w' ? 'black' : 'white' };
  }
  if (chess.isStalemate()) return { kind: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { kind: 'insufficient' };

  const halfmove = Number(fen.split(' ')[4] ?? 0);
  if (halfmove >= 100) return { kind: 'fifty-move' };

  const key = positionKey(fen);
  if (positions.filter((position) => positionKey(position) === key).length >= 3) {
    return { kind: 'threefold' };
  }

  return null;
}

/** Whether the end the board reached is the result the content expects of the user's side. */
export function judgeEndgame(
  endgame: Endgame,
  userColor: 'white' | 'black',
  end: EndgameEnd,
): EndgameOutcome {
  if (end.kind === 'mate') {
    return end.winner === userColor && endgame.result === 'win' ? 'solved' : 'failed';
  }
  return endgame.result === 'draw' ? 'solved' : 'failed';
}

export function startEndgame(endgame: Endgame): EndgameState {
  const chess = new Chess(endgame.fen);
  const positions = [endgame.fen];
  const end = endgameEnd(endgame.fen, positions);

  return {
    endgame,
    outcome: end ? judgeEndgame(endgame, colorToMove(chess), end) : 'playing',
    fen: endgame.fen,
    positions,
    lastMove: null,
    userColor: colorToMove(chess),
    end,
  };
}

export function playEndgameMove(
  state: EndgameState,
  from: string,
  to: string,
  promotion?: PromotionPiece,
): EndgameState {
  if (state.outcome !== 'playing') return state;

  const chess = new Chess(state.fen);
  let lastMove: [string, string];
  try {
    const move = chess.move({ from, to, promotion });
    lastMove = [move.from, move.to];
  } catch {
    return state;
  }

  const fen = chess.fen();
  const positions = [...state.positions, fen];
  const end = endgameEnd(fen, positions);

  return {
    ...state,
    outcome: end ? judgeEndgame(state.endgame, state.userColor, end) : 'playing',
    fen,
    positions,
    lastMove,
    end,
  };
}

/** Puts the pieces back where the endgame starts, after a wrong move or a finished game. */
export function restartEndgame(state: EndgameState): EndgameState {
  return startEndgame(state.endgame);
}
