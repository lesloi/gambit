import { describe, expect, it } from 'vitest';
import {
  engineTurnPly,
  flagSide,
  playMove,
  playUci,
  positionAt,
  showHint,
  startGame,
} from './game';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('play game', () => {
  it('starts from the initial position with White to move', () => {
    const state = startGame();

    expect(state).toMatchObject({
      fen: START,
      moves: [],
      lastMove: null,
      userColor: 'white',
      outcome: 'playing',
      result: null,
      assisted: false,
      hint: null,
    });
  });

  it('opens as Black when the user chose Black', () => {
    const state = startGame('black');

    expect(state).toMatchObject({
      fen: START,
      moves: [],
      userColor: 'black',
      outcome: 'playing',
    });
  });

  it('applies a legal move and records it in UCI', () => {
    const state = playMove(startGame(), 'e2', 'e4');

    expect(state.fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(state.moves).toEqual(['e2e4']);
    expect(state.lastMove).toEqual(['e2', 'e4']);
  });

  it('refuses an illegal move', () => {
    const before = startGame();

    expect(playMove(before, 'e2', 'e5')).toBe(before);
  });

  it('applies the engine move read from UCI', () => {
    const state = playUci(playMove(startGame(), 'e2', 'e4'), 'e7e5');

    expect(state.moves).toEqual(['e2e4', 'e7e5']);
    expect(state.lastMove).toEqual(['e7', 'e5']);
  });

  it('ends on mate and names the winner', () => {
    let state = playMove(startGame(), 'f2', 'f3');
    state = playUci(state, 'e7e5');
    state = playMove(state, 'g2', 'g4');
    state = playUci(state, 'd8h4');

    expect(state.outcome).toBe('over');
    expect(state.result).toEqual({ winner: 'black', reason: 'mate' });
  });

  it('ends on a threefold repetition', () => {
    let state = startGame();
    for (const uci of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) {
      state = playUci(state, uci);
    }

    expect(state.outcome).toBe('over');
    expect(state.result).toEqual({ winner: null, reason: 'threefold' });
  });

  it('ends on a stalemate', () => {
    let state = startGame();
    for (const uci of [
      'e2e3',
      'a7a5',
      'd1h5',
      'a8a6',
      'h5a5',
      'h7h5',
      'a5c7',
      'a6h6',
      'h2h4',
      'f7f6',
      'c7d7',
      'e8f7',
      'd7b7',
      'd8d3',
      'b7b8',
      'd3h7',
      'b8c8',
      'f7g6',
      'c8e6',
    ]) {
      state = playUci(state, uci);
    }

    expect(state.outcome).toBe('over');
    expect(state.result).toEqual({ winner: null, reason: 'stalemate' });
  });

  it('ends on a flag and names the other side as the winner', () => {
    const state = flagSide(playMove(startGame(), 'e2', 'e4'), 'white');

    expect(state.outcome).toBe('over');
    expect(state.result).toEqual({ winner: 'black', reason: 'flag' });
  });

  it('does not move once the game is over', () => {
    const over = flagSide(startGame(), 'black');

    expect(playMove(over, 'e2', 'e4')).toBe(over);
    expect(playUci(over, 'e7e5')).toBe(over);
    expect(flagSide(over, 'white')).toBe(over);
  });

  it('shows a hint and marks the game assisted', () => {
    const state = showHint(startGame(), 'g1f3');

    expect(state.assisted).toBe(true);
    expect(state.hint).toEqual({ from: 'g1', to: 'f3', uci: 'g1f3', san: 'Nf3' });
  });

  it('clears the hint when a move is played', () => {
    const state = playMove(showHint(startGame(), 'g1f3'), 'e2', 'e4');

    expect(state.hint).toBeNull();
    expect(state.assisted).toBe(true);
  });

  it('ignores a hint that names no legal move', () => {
    const before = startGame();

    expect(showHint(before, 'e2e5')).toBe(before);
  });
});

describe('the engine turn the screen does not wait for', () => {
  it('asks the engine to open when the user plays Black', () => {
    expect(engineTurnPly(startGame('black'), null)).toBe(0);
  });

  it('leaves the opening to the user when they play White', () => {
    expect(engineTurnPly(startGame('white'), null)).toBeNull();
  });

  it('asks the engine for the position a resumed game was left at', () => {
    const state = playUci(startGame('white'), 'e2e4');

    expect(engineTurnPly(state, 1)).toBe(1);
  });

  it('asks nothing for a position the resumed game has moved past', () => {
    const state = playUci(playUci(startGame('black'), 'e2e4'), 'e7e5');

    expect(engineTurnPly(state, 1)).toBeNull();
  });

  it('waits for the user when the resumed position is theirs', () => {
    const state = playUci(startGame('black'), 'e2e4');

    expect(engineTurnPly(state, 1)).toBeNull();
  });

  it('asks nothing once the game is over', () => {
    const state = flagSide(startGame('black'), 'white');

    expect(engineTurnPly(state, null)).toBeNull();
  });
});

describe('position at a ply', () => {
  it('returns the start before any move', () => {
    expect(positionAt(startGame(), 0)).toEqual({ fen: START, lastMove: null });
  });

  it('returns the position after a past move, with that move highlighted', () => {
    const state = playUci(playMove(startGame(), 'e2', 'e4'), 'e7e5');

    expect(positionAt(state, 1)).toEqual({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      lastMove: ['e2', 'e4'],
    });
  });

  it('returns the live position at the end of the game', () => {
    const state = playUci(playMove(startGame(), 'e2', 'e4'), 'e7e5');

    expect(positionAt(state, 2)).toEqual({ fen: state.fen, lastMove: state.lastMove });
  });

  it('clamps a ply outside the game', () => {
    const state = playUci(playMove(startGame(), 'e2', 'e4'), 'e7e5');

    expect(positionAt(state, 9)).toEqual(positionAt(state, 2));
    expect(positionAt(state, -3)).toEqual(positionAt(state, 0));
  });
});
