import { describe, expect, it } from 'vitest';
import {
  endgameEnd,
  judgeEndgame,
  playEndgameMove,
  restartEndgame,
  startEndgame,
  type Endgame,
} from './endgame';

const kqk: Endgame = {
  id: 'kqk',
  name: 'Dame contre roi',
  fen: '8/8/8/4k3/8/8/5K2/6Q1 w - - 0 1',
  result: 'win',
  goal: 'Mater le roi noir.',
};

const mateInOne: Endgame = {
  ...kqk,
  id: 'kqk-mate',
  fen: '8/8/8/8/8/5K2/3Q4/7k w - - 0 1',
};

const drawn: Endgame = {
  id: 'draw',
  name: 'Nulle',
  fen: '8/8/8/4k3/8/8/4K3/8 w - - 0 1',
  result: 'draw',
  goal: 'Tenir la nulle.',
};

describe('endgame play', () => {
  it('recognises a KQK mate as the win the content expects', () => {
    const state = playEndgameMove(startEndgame(mateInOne), 'd2', 'g2');

    expect(state.outcome).toBe('solved');
    expect(state.end).toEqual({ kind: 'mate', winner: 'white' });
  });

  it('fails a win the user stalemates', () => {
    const state = playEndgameMove(startEndgame(mateInOne), 'd2', 'f2');

    expect(state.outcome).toBe('failed');
    expect(state.end).toEqual({ kind: 'stalemate' });
  });

  it('solves a drawn card when the material runs out', () => {
    const end = { kind: 'insufficient' } as const;

    expect(judgeEndgame(drawn, 'white', end)).toBe('solved');
    expect(judgeEndgame(kqk, 'white', end)).toBe('failed');
  });

  it('fails a drawn card when the user gets mated', () => {
    expect(judgeEndgame(drawn, 'white', { kind: 'mate', winner: 'black' })).toBe('failed');
  });

  it('leaves the state untouched on an illegal move', () => {
    const before = startEndgame(kqk);

    expect(playEndgameMove(before, 'a1', 'a8')).toBe(before);
  });

  it('keeps the move counters out of the repetition test', () => {
    let state = startEndgame({ ...kqk, id: 'shuffle', fen: 'r3k3/8/8/8/8/8/8/R3K3 w - - 0 1' });

    for (const [from, to] of [
      ['a1', 'a2'],
      ['e8', 'd8'],
      ['a2', 'a1'],
      ['d8', 'e8'],
      ['a1', 'a2'],
      ['e8', 'd8'],
      ['a2', 'a1'],
      ['d8', 'e8'],
    ] as const) {
      state = playEndgameMove(state, from, to);
    }

    expect(state.outcome).toBe('failed');
    expect(state.end).toEqual({ kind: 'threefold' });
  });

  it('detects when the material can no longer mate', () => {
    const fen = '8/8/8/4k3/8/8/4K3/8 w - - 0 1';

    expect(endgameEnd(fen, [fen])).toEqual({ kind: 'insufficient' });
  });

  it('detects the fifty-move rule from the halfmove clock', () => {
    const fen = '8/8/8/4k3/8/8/5K2/6Q1 w - - 100 80';

    expect(endgameEnd(fen, [fen])).toEqual({ kind: 'fifty-move' });
  });

  it('restarts from the initial position after a wrong move', () => {
    const started = startEndgame(kqk);
    const played = playEndgameMove(started, 'g1', 'g2');

    const restarted = restartEndgame(played);

    expect(restarted.fen).toBe(kqk.fen);
    expect(restarted.outcome).toBe('playing');
    expect(restarted.positions).toEqual([kqk.fen]);
  });

  it('does not move once the endgame is over', () => {
    const solved = playEndgameMove(startEndgame(mateInOne), 'd2', 'g2');

    expect(playEndgameMove(solved, 'g2', 'g3')).toBe(solved);
  });
});
