import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import { useEffect, useRef } from 'react';

export interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  turn: 'white' | 'black';
  lastMove: [string, string] | null;
  movable: boolean;
  /** The side not to move may queue one premove, played when the position updates. */
  premovable?: boolean;
  dests: Map<string, string[]>;
  onMove: (from: string, to: string, premove: boolean) => void;
  /** A suggested move drawn as an arrow, or null to clear it. */
  hint?: { from: string; to: string } | null;
  /** Bumped to apply `fen` again after the board moved a piece without a state change. */
  resetKey?: number;
}

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

function other(color: 'white' | 'black'): 'white' | 'black' {
  return color === 'white' ? 'black' : 'white';
}

export function ChessBoard({
  fen,
  orientation,
  turn,
  lastMove,
  movable,
  premovable = false,
  dests,
  onMove,
  hint = null,
  resetKey = 0,
}: ChessBoardProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const moveHandler = useRef(onMove);

  useEffect(() => {
    moveHandler.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!host.current) return;
    const board = Chessground(host.current, {
      fen,
      orientation,
      coordinates: true,
      animation: { enabled: true, duration: 180 },
      highlight: { lastMove: true, check: true },
      lastMove: asMove(lastMove),
      drawable: { autoShapes: asShapes(hint) },
      movable: {
        free: false,
        color: movable ? turn : premovable ? other(turn) : undefined,
        dests: asKeys(dests),
        // `after` fires for a played premove too, and its metadata says so; `move` does not.
        events: {
          after: (from, to, metadata) => moveHandler.current(from, to, metadata.premove === true),
        },
      },
      premovable: { enabled: premovable, showDests: true },
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
    api.current?.set({
      fen,
      orientation,
      turnColor: turn,
      lastMove: asMove(lastMove),
      drawable: { autoShapes: asShapes(hint) },
      movable: {
        color: movable ? turn : premovable ? other(turn) : undefined,
        dests: asKeys(dests),
      },
      premovable: { enabled: premovable },
    });
    // The engine's reply is the moment the queued premove plays, against the new destinations.
    // A new fen leaves chessground's premove in place, so a game that ends has to cancel it.
    if (movable) api.current?.playPremove();
    else if (!premovable) api.current?.cancelPremove();
  }, [fen, orientation, turn, lastMove, movable, premovable, dests, hint, resetKey]);

  return <div ref={host} className="aspect-square w-full touch-none overflow-hidden rounded-sm" />;
}
