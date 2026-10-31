import { Chess } from 'chess.js';
import source from '../../../content/openings.json?raw';
import type { LineColor, OpeningLine } from './opening';

const COLORS: readonly LineColor[] = ['white', 'black'];
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

function toOpeningLine(entry: unknown): OpeningLine | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const { id, name, color, moves } = entry as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof name !== 'string' || name === '') return null;
  if (typeof color !== 'string' || !COLORS.includes(color as LineColor)) return null;
  if (!Array.isArray(moves) || moves.length === 0) return null;
  if (!moves.every((move) => typeof move === 'string' && UCI.test(move))) return null;

  // The colour and the line must agree: the user has to move at least once, and every move must
  // be legal from the initial position. A line that skips the user's first move silently would
  // train nothing.
  const lineColor = color as LineColor;
  const chess = new Chess();
  let userMoves = 0;
  for (const uci of moves) {
    if ((chess.turn() === 'w') === (lineColor === 'white')) userMoves += 1;
    try {
      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4) || undefined,
      });
    } catch {
      return null;
    }
  }
  if (userMoves === 0) return null;

  return { id, name, color: lineColor, moves };
}

/** Reads the committed repertoire. An entry the parser cannot trust is skipped, not fatal. */
export function parseOpenings(text: string): OpeningLine[] {
  let entries: unknown;
  try {
    entries = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(entries)) return [];

  const lines: OpeningLine[] = [];
  for (const entry of entries) {
    const line = toOpeningLine(entry);
    if (line && !lines.some((known) => known.id === line.id)) lines.push(line);
  }
  return lines;
}

export function loadOpenings(): OpeningLine[] {
  return parseOpenings(source);
}
