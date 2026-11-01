import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../../src/features/puzzles/puzzle.ts';
import { parseInfo } from './stockfish';
import {
  analyseLine,
  clearlyBehind,
  isMateInOne,
  judgeLine,
  verifyLine,
  type Analysis,
  type AnalysisSource,
  type PlyAnalysis,
} from './verify';

/**
 * The three transcripts were recorded from Stockfish 19 at depth 18, MultiPV 2, Threads 1 and a
 * 16 MB hash, on the Lichess export of 2026-10-02. Each one keeps the final line of every multipv
 * and the engine's own `bestmove`, so the test replays recorded output rather than searching.
 */
const FIXTURES = new URL('./fixtures/', import.meta.url);

const PUZZLES: Record<string, Puzzle> = {
  // Accepted: every user move is unique and every defence is the engine's first choice.
  '0Hk7S': {
    id: '0Hk7S',
    fen: '1r1r3k/q3Npp1/3Qb2p/8/8/P2B2P1/1PP5/1K5R w - - 0 36',
    solution: ['h1h6', 'g7h6', 'd6e5', 'f7f6', 'e5f6'],
    rating: 1874,
    themes: ['mateIn3', 'sacrifice'],
    fullLine: true,
  },
  // Rejected: the last user move is a mate in one, but the second answer mates as soon.
  '0md9A': {
    id: '0md9A',
    fen: '3r3k/p2P1Qpp/1p6/2p3P1/8/P4Pbq/7P/3R3K w - - 2 36',
    solution: ['f7e8', 'd8e8', 'd7e8q'],
    rating: 1074,
    themes: ['advancedPawn', 'backRankMate', 'mateIn2', 'promotion'],
    fullLine: true,
  },
  // Kept, but out of the full-line drill: the stored defence is not the engine's first choice.
  '18yOB': {
    id: '18yOB',
    fen: '3rr3/k6p/2R3pb/2N2b2/1P6/2PP1B2/2K2P1P/8 w - - 0 35',
    solution: ['c6c7', 'a7b8', 'c5a6'],
    rating: 2107,
    themes: ['cornerMate', 'mateIn2'],
    fullLine: false,
  },
  // A one-move mate: the app accepts any mate, so the engine preferring another one is no reason.
  NNm2M: {
    id: 'NNm2M',
    fen: '3RR3/6k1/3p1pp1/5rP1/2p2PK1/1r6/8/8 w - - 0 46',
    solution: ['e8e7'],
    rating: 1357,
    themes: ['mateIn1', 'rookEndgame'],
    fullLine: true,
  },
};

const OPTIONS = { userMarginCp: 100, defenceMarginCp: 100 };

/** Reads a recorded transcript as the analysis the engine adapter would have returned. */
function recorded(id: string): AnalysisSource {
  const text = readFileSync(new URL(`${id}.txt`, FIXTURES), 'utf8');
  const byFen = new Map<string, Map<number, Analysis>>();
  let fen: string | null = null;

  for (const line of text.split('\n')) {
    if (line.startsWith('fen ')) {
      fen = line.slice('fen '.length).trim();
      byFen.set(fen, new Map());
      continue;
    }
    if (fen === null) continue;

    const info = parseInfo(line);
    if (info) byFen.get(fen)!.set(info.multipv, { move: info.move, score: info.score });
  }

  return {
    async analyse(fen) {
      const lines = byFen.get(fen);
      if (!lines) throw new Error(`No recorded analysis for ${fen}`);
      return [...lines.entries()].sort(([a], [b]) => a - b).map(([, analysis]) => analysis);
    },
  };
}

describe('verification from recorded engine output', () => {
  it('accepts a line whose user moves are unique and whose defences are forced', async () => {
    const puzzle = PUZZLES['0Hk7S']!;

    const result = await verifyLine(puzzle, recorded(puzzle.id), OPTIONS);

    expect(result).toEqual({ ok: true, fullLine: true, positions: 5 });
  });

  it('rejects a line whose second answer mates as soon as the expected one', async () => {
    const puzzle = PUZZLES['0md9A']!;

    const result = await verifyLine(puzzle, recorded(puzzle.id), OPTIONS);

    expect(result).toEqual({ ok: false, reason: 'not-clear', ply: 2, positions: 3 });
  });

  it('keeps a line but clears the full-line index when the defence is not the first choice', async () => {
    const puzzle = PUZZLES['18yOB']!;

    const result = await verifyLine(puzzle, recorded(puzzle.id), OPTIONS);

    expect(result).toEqual({ ok: true, fullLine: false, positions: 3 });
  });

  it('accepts a one-move mate even when the engine prefers another mate', async () => {
    const puzzle = PUZZLES['NNm2M']!;

    expect(isMateInOne(puzzle)).toBe(true);
    const result = await verifyLine(puzzle, recorded(puzzle.id), OPTIONS);

    expect(result).toEqual({ ok: true, fullLine: true, positions: 0 });
  });
});

describe('the full-line index', () => {
  it('clears the index when the second defensive line is within the margin', () => {
    const puzzle: Puzzle = {
      ...PUZZLES['0Hk7S']!,
      id: 'synthetic',
      solution: ['h1h6', 'g7h6'],
    };
    const analyses: PlyAnalysis[] = [
      {
        best: { move: 'h1h6', score: { kind: 'cp', value: 500 } },
        second: { move: 'd6e5', score: { kind: 'cp', value: 0 } },
      },
      {
        best: { move: 'g7h6', score: { kind: 'cp', value: -200 } },
        second: { move: 'g7g8', score: { kind: 'cp', value: -250 } },
      },
    ];

    const result = judgeLine(puzzle, analyses, OPTIONS);

    expect(result).toEqual({ ok: true, fullLine: false, positions: 2 });
  });

  it('rejects a user move the engine ranks second', () => {
    const puzzle = { ...PUZZLES['0Hk7S']!, id: 'synthetic', solution: ['h1h6'] };
    const analyses: PlyAnalysis[] = [
      {
        best: { move: 'd6e5', score: { kind: 'cp', value: 500 } },
        second: { move: 'h1h6', score: { kind: 'cp', value: 0 } },
      },
    ];

    const result = judgeLine(puzzle, analyses, OPTIONS);

    expect(result).toEqual({ ok: false, reason: 'not-best', ply: 0, positions: 1 });
  });

  it('rejects a user move whose alternative stays within the margin', () => {
    const puzzle = { ...PUZZLES['0Hk7S']!, id: 'synthetic', solution: ['h1h6'] };
    const analyses: PlyAnalysis[] = [
      {
        best: { move: 'h1h6', score: { kind: 'cp', value: 500 } },
        second: { move: 'd6e5', score: { kind: 'cp', value: 450 } },
      },
    ];

    const result = judgeLine(puzzle, analyses, OPTIONS);

    expect(result).toEqual({ ok: false, reason: 'not-clear', ply: 0, positions: 1 });
  });
});

describe('score comparison', () => {
  it('ranks a shorter mate first, a mate over a pawn line, and a pawn line by the margin', () => {
    const analysis = (kind: 'cp' | 'mate', value: number): Analysis => ({
      move: 'a1a2',
      score: { kind, value },
    });

    expect(clearlyBehind(analysis('mate', 3), analysis('mate', 5), 100)).toBe(true);
    expect(clearlyBehind(analysis('mate', 3), analysis('mate', 3), 100)).toBe(false);
    expect(clearlyBehind(analysis('mate', 3), analysis('cp', 900), 100)).toBe(true);
    expect(clearlyBehind(analysis('cp', 900), analysis('mate', 3), 100)).toBe(false);
    expect(clearlyBehind(analysis('cp', 100), analysis('cp', 0), 100)).toBe(true);
    expect(clearlyBehind(analysis('cp', 100), analysis('cp', 1), 100)).toBe(false);
  });
});

describe('analysis replay', () => {
  it('asks the engine for every ply, in order, including the defensive ones', async () => {
    const puzzle = PUZZLES['18yOB']!;
    const asked: string[] = [];
    const source: AnalysisSource = {
      async analyse(fen) {
        asked.push(fen);
        return recorded(puzzle.id).analyse(fen);
      },
    };

    const analyses = await analyseLine(puzzle, source);

    expect(analyses).toHaveLength(3);
    expect(asked).toHaveLength(3);
    expect(new Set(asked).size).toBe(3);
  });
});
