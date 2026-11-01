import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fr } from '../../i18n/fr';
import { sideToMove } from '../../lib/chess';
import { ChessBoard } from '../../ui/ChessBoard';
import { PromotionDialog, promotionAnchor } from '../../ui/PromotionDialog';
import { GRADE, RatingButtons, type Rating } from '../../ui/RatingButtons';
import { puzzleLength } from './content';
import { lengthLabel, themeLabel } from './labels';
import {
  legalDests,
  playMove,
  promotionPieces,
  revealSolution,
  startPuzzle,
  type PromotionPiece,
  type Puzzle,
  type PuzzleOutcome,
} from './puzzle';
import { missedAttemptRating, recordPuzzleReview } from './record';

interface PendingPromotion {
  from: string;
  to: string;
  options: PromotionPiece[];
}

/**
 * One puzzle from its start position to its verdict. Both the puzzle screen and the mistakes list
 * play through this component, so a replay behaves exactly like a fresh attempt. The caller keys
 * it by puzzle, since nothing here resets itself when the puzzle changes.
 */
export function PuzzlePlayer({ puzzle, onNext }: { puzzle: Puzzle; onNext: () => void }) {
  const [state, setState] = useState(() => startPuzzle(puzzle));
  const [hint, setHint] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const boardHost = useRef<HTMLDivElement>(null);
  const attemptRecorded = useRef(false);
  /** This attempt's journal write, so a tap on "next" cannot read the journal before it lands. */
  const pendingWrite = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    boardHost.current?.focus();
  }, []);

  const orientation = useMemo(() => sideToMove(puzzle.fen), [puzzle]);
  const turn = useMemo(() => sideToMove(state.fen), [state.fen]);
  const dests = useMemo(
    () => (state.outcome === 'playing' ? legalDests(state.fen) : new Map<string, string[]>()),
    [state.fen, state.outcome],
  );
  const line = useMemo(() => {
    const chess = new Chess(puzzle.fen);
    return puzzle.solution
      .map(
        (uci) =>
          chess.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.slice(4) || undefined,
          }).san,
      )
      .join(' ');
  }, [puzzle]);

  const reset = () => {
    setState(startPuzzle(puzzle));
    setHint(false);
    setRating(null);
    setPending(null);
    attemptRecorded.current = false;
  };

  // A review is appended once and never edited, so the first rating is the review. A write that
  // fails is not surfaced: the buttons unlock so the user can rate again, and nothing else is said.
  const rate = async (value: Rating) => {
    if (rating) return;
    setRating(value);
    const write = recordPuzzleReview(puzzle.id, GRADE[value]);
    pendingWrite.current = write.then(
      () => undefined,
      () => undefined,
    );
    try {
      await write;
    } catch {
      setRating(null);
    }
  };

  const recordMissed = (before: PuzzleOutcome, after: PuzzleOutcome) => {
    // The first event that leaves `playing` is the attempt's review; a queued duplicate must not
    // append a second one.
    if (attemptRecorded.current) return;
    const missed = missedAttemptRating(before, after);
    if (missed === null) return;
    attemptRecorded.current = true;
    const write = recordPuzzleReview(puzzle.id, missed);
    pendingWrite.current = write.then(
      () => undefined,
      () => undefined,
    );
  };

  const proceed = () => {
    const write = pendingWrite.current;
    pendingWrite.current = null;
    if (write) void write.then(onNext);
    else onNext();
  };

  const applyMove = (from: string, to: string, promotion?: PromotionPiece) => {
    const next = playMove(state, from, to, promotion);
    setState(next);
    recordMissed(state.outcome, next.outcome);
  };

  const move = (from: string, to: string) => {
    const options = promotionPieces(state.fen, from, to);
    if (options.length > 0) {
      setPending({ from, to, options });
      return;
    }
    applyMove(from, to);
  };

  const promote = (piece: PromotionPiece) => {
    if (!pending) return;
    const { from, to } = pending;
    setPending(null);
    applyMove(from, to, piece);
  };

  // The pawn waits on the promotion square while the chooser is open; a cancel has to put it back
  // by hand, since the position did not change in between.
  const cancelPromotion = () => {
    setPending(null);
    setResetKey((key) => key + 1);
    boardHost.current?.focus();
  };

  const reveal = () => {
    const next = revealSolution(state);
    setState(next);
    recordMissed(state.outcome, next.outcome);
  };

  return (
    <>
      <div className="border-line bg-paper-raised mt-3 rounded-2xl border p-2.5 sm:p-3">
        <div ref={boardHost} tabIndex={-1} aria-label={fr.puzzle.board} className="rounded-xl">
          <ChessBoard
            fen={state.fen}
            orientation={orientation}
            turn={turn}
            lastMove={state.lastMove}
            movable={state.outcome === 'playing'}
            dests={dests}
            onMove={move}
            resetKey={resetKey}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {turn === 'white' ? fr.puzzle.whiteToMove : fr.puzzle.blackToMove}
        </p>
        {state.outcome === 'playing' ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setHint(true)}
              className="text-ink-muted hover:text-ink rounded-full px-3 py-2 text-xs"
            >
              {fr.puzzle.hint}
            </button>
            <button
              type="button"
              onClick={reveal}
              className="text-ink-muted hover:text-ink rounded-full px-3 py-2 text-xs"
            >
              {fr.puzzle.showSolution}
            </button>
          </div>
        ) : null}
      </div>

      {hint && state.outcome === 'playing' ? (
        <p className="text-ink-muted mt-1 text-xs">
          {fr.puzzle.hintPrefix} {puzzle.themes.map(themeLabel).join(' · ')} ·{' '}
          {lengthLabel(puzzleLength(puzzle))}
        </p>
      ) : null}

      <div className="mt-4">
        {state.outcome === 'solved' ? (
          <>
            <div className="bg-ok-soft text-ok rounded-xl p-4">
              <p className="text-sm font-semibold">{fr.puzzle.solved}</p>
              <p className="mt-1 text-xs opacity-80">{puzzle.themes.map(themeLabel).join(' · ')}</p>
            </div>

            <div className="mt-4">
              <RatingButtons rating={rating} onRate={(value) => void rate(value)} />
            </div>

            <button
              type="button"
              onClick={proceed}
              className="bg-accent mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
            >
              {fr.puzzle.next}
            </button>
          </>
        ) : null}

        {state.outcome === 'failed' ? (
          <>
            <div className="bg-bad-soft text-bad rounded-xl p-4">
              <p className="text-sm font-semibold">{fr.puzzle.failed}</p>
              <p className="mt-1 text-xs opacity-80">
                {fr.puzzle.bestMove.replace('{move}', state.bestSan ?? '')}
              </p>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="bg-accent flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.puzzle.retry}
              </button>
              <button
                type="button"
                onClick={reveal}
                className="border-line text-ink-muted flex-1 rounded-xl border px-4 py-3 text-sm"
              >
                {fr.puzzle.showSolution}
              </button>
            </div>
          </>
        ) : null}

        {state.outcome === 'revealed' ? (
          <>
            <div className="border-line bg-paper-raised rounded-xl border p-4">
              <p className="text-accent text-[11px] tracking-widest uppercase">
                {fr.puzzle.solutionTitle}
              </p>
              <p className="mt-1 font-serif text-lg">{line}</p>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="bg-accent flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.puzzle.retry}
              </button>
              <button
                type="button"
                onClick={proceed}
                className="border-line text-ink-muted flex-1 rounded-xl border px-4 py-3 text-sm"
              >
                {fr.puzzle.next}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {pending ? (
        <PromotionDialog
          color={turn}
          options={pending.options}
          measure={() => promotionAnchor(boardHost.current, pending.to, orientation)}
          onChoose={promote}
          onCancel={cancelPromotion}
        />
      ) : null}
    </>
  );
}
