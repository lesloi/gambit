import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key, Piece } from '@lichess-org/chessground/types';
import { useEffect, useRef } from 'react';
import { normalizePremove, type Premove } from '../lib/chess';

export interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  turn: 'white' | 'black';
  lastMove: [string, string] | null;
  movable: boolean;
  /** The side not to move may set premoves; the parent queues them and owns when they play. */
  premovable?: boolean;
  /** Premoves waiting for the engine, shown on the position they would lead to. */
  premoves?: readonly Premove[];
  /** A premove was set; returns whether the parent accepted it into its queue. */
  onPremove?: (from: string, to: string) => boolean;
  dests: Map<string, string[]>;
  onMove: (from: string, to: string) => void;
  /** A suggested move drawn as an arrow, or null to clear it. */
  hint?: { from: string; to: string } | null;
  /** The square a puzzle's hint points at, ringed, or null to clear it. */
  mark?: string | null;
  /** Bumped to apply `fen` again after the board moved a piece without a state change. */
  resetKey?: number;
}

const NO_PREMOVES: readonly Premove[] = [];

function asKeys(dests: Map<string, string[]>): Map<Key, Key[]> {
  return dests as unknown as Map<Key, Key[]>;
}

function asMove(lastMove: [string, string] | null): Key[] | undefined {
  return lastMove as Key[] | undefined;
}

function asShapes(
  hint: { from: string; to: string } | null,
): { orig: Key; dest: Key; brush: string }[] {
  return hint ? [{ orig: hint.from as Key, dest: hint.to as Key, brush: 'paleBlue' }] : [];
}

/** Chessground paints a custom highlight as a class on the square it names. */
function asHighlight(mark: string | null | undefined): Map<Key, string> {
  return mark ? new Map([[mark as Key, 'hint']]) : new Map();
}

function other(color: 'white' | 'black'): 'white' | 'black' {
  return color === 'white' ? 'black' : 'white';
}

/**
 * Shows the queued premoves on the board without playing them. Chessground's own premove only
 * holds one move, and the engine's reply is unknown, so this is a guess: pieces move, captures
 * land, but the turn stays with the engine. A move the board cannot apply stops the display; the
 * queue keeps the rest and the real play decides what survives.
 */
function applyPremoves(board: Api, premoves: readonly Premove[]): void {
  for (const move of premoves) {
    const from = move.from as Key;
    const to = move.to as Key;
    const piece = board.state.pieces.get(from);
    const target = board.state.pieces.get(to);
    if (!piece || from === to) break;
    if (target && (target.color === piece.color || target.role === 'king')) break;

    const promotes = piece.role === 'pawn' && (to[1] === '8' || to[1] === '1');
    board.move(from, to);
    if (promotes) {
      board.setPieces(
        new Map<Key, Piece | undefined>([[to, { role: 'queen', color: piece.color }]]),
      );
    }
  }
}

export function ChessBoard({
  fen,
  orientation,
  turn,
  lastMove,
  movable,
  premovable = false,
  premoves = NO_PREMOVES,
  onPremove,
  dests,
  onMove,
  hint = null,
  mark = null,
  resetKey = 0,
}: ChessBoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const moveHandler = useRef(onMove);
  const premoveHandler = useRef(onPremove);

  useEffect(() => {
    moveHandler.current = onMove;
  }, [onMove]);

  useEffect(() => {
    premoveHandler.current = onPremove;
  }, [onPremove]);

  useEffect(() => {
    if (!host.current) return;
    const board = Chessground(host.current, {
      fen,
      orientation,
      coordinates: true,
      animation: { enabled: true, duration: 180 },
      highlight: { lastMove: true, check: true, custom: asHighlight(mark) },
      lastMove: asMove(lastMove),
      drawable: { autoShapes: asShapes(hint) },
      movable: {
        free: false,
        color: movable ? turn : premovable ? other(turn) : undefined,
        dests: asKeys(dests),
        events: {
          after: (from, to) => moveHandler.current(from, to),
        },
      },
      premovable: {
        enabled: premovable,
        showDests: true,
        events: {
          set: (from, to) => {
            const board = api.current;
            if (!board) return;
            const move = normalizePremove(from, to, (square) =>
              board.state.pieces.get(square as Key),
            );
            const accepted = premoveHandler.current?.(move.from, move.to) ?? false;
            // The parent's queue owns the premove; a rejected one must not linger in the slot.
            if (!accepted) board.cancelPremove();
          },
        },
      },
      draggable: { showGhost: true },
      selectable: { enabled: true },
    });
    api.current = board;
    return () => {
      board.destroy();
      api.current = null;
    };
    // The board is created once; every later change goes through `set` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const board = api.current;
    if (!board) return;
    board.set({
      fen,
      orientation,
      turnColor: turn,
      lastMove: asMove(lastMove),
      drawable: { autoShapes: asShapes(hint) },
      highlight: { custom: asHighlight(mark) },
      movable: {
        color: movable ? turn : premovable ? other(turn) : undefined,
        dests: asKeys(dests),
      },
      premovable: { enabled: premovable },
    });

    // The queue is the single store. Clearing the slot here also drops the premove chessground
    // keeps when a second input lands before the first one reaches the parent.
    board.cancelPremove();

    if (premovable) applyPremoves(board, premoves);
  }, [
    fen,
    orientation,
    turn,
    lastMove,
    movable,
    premovable,
    premoves,
    dests,
    hint,
    mark,
    resetKey,
  ]);

  return <div ref={host} className="aspect-square w-full touch-none overflow-hidden rounded-sm" />;
}
