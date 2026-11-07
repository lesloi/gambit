import { Chess } from 'chess.js';
import {
  MAIA_HISTORY,
  maiaMoveIndex,
  maiaTokens,
  mirrorMove,
  movePolicy,
  sampleMove,
  seededRandom,
} from './maia';
import type { Engine, MoveRequest } from './uci';

/** The 5M model, exported from the pinned checkpoint by `scripts/export-maia.py`. */
export const MAIA_MODEL_URL = '/maia/maia3-5m.onnx';

/** Long enough for the first inference of a cold worker, short enough not to lose a game to it. */
const TIMEOUT_MS = 10_000;

interface Pending {
  resolve: (logits: Float32Array) => void;
  reject: (error: Error) => void;
}

/**
 * The positions of a game before the current one, rebuilt from its moves.
 *
 * The replay starts from the standard position. When the moves do not lead to the position we
 * were asked about — a game from another start, a move the board refused — the history would
 * describe a board the model never saw, so the position stands alone rather than misleading it.
 */
function historyFens(moves: readonly string[], fen: string, count: number): string[] {
  if (moves.length === 0) return [fen];

  const chess = new Chess();
  const fens = [chess.fen()];
  for (const move of moves) {
    try {
      chess.move(move);
    } catch {
      return [fen];
    }
    fens.push(chess.fen());
  }
  if (chess.fen() !== fen) return [fen];
  return fens.slice(-count);
}

/**
 * Maia as an opponent: one forward pass, a drawn move.
 *
 * The model reads the last eight positions, so the request carries the moves played so far; it
 * reads a rating rather than a Stockfish skill, and it has no search, so a think time means
 * nothing to it.
 */
export function createMaiaEngine(modelUrl: string = MAIA_MODEL_URL): Engine {
  let worker: Worker | null = null;
  let starting: Promise<void> | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  function start(): Promise<void> {
    if (starting) return starting;
    starting = new Promise<void>((resolve, reject) => {
      try {
        worker = new Worker(new URL('./maiaWorker.ts', import.meta.url), { type: 'module' });
      } catch (error) {
        starting = null;
        reject(error instanceof Error ? error : new Error('The Maia worker did not start'));
        return;
      }
      worker.onmessage = (event: MessageEvent) => {
        const message = event.data as
          | { type: 'ready' }
          | { type: 'move'; id: number; logits: ArrayBuffer }
          | { type: 'error'; id?: number; message: string };

        if (message.type === 'ready') {
          resolve();
          return;
        }
        if (message.type === 'error') {
          const waiting = message.id === undefined ? undefined : pending.get(message.id);
          if (waiting && message.id !== undefined) pending.delete(message.id);
          if (waiting) {
            waiting.reject(new Error(message.message));
          } else {
            // A load that fails is retried by the next `prepare`, not remembered forever.
            starting = null;
            worker?.terminate();
            worker = null;
            reject(new Error(message.message));
          }
          return;
        }
        const waiting = pending.get(message.id);
        if (!waiting) return;
        pending.delete(message.id);
        waiting.resolve(new Float32Array(message.logits));
      };
      worker.onerror = (event: ErrorEvent) => {
        const where = event.filename ? `${event.filename}:${event.lineno}` : 'no location';
        const error = new Error(`${event.message || 'The Maia worker failed'} (${where})`);
        console.error('Maia worker error', event);
        for (const waiting of pending.values()) waiting.reject(error);
        pending.clear();
        reject(error);
      };
      worker.postMessage({ type: 'load', url: modelUrl });
    });
    return starting;
  }

  function logits(tokens: Float32Array, rating: number): Promise<Float32Array> {
    const id = nextId++;
    const message = { type: 'move', id, tokens: tokens.buffer, rating };
    return new Promise<Float32Array>((resolve, reject) => {
      // The game is on a clock: a worker that stops answering must fail the move, not hang it.
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('The Maia engine did not answer'));
      }, TIMEOUT_MS);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      worker?.postMessage(message, [tokens.buffer]);
    });
  }

  return {
    prepare: () => start(),

    async bestMove(fen: string, request: MoveRequest = {}): Promise<string | null> {
      await start();
      const chess = new Chess(fen);
      const legal = chess.moves({ verbose: true });
      if (legal.length === 0) return null;

      const black = chess.turn() === 'b';
      const fens = historyFens(request.history ?? [], fen, MAIA_HISTORY);
      const tokens = maiaTokens(fens);
      const rating = Number.isFinite(request.rating)
        ? Math.min(Math.max(request.rating ?? 1500, 0), 5000)
        : 1500;
      const policy = await logits(tokens, rating);

      const byIndex = new Map<number, string>();
      for (const move of legal) {
        const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
        const index = maiaMoveIndex(black ? mirrorMove(uci) : uci);
        if (index !== undefined) byIndex.set(index, uci);
      }
      if (byIndex.size === 0) return null;

      const distribution = movePolicy(policy, [...byIndex.keys()], request.temperature ?? 1);
      const index = sampleMove(distribution, seededRandom(request.seed ?? Date.now()));
      return index === null ? null : (byIndex.get(index) ?? null);
    },

    cancel: () => {},

    stop(): void {
      worker?.terminate();
      worker = null;
      starting = null;
      for (const waiting of pending.values()) waiting.reject(new Error('The Maia engine stopped'));
      pending.clear();
    },
  };
}
