import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import {
  playOpeningMove,
  restartOpening,
  rewindOpening,
  startOpening,
  type OpeningLine,
} from './opening';

const london: OpeningLine = {
  id: 'london-demo',
  name: 'London',
  note: 'Une note.',
  color: 'white',
  moves: ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3'],
};

const french: OpeningLine = {
  id: 'french-demo',
  name: 'Française',
  note: 'Une note.',
  color: 'black',
  moves: ['e2e4', 'e7e6', 'd2d4', 'd7d5'],
};

/** The repertoire stops after the opponent's reply: the line is complete without another user move. */
const replyLast: OpeningLine = {
  id: 'reply-last',
  name: 'Réponse finale',
  note: 'Une note.',
  color: 'white',
  moves: ['d2d4', 'd7d5'],
};

/** A line no repertoire would hold, only a promotion on its last user move. */
const promotionLine: OpeningLine = {
  id: 'promotion-demo',
  name: 'Promotion',
  note: 'Une note.',
  color: 'white',
  moves: ['a2a4', 'b7b5', 'a4b5', 'a7a6', 'b5a6', 'b8c6', 'a6a7', 'c6b8', 'a7b8q'],
};

describe('opening line', () => {
  it('asks a White line for the first move from the initial position', () => {
    const state = startOpening(london);

    expect(state.outcome).toBe('playing');
    expect(state.userColor).toBe('white');
    expect(state.fen).toBe(new Chess().fen());
    expect(state.expected).toBe('d2d4');
    expect(state.corrected).toBe(false);
  });

  it('plays the opponent reply after the user move and asks again', () => {
    const state = playOpeningMove(startOpening(london), 'd2', 'd4');

    expect(state.outcome).toBe('playing');
    expect(state.index).toBe(2);
    expect(state.lastMove).toEqual(['d7', 'd5']);
    expect(state.expected).toBe('c1f4');
  });

  it('marks the line solved after the last user move', () => {
    const first = playOpeningMove(startOpening(london), 'd2', 'd4');
    const second = playOpeningMove(first, 'c1', 'f4');
    const state = playOpeningMove(second, 'e2', 'e3');

    expect(state.outcome).toBe('solved');
    expect(state.expected).toBeNull();
    expect(state.lastMove).toEqual(['e2', 'e3']);
  });

  it('marks the line solved when it stops on the opponent reply', () => {
    const state = playOpeningMove(startOpening(replyLast), 'd2', 'd4');

    expect(state.outcome).toBe('solved');
    expect(state.lastMove).toEqual(['d7', 'd5']);
  });

  it('plays the first White move before asking a Black line', () => {
    const state = startOpening(french);

    expect(state.outcome).toBe('playing');
    expect(state.userColor).toBe('black');
    expect(state.fen).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(state.lastMove).toEqual(['e2', 'e4']);
    expect(state.expected).toBe('e7e6');
  });

  it('plays White between the Black user moves', () => {
    const first = playOpeningMove(startOpening(french), 'e7', 'e6');

    expect(first.outcome).toBe('playing');
    expect(first.expected).toBe('d7d5');
    expect(first.lastMove).toEqual(['d2', 'd4']);

    const state = playOpeningMove(first, 'd7', 'd5');

    expect(state.outcome).toBe('solved');
  });

  it('refuses a legal move outside the repertoire and names the expected one', () => {
    const expectedFen = new Chess();
    expectedFen.move({ from: 'c2', to: 'c4' });

    const state = playOpeningMove(startOpening(london), 'c2', 'c4');

    expect(state.outcome).toBe('failed');
    expect(state.wrongMove).toBe('c2c4');
    expect(state.expected).toBeNull();
    expect(state.expectedSan).toBe('d4');
    expect(state.fen).toBe(expectedFen.fen());
  });

  it('refuses a Black move outside the repertoire and names the expected one', () => {
    const state = playOpeningMove(startOpening(french), 'g8', 'f6');

    expect(state.outcome).toBe('failed');
    expect(state.wrongMove).toBe('g8f6');
    expect(state.expectedSan).toBe('e6');
  });

  it('leaves the state untouched on an illegal move', () => {
    const before = startOpening(london);

    expect(playOpeningMove(before, 'd2', 'd5')).toBe(before);
  });

  it('stops accepting moves once the line is over', () => {
    const solved = playOpeningMove(startOpening(replyLast), 'd2', 'd4');

    expect(playOpeningMove(solved, 'a2', 'a3')).toBe(solved);
  });

  it('restarts from the repertoire start after a miss', () => {
    const failed = playOpeningMove(startOpening(french), 'g8', 'f6');

    const restarted = restartOpening(failed);

    expect(restarted.outcome).toBe('playing');
    expect(restarted.expected).toBe('e7e6');
    expect(restarted.lastMove).toEqual(['e2', 'e4']);
    expect(restarted.fen).toBe(startOpening(french).fen);
    expect(restarted.index).toBe(1);
  });

  it('puts the board back before a missed first move and asks it again', () => {
    const failed = playOpeningMove(startOpening(london), 'c2', 'c4');

    const state = rewindOpening(failed);

    expect(state.outcome).toBe('playing');
    expect(state.index).toBe(0);
    expect(state.expected).toBe('d2d4');
    expect(state.fen).toBe(new Chess().fen());
    expect(state.lastMove).toBeNull();
    expect(state.wrongMove).toBeNull();
    expect(state.expectedSan).toBeNull();
    expect(state.corrected).toBe(true);
  });

  it('puts a Black line back before the missed reply', () => {
    const failed = playOpeningMove(startOpening(french), 'g8', 'f6');

    const state = rewindOpening(failed);

    expect(state.outcome).toBe('playing');
    expect(state.index).toBe(1);
    expect(state.expected).toBe('e7e6');
    expect(state.lastMove).toEqual(['e2', 'e4']);
    expect(state.fen).toBe(startOpening(french).fen);
    expect(state.corrected).toBe(true);
  });

  it('keeps the moves already played before the miss', () => {
    const twoMoves = playOpeningMove(playOpeningMove(startOpening(london), 'd2', 'd4'), 'c1', 'f4');
    const failed = playOpeningMove(twoMoves, 'e2', 'e4');

    const state = rewindOpening(failed);

    expect(state.index).toBe(4);
    expect(state.expected).toBe('e2e3');
    expect(state.lastMove).toEqual(['g8', 'f6']);
    expect(state.fen).toBe(twoMoves.fen);
  });

  it('rewinds a missed promotion to the position before it', () => {
    let state = startOpening(promotionLine);
    while (state.index < 8) {
      const uci = state.expected!;
      state = playOpeningMove(state, uci.slice(0, 2), uci.slice(2, 4));
    }
    const failed = playOpeningMove(state, 'a7', 'b8', 'n');

    const rewound = rewindOpening(failed);

    expect(failed.outcome).toBe('failed');
    expect(rewound.outcome).toBe('playing');
    expect(rewound.index).toBe(8);
    expect(rewound.expected).toBe('a7b8q');
    expect(rewound.fen).toBe(state.fen);
  });

  it('leaves a state that did not miss untouched', () => {
    const playing = startOpening(london);

    expect(rewindOpening(playing)).toBe(playing);

    const solved = playOpeningMove(startOpening(replyLast), 'd2', 'd4');

    expect(rewindOpening(solved)).toBe(solved);
  });

  it('keeps the correction after another miss or a finished line', () => {
    const rewound = rewindOpening(playOpeningMove(startOpening(replyLast), 'a2', 'a3'));

    const missedAgain = playOpeningMove(rewound, 'a2', 'a3');
    expect(missedAgain.outcome).toBe('failed');
    expect(missedAgain.corrected).toBe(true);

    const solved = playOpeningMove(rewound, 'd2', 'd4');
    expect(solved.outcome).toBe('solved');
    expect(solved.corrected).toBe(true);
  });

  it('clears the correction when the line restarts', () => {
    const rewound = rewindOpening(playOpeningMove(startOpening(london), 'c2', 'c4'));

    expect(restartOpening(rewound).corrected).toBe(false);
  });

  it('replays a line from the start to the end', () => {
    let state = startOpening(london);
    let plies = 0;

    while (state.outcome === 'playing') {
      const uci = state.expected!;
      state = playOpeningMove(
        state,
        uci.slice(0, 2),
        uci.slice(2, 4),
        (uci.slice(4) || undefined) as 'q' | 'r' | 'b' | 'n' | undefined,
      );
      plies += 1;
      if (plies > london.moves.length) throw new Error('the line loops');
    }

    expect(state.outcome).toBe('solved');
  });
});
