import { describe, expect, it } from 'vitest';
import type { EngineLine, Score } from '../../engine/uci';
import { START_FEN } from '../../lib/position';
import { clearlyBetter, formatScore, pvToSan, variationPositions } from './engineLines';

const CP = (cp: number): Score => ({ cp, mate: null });

function line(multipv: number, score: Score, depth?: number): EngineLine {
  return { multipv, score, pv: [], ...(depth === undefined ? {} : { depth }) };
}

describe('pvToSan', () => {
  it('walks a principal variation into standard notation', () => {
    expect(pvToSan(START_FEN, ['e2e4', 'e7e5', 'g1f3'])).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('stops at the first move the position refuses', () => {
    expect(pvToSan(START_FEN, ['e2e4', 'e2e4'])).toEqual(['e4']);
  });

  it('reads a promotion', () => {
    const fen = '8/P7/8/8/8/8/8/K6k w - - 0 1';

    expect(pvToSan(fen, ['a7a8q'])).toEqual(['a8=Q+']);
  });
});

describe('variationPositions', () => {
  it('includes the shown position and every move of the line', () => {
    const positions = variationPositions(START_FEN, ['e2e4', 'e7e5']);

    expect(positions).toHaveLength(3);
    expect(positions?.[0]).toMatchObject({ fen: START_FEN, lastMove: null, san: null });
    expect(positions?.[1]).toMatchObject({ lastMove: ['e2', 'e4'], san: 'e4' });
    expect(positions?.[2]).toMatchObject({ lastMove: ['e7', 'e5'], san: 'e5' });
  });

  it('rejects a line with a move the board refuses', () => {
    expect(variationPositions(START_FEN, ['e2e4', 'e2e5'])).toBeNull();
  });

  it('reads a promotion', () => {
    const positions = variationPositions('8/P7/8/8/8/8/8/K6k w - - 0 1', ['a7a8q']);

    expect(positions?.[1]?.fen.split(' ')[0]).toContain('Q');
    expect(positions?.[1]?.san).toBe('a8=Q+');
  });
});

describe('formatScore', () => {
  it('writes pawns from the user side', () => {
    expect(formatScore(CP(120), 'white', 'white')).toBe('+1,2');
    expect(formatScore(CP(120), 'white', 'black')).toBe('−1,2');
    expect(formatScore(CP(0), 'white', 'white')).toBe('0,0');
  });

  it('writes a mate from the user side', () => {
    expect(formatScore({ cp: null, mate: 3 }, 'white', 'white')).toBe('Mat en 3');
    expect(formatScore({ cp: null, mate: -3 }, 'white', 'white')).toBe('Mat en 3 contre toi');
    expect(formatScore({ cp: null, mate: -3 }, 'white', 'black')).toBe('Mat en 3');
    expect(formatScore({ cp: null, mate: 0 }, 'white', 'white')).toBe('Mat');
  });
});

describe('clearlyBetter', () => {
  it('needs two lines at the same depth and ten win points between them', () => {
    expect(clearlyBetter([line(1, CP(111), 12), line(2, CP(0), 12)])).toBe(true);
    expect(clearlyBetter([line(1, CP(100), 12), line(2, CP(0), 12)])).toBe(false);
    expect(clearlyBetter([line(1, CP(111), 12), line(2, CP(0), 11)])).toBe(false);
    expect(clearlyBetter([line(1, CP(111), 12)])).toBe(false);
  });
});
