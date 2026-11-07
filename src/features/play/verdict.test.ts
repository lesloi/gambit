import { describe, expect, it } from 'vitest';
import type { Score } from '../../engine/uci';
import { DIFFICULT_WIN_PERCENT, startVerdict } from './verdict';

const CP = (cp: number): Score => ({ cp, mate: null });

describe('start verdict', () => {
  it('calls a level position even', () => {
    expect(startVerdict(CP(0), 'white', 'white')).toEqual({
      label: 'even',
      winPercent: 50,
      score: '0,0',
    });
  });

  it('calls the two thresholds winning and difficult', () => {
    expect(startVerdict(CP(243), 'white', 'white')?.label).toBe('winning');
    expect(startVerdict(CP(217), 'white', 'white')?.label).toBe('even');
    expect(startVerdict(CP(-217), 'white', 'white')?.label).toBe('even');
    expect(startVerdict(CP(-243), 'white', 'white')?.label).toBe('difficult');
    expect(DIFFICULT_WIN_PERCENT).toBe(30);
  });

  it('reads the score from the user side', () => {
    expect(startVerdict(CP(243), 'black', 'white')).toEqual({
      label: 'difficult',
      winPercent: 29,
      score: '-2,4',
    });
    expect(startVerdict(CP(-243), 'black', 'white')).toEqual({
      label: 'winning',
      winPercent: 71,
      score: '+2,4',
    });
  });

  it('writes the score in pawns with a comma and a sign', () => {
    expect(startVerdict(CP(230), 'white', 'white')?.score).toBe('+2,3');
    expect(startVerdict(CP(-120), 'white', 'white')?.score).toBe('-1,2');
  });

  it('reads a mate as winning or difficult and names it in the score', () => {
    expect(startVerdict({ cp: null, mate: 5 }, 'white', 'white')).toEqual({
      label: 'winning',
      winPercent: 100,
      score: 'M5',
    });
    expect(startVerdict({ cp: null, mate: -5 }, 'white', 'white')).toEqual({
      label: 'difficult',
      winPercent: 0,
      score: '-M5',
    });
  });

  it('reads a mate from the other side', () => {
    expect(startVerdict({ cp: null, mate: 5 }, 'white', 'black')).toMatchObject({
      label: 'difficult',
      winPercent: 0,
      score: '-M5',
    });
  });

  it('has no verdict when the engine reported no score', () => {
    expect(startVerdict({ cp: null, mate: null }, 'white', 'white')).toBeNull();
  });
});
