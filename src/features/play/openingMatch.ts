import { Chess } from 'chess.js';
import { START_FEN, type Side } from '../../lib/position';
import type { OpeningLine } from '../openings/opening';

export interface OpeningDeviation {
  /** The move that left the line, as the score sheet counts it, from one. */
  ply: number;
  /** The side that left the line: the user, or the opponent. */
  side: Side;
  playedUci: string;
  playedSan: string;
  expectedUci: string;
  expectedSan: string;
}

export interface OpeningReport {
  line: OpeningLine;
  /** How many plies of the line the game followed; zero when the first move is outside it. */
  followed: number;
  /** The first move outside the line, or null when the game follows it to its end. */
  deviation: OpeningDeviation | null;
}

/** UCI is case-insensitive in practice; a promotion from a game and from the content must match. */
export function sameMove(left: string | undefined, right: string | undefined): boolean {
  return left !== undefined && right !== undefined && left.toLowerCase() === right.toLowerCase();
}

function applyUci(chess: Chess, uci: string): void {
  chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.slice(4) || undefined,
  });
}

function sanAt(fen: string, uci: string): string | null {
  try {
    return new Chess(fen).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4) || undefined,
    }).san;
  } catch {
    return null;
  }
}

/**
 * The repertoire line a game followed, if any. The match is a move-order prefix: a transposition
 * that reaches the same position another way is not recognised. The line with the longest prefix
 * wins, and the first one in the content on a tie, so the report is stable.
 */
export function matchOpening(
  moves: readonly string[],
  userColor: Side,
  startFen: string = START_FEN,
  lines: readonly OpeningLine[],
): OpeningReport | null {
  // The repertoire starts from the initial position; a game from a puzzle has no opening to match.
  if (startFen !== START_FEN || moves.length === 0) return null;

  let best: { line: OpeningLine; followed: number } | null = null;
  for (const line of lines) {
    if (line.color !== userColor || line.moves.length === 0) continue;

    let followed = 0;
    while (
      followed < line.moves.length &&
      followed < moves.length &&
      sameMove(line.moves[followed], moves[followed])
    ) {
      followed += 1;
    }
    if (followed === 0) continue;
    if (best === null || followed > best.followed) best = { line, followed };
  }

  if (best === null) return null;

  const { line, followed } = best;
  let deviation: OpeningDeviation | null = null;
  if (followed < line.moves.length && followed < moves.length) {
    const chess = new Chess();
    for (let index = 0; index < followed; index += 1) applyUci(chess, moves[index]!);

    const fen = chess.fen();
    const side: Side = chess.turn() === 'w' ? 'white' : 'black';
    const playedUci = moves[followed]!;
    const expectedUci = line.moves[followed]!;
    deviation = {
      ply: followed + 1,
      side,
      playedUci,
      expectedUci,
      playedSan: sanAt(fen, playedUci) ?? playedUci,
      expectedSan: sanAt(fen, expectedUci) ?? expectedUci,
    };
  }

  return { line, followed, deviation };
}
