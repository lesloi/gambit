import { Chess } from 'chess.js';
import source from '../../../content/endgames.json?raw';
import type { Endgame, EndgameResult } from './endgame';

const RESULTS: readonly EndgameResult[] = ['win', 'draw'];

function toEndgame(entry: unknown): Endgame | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const { id, name, fen, result, goal } = entry as Record<string, unknown>;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof name !== 'string' || name === '') return null;
  if (typeof fen !== 'string' || fen === '') return null;
  if (typeof goal !== 'string' || goal === '') return null;
  if (typeof result !== 'string' || !RESULTS.includes(result as EndgameResult)) return null;

  // A bad FEN would leave the board empty or throw on the first move; skip it as a bad entry.
  try {
    new Chess(fen);
  } catch {
    return null;
  }
  return { id, name, fen, result: result as EndgameResult, goal };
}

/** Reads the committed endgame set. An entry the parser cannot trust is skipped, not fatal. */
export function parseEndgames(text: string): Endgame[] {
  let entries: unknown;
  try {
    entries = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(entries)) return [];

  const endgames: Endgame[] = [];
  for (const entry of entries) {
    const endgame = toEndgame(entry);
    if (endgame && !endgames.some((known) => known.id === endgame.id)) endgames.push(endgame);
  }
  return endgames;
}

export function loadEndgames(): Endgame[] {
  return parseEndgames(source);
}
