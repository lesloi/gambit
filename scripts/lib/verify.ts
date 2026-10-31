import { Chess } from 'chess.js';
import type { Puzzle } from '../../src/features/puzzles/puzzle.ts';

/** A line of the engine's analysis: its first move and the score from the side to move. */
export interface Analysis {
  move: string;
  score: { kind: 'cp' | 'mate'; value: number };
}

/** The first two lines of a position, as MultiPV gives them. A position can offer only one. */
export interface PlyAnalysis {
  best: Analysis | null;
  second: Analysis | null;
}

export interface AnalysisSource {
  analyse(fen: string): Promise<Analysis[]>;
}

export interface VerificationOptions {
  userMarginCp: number;
  defenceMarginCp: number;
}

export type Rejection = 'not-best' | 'not-clear';

export type Verification =
  | { ok: true; fullLine: boolean; positions: number }
  | { ok: false; reason: Rejection; ply: number; positions: number };

/**
 * Mate distances are ordered on the same scale as centipawns. A mate for the side to move is
 * better than any pawn line; getting mated is worse. Among mates, the shorter one wins.
 */
const MATE_SCORE = 1_000_000;

function scoreValue(score: Analysis['score']): number {
  if (score.kind === 'cp') return score.value;
  return score.value > 0 ? MATE_SCORE - score.value : -MATE_SCORE - score.value;
}

/**
 * Whether the second line falls behind enough to call the first one the answer. Between two mates
 * the shorter mate is enough, since a move of distance is already a different result; otherwise the
 * gap is the margin in centipawns.
 */
export function clearlyBehind(best: Analysis, second: Analysis, marginCp: number): boolean {
  if (best.score.kind === 'mate' || second.score.kind === 'mate') {
    return scoreValue(best.score) > scoreValue(second.score);
  }
  return best.score.value - second.score.value >= marginCp;
}

function moveFromUci(chess: Chess, uci: string) {
  return chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4) || undefined,
  });
}

/**
 * A solution of one move that mates is accepted whatever the engine says: the app itself accepts
 * any mate in that position (`playMove`), so the engine's preference between two mates is not a
 * reason to drop a puzzle the user can solve.
 */
export function isMateInOne(puzzle: Pick<Puzzle, 'fen' | 'solution'>): boolean {
  if (puzzle.solution.length !== 1) return false;
  try {
    const chess = new Chess(puzzle.fen);
    moveFromUci(chess, puzzle.solution[0]!);
    return chess.isCheckmate();
  } catch {
    return false;
  }
}

/** Replays the stored line and asks the source for every position, defensive plies included. */
export async function analyseLine(
  puzzle: Pick<Puzzle, 'fen' | 'solution'>,
  source: AnalysisSource,
): Promise<PlyAnalysis[]> {
  const chess = new Chess(puzzle.fen);
  const analyses: PlyAnalysis[] = [];

  for (const uci of puzzle.solution) {
    const lines = await source.analyse(chess.fen());
    analyses.push({ best: lines[0] ?? null, second: lines[1] ?? null });
    moveFromUci(chess, uci);
  }

  return analyses;
}

/**
 * Applies the rules to recorded analyses. A user ply must be the engine's first choice and the
 * second one must fall behind; a defensive ply only decides the full-line index, because the app
 * plays the stored reply whatever the engine thinks. A line with a weak defence is still a puzzle,
 * it is just not one the full-line drill can serve.
 */
export function judgeLine(
  puzzle: Pick<Puzzle, 'fen' | 'solution'>,
  analyses: readonly PlyAnalysis[],
  options: VerificationOptions,
): Verification {
  if (isMateInOne(puzzle)) return { ok: true, fullLine: true, positions: 0 };
  if (analyses.length !== puzzle.solution.length) {
    throw new Error(
      `Verification needs one analysis per ply: ${analyses.length} for ${puzzle.solution.length}.`,
    );
  }

  let fullLine = true;
  for (let index = 0; index < puzzle.solution.length; index += 1) {
    const { best, second } = analyses[index]!;
    const expected = puzzle.solution[index]!;

    if (index % 2 === 0) {
      if (best?.move !== expected) {
        return { ok: false, reason: 'not-best', ply: index, positions: analyses.length };
      }
      if (second && !clearlyBehind(best, second, options.userMarginCp)) {
        return { ok: false, reason: 'not-clear', ply: index, positions: analyses.length };
      }
    } else if (
      best?.move !== expected ||
      (second && !clearlyBehind(best, second, options.defenceMarginCp))
    ) {
      fullLine = false;
    }
  }

  return { ok: true, fullLine, positions: analyses.length };
}

export async function verifyLine(
  puzzle: Pick<Puzzle, 'fen' | 'solution'>,
  source: AnalysisSource,
  options: VerificationOptions,
): Promise<Verification> {
  if (isMateInOne(puzzle)) return judgeLine(puzzle, [], options);
  return judgeLine(puzzle, await analyseLine(puzzle, source), options);
}
