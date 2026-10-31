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
  dests: Map<string, string[]>;
  onMove: (from: string, to: string) => void;
  /** Bumped to apply `fen` again after the board moved a piece without a state change. */
  resetKey?: number;
}

function asKeys(dests: Map<string, string[]>): Map<Key, Key[]> {
  return dests as unknown as Map<Key, Key[]>;
}

function asMove(lastMove: [string, string] | null): Key[] | undefined {
  return lastMove as Key[] | undefined;
}

export function ChessBoard({
  fen,
  orientation,
  turn,
  lastMove,
  movable,
  dests,
  onMove,
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
      movable: {
        free: false,
        color: movable ? turn : undefined,
        dests: asKeys(dests),
      },
      draggable: { showGhost: true },
      selectable: { enabled: true },
      events: { move: (from, to) => moveHandler.current(from, to) },
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
      movable: {
        color: movable ? turn : undefined,
        dests: asKeys(dests),
      },
    });
  }, [fen, orientation, turn, lastMove, movable, dests, resetKey]);

  return <div ref={host} className="aspect-square w-full overflow-hidden rounded-xl" />;
}
