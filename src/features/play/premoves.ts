import { promotionPieces, type Premove, type PromotionPiece } from '../../lib/chess';
import { playMove, type PlayState } from './game';

export type { Premove, PremovePiece } from '../../lib/chess';

export const MAX_PREMOVES = 5;

export interface PremoveResult {
  state: PlayState;
  queue: readonly Premove[];
  played: boolean;
}

export function enqueuePremove(queue: readonly Premove[], move: Premove): readonly Premove[] {
  // A fresh array even when full: the board re-reads the position on every queue change, which
  // also clears the single premove chessground keeps for itself.
  if (queue.length >= MAX_PREMOVES) return [...queue];
  return [...queue, move];
}

export function consumePremove(state: PlayState, queue: readonly Premove[]): PremoveResult {
  const [head, ...rest] = queue;
  if (!head) return { state, queue: [], played: false };

  // A premove is played before the user sees it, so its promotion is settled up front.
  const promotion: PromotionPiece | undefined =
    promotionPieces(state.fen, head.from, head.to).length > 0 ? 'q' : undefined;
  const next = playMove(state, head.from, head.to, promotion);
  if (next === state) return { state, queue: [], played: false };

  return { state: next, queue: rest, played: true };
}
