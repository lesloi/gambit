import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { canMate, gameEnd } from './position';

const SHUFFLE = ['g1f3', 'g8f6', 'f3g1', 'f6g8'] as const;

/** The start position and every position after a knight shuffle, oldest first. */
function shuffled(plies: number): string[] {
  const chess = new Chess();
  const positions = [chess.fen()];

  for (let ply = 0; ply < plies; ply += 1) {
    const uci = SHUFFLE[ply % SHUFFLE.length];
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    positions.push(chess.fen());
  }

  return positions;
}

describe('the end of a game', () => {
  it('ends on the fifth occurrence of a position', () => {
    const positions = shuffled(16);

    expect(gameEnd(positions[16], positions)).toEqual({ kind: 'fivefold' });
  });

  it('keeps playing on the fourth occurrence', () => {
    const positions = shuffled(12);

    expect(gameEnd(positions[12], positions)).toBeNull();
  });

  it('ends on the seventy-five-move rule, not before', () => {
    const before = '8/8/8/4k3/8/8/5K2/6Q1 w - - 149 80';
    const reached = '8/8/8/4k3/8/8/5K2/6Q1 w - - 150 80';

    expect(gameEnd(before, [before])).toBeNull();
    expect(gameEnd(reached, [reached])).toEqual({ kind: 'seventy-five-move' });
  });

  it('lets checkmate take precedence over the seventy-five-move rule', () => {
    const mate = '7k/6Q1/6K1/8/8/8/8/8 b - - 150 100';

    expect(gameEnd(mate, [mate])).toEqual({ kind: 'mate', winner: 'white' });
  });
});

describe('the material that can mate', () => {
  it('cannot mate with a bare king', () => {
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

    expect(canMate(fen, 'white')).toBe(false);
    expect(canMate(fen, 'black')).toBe(false);
  });

  it('cannot mate with a lone bishop or a lone knight', () => {
    expect(canMate('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', 'white')).toBe(false);
    expect(canMate('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', 'white')).toBe(false);
  });

  it('cannot mate with bishops all on one colour', () => {
    expect(canMate('4k3/8/8/8/8/B7/8/2B1K3 w - - 0 1', 'white')).toBe(false);
  });

  it('mates with bishops on both colours', () => {
    expect(canMate('4k3/8/8/8/2B5/B7/8/4K3 w - - 0 1', 'white')).toBe(true);
  });

  it('counts a bishop and a knight, or two knights, against a bare king', () => {
    expect(canMate('4k3/8/8/8/8/8/8/1N2K1B1 w - - 0 1', 'white')).toBe(true);
    expect(canMate('4k3/8/8/8/8/8/8/1N2K1N1 w - - 0 1', 'white')).toBe(true);
    expect(canMate('1n2k1n1/8/8/8/8/8/8/4K3 w - - 0 1', 'black')).toBe(true);
  });

  it('mates with a pawn, a rook or a queen', () => {
    expect(canMate('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', 'white')).toBe(true);
    expect(canMate('4k3/8/8/8/8/8/8/4K2R w - - 0 1', 'white')).toBe(true);
    expect(canMate('4k3/8/8/8/8/8/8/4K2Q w - - 0 1', 'white')).toBe(true);
  });

  it('reads the side it is asked about, not the side to move', () => {
    const fen = '1n6/8/8/8/8/8/4k3/Q6K w - - 0 1';

    expect(canMate(fen, 'white')).toBe(true);
    expect(canMate(fen, 'black')).toBe(false);
  });
});
