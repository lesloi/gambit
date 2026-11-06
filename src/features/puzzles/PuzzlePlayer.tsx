import { useEffect, useMemo, useRef, useState } from 'react';
import { Rating } from 'ts-fsrs';
import { leavingRating } from '../../db/journal';
import { fr } from '../../i18n/fr';
import { sideToMove } from '../../lib/chess';
import { AgainButton } from '../../ui/AgainButton';
import { ChessBoard } from '../../ui/ChessBoard';
import { PromotionDialog, promotionAnchor } from '../../ui/PromotionDialog';
import { puzzleLength } from './content';
import { lengthLabel, themeLabel } from './labels';
import {
  legalDests,
  playMove,
  promotionPieces,
  revealSolution,
  solutionSheet,
  startPuzzle,
  type PromotionPiece,
  type Puzzle,
  type PuzzleOutcome,
  type SolutionPly,
  type SolutionRow,
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
export function PuzzlePlayer({
  puzzle,
  onNext,
  nextLabel = fr.puzzle.next,
}: {
  puzzle: Puzzle;
  onNext: () => void;
  nextLabel?: string;
}) {
  const [state, setState] = useState(() => startPuzzle(puzzle));
  const [hint, setHint] = useState(false);
  const [again, setAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [resetKey, setResetKey] = useState(0);
  /** The ply the revealed line is showing; null means its final position. */
  const [browsedPly, setBrowsedPly] = useState<number | null>(null);
  const boardHost = useRef<HTMLDivElement>(null);
  const attemptRecorded = useRef(false);
  /** This attempt's journal write, so a tap on "next" cannot read the journal before it lands. */
  const pendingWrite = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    boardHost.current?.focus();
  }, []);

  const orientation = useMemo(() => sideToMove(puzzle.fen), [puzzle]);
  const storedSheet = useMemo(() => solutionSheet(puzzle), [puzzle]);
  const playedSheet = useMemo(() => solutionSheet(puzzle, state.moves), [puzzle, state.moves]);
  // A solved puzzle reviews the line the user actually played; a revealed one shows the stored
  // answer, which may start from the puzzle position after a wrong move.
  const sheet =
    state.outcome === 'revealed' ? storedSheet : state.outcome === 'solved' ? playedSheet : null;
  const shown = sheet && browsedPly !== null ? (sheet.plies[browsedPly - 1] ?? null) : null;
  const shownPly = sheet ? (browsedPly ?? sheet.plies.length) : 0;
  const shownFen = shown?.fen ?? state.fen;
  const turn = useMemo(() => sideToMove(shownFen), [shownFen]);
  const dests = useMemo(
    () => (state.outcome === 'playing' ? legalDests(state.fen) : new Map<string, string[]>()),
    [state.fen, state.outcome],
  );

  const reset = () => {
    setState(startPuzzle(puzzle));
    setHint(false);
    setAgain(false);
    setBusy(false);
    setPending(null);
    setBrowsedPly(null);
    attemptRecorded.current = false;
  };

  // The "again" review is appended once and never edited. A write that fails is not surfaced: the
  // button stays available, and nothing else is said.
  const rateAgain = async () => {
    if (attemptRecorded.current || busy) return;
    attemptRecorded.current = true;
    setBusy(true);
    try {
      await recordPuzzleReview(puzzle.id, Rating.Again);
      setAgain(true);
    } catch {
      attemptRecorded.current = false;
    } finally {
      setBusy(false);
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

  /**
   * A solved attempt is written `good` when the user leaves it. The button waits for the write so a
   * second tap cannot skip a card, and a failed write keeps the screen open rather than dropping
   * the attempt. A miss already wrote its own review, so leaving it writes nothing.
   */
  const proceed = async () => {
    if (busy) return;
    setBusy(true);

    const missed = pendingWrite.current;
    pendingWrite.current = null;
    if (missed) await missed;

    const grade = leavingRating(state.outcome, attemptRecorded.current);
    if (grade !== null) {
      attemptRecorded.current = true;
      try {
        await recordPuzzleReview(puzzle.id, grade);
      } catch {
        attemptRecorded.current = false;
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    onNext();
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
    setBrowsedPly(null);
    recordMissed(state.outcome, next.outcome);
  };

  const browse = (ply: number) => {
    if (!sheet) return;
    setBrowsedPly(ply >= sheet.plies.length ? null : ply);
    // The sheet sits under the board on a phone: bring the board back into view.
    if (window.matchMedia('(max-width: 767px)').matches) {
      boardHost.current?.scrollIntoView({ block: 'center' });
    }
  };

  return (
    <>
      <div className="border-line bg-paper-raised rounded-sm border p-2.5 sm:p-3">
        <div ref={boardHost} tabIndex={-1} aria-label={fr.puzzle.board} className="rounded-sm">
          <ChessBoard
            fen={shownFen}
            orientation={orientation}
            turn={turn}
            lastMove={shown?.lastMove ?? state.lastMove}
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
              className="text-ink-muted hover:text-ink min-h-11 rounded-sm px-3 text-xs"
            >
              {fr.puzzle.hint}
            </button>
            <button
              type="button"
              onClick={reveal}
              className="text-ink-muted hover:text-ink min-h-11 rounded-sm px-3 text-xs"
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
            <div className="bg-ok-soft text-ok rounded-sm px-3 py-2">
              <p className="text-sm font-semibold">{fr.puzzle.solved}</p>
              <p className="mt-1 text-xs opacity-80">{puzzle.themes.map(themeLabel).join(' · ')}</p>
            </div>

            {sheet ? (
              <div className="mt-3">
                <SolutionMoves rows={sheet.rows} shownPly={shownPly} onSelect={browse} />
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-5 gap-2">
              <div className="col-span-2">
                <AgainButton recorded={again} disabled={busy} onPress={() => void rateAgain()} />
              </div>
              <button
                type="button"
                onClick={() => void proceed()}
                disabled={busy}
                className="bg-accent col-span-3 rounded-sm px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {nextLabel}
              </button>
            </div>
          </>
        ) : null}

        {state.outcome === 'failed' ? (
          <>
            <div className="bg-bad-soft text-bad rounded-sm p-4">
              <p className="text-sm font-semibold">{fr.puzzle.failed}</p>
              <p className="mt-1 text-xs opacity-80">
                {fr.puzzle.bestMove.replace('{move}', state.bestSan ?? '')}
              </p>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="bg-accent flex-1 rounded-sm px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.puzzle.retry}
              </button>
              <button
                type="button"
                onClick={reveal}
                className="border-line text-ink-muted flex-1 rounded-sm border px-4 py-3 text-sm"
              >
                {fr.puzzle.showSolution}
              </button>
            </div>
          </>
        ) : null}

        {state.outcome === 'revealed' ? (
          <>
            <SolutionMoves rows={storedSheet.rows} shownPly={shownPly} onSelect={browse} />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="bg-accent flex-1 rounded-sm px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.puzzle.retry}
              </button>
              <button
                type="button"
                onClick={() => void proceed()}
                disabled={busy}
                className="border-line text-ink-muted flex-1 rounded-sm border px-4 py-3 text-sm disabled:opacity-60"
              >
                {nextLabel}
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

/**
 * The line as a score sheet, two moves per row. Every move is a button so the board can show the
 * position it reached.
 */
function SolutionMoves({
  rows,
  shownPly,
  onSelect,
}: {
  rows: readonly SolutionRow[];
  shownPly: number;
  onSelect: (ply: number) => void;
}) {
  return (
    <div className="border-line bg-paper-raised rounded-sm border">
      <p className="border-line text-accent-ink border-b px-3 py-2 text-[0.6875rem] tracking-widest uppercase">
        {fr.puzzle.solutionTitle}
      </p>
      <ol className="py-1 text-sm" aria-label={fr.puzzle.solutionTitle}>
        {rows.map((row, index) => {
          // The sheet numbers the puzzle's own line from 1: the move number of the game the
          // position was taken from means nothing to the solver.
          const number = index + 1;
          return (
            <li
              key={row.number}
              className="grid grid-cols-[32px_1fr_1fr] items-center gap-1 px-1.5 tabular-nums"
            >
              <span className="text-ink-muted opacity-70" aria-hidden="true">
                {number}
                {row.white ? '.' : '…'}
              </span>
              {row.white ? (
                <SolutionMoveButton
                  number={number}
                  move={row.white}
                  current={row.white.ply === shownPly}
                  onSelect={onSelect}
                />
              ) : (
                <span />
              )}
              {row.black ? (
                <SolutionMoveButton
                  number={number}
                  move={row.black}
                  current={row.black.ply === shownPly}
                  onSelect={onSelect}
                />
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * A move of the revealed solution. A 36px row stays above the 24px target minimum of WCAG 2.2
 * while a line of several moves keeps the sheet compact; the whole cell is the button.
 */
function SolutionMoveButton({
  number,
  move,
  current,
  onSelect,
}: {
  number: number;
  move: SolutionPly;
  current: boolean;
  onSelect: (ply: number) => void;
}) {
  return (
    <button
      type="button"
      aria-current={current ? 'true' : undefined}
      aria-label={`${number}${move.side === 'white' ? '.' : '…'} ${move.san}`}
      onClick={() => onSelect(move.ply)}
      className={`flex min-h-9 items-center rounded-xs px-1.5 text-left tabular-nums transition-colors ${
        current ? 'bg-accent-soft text-ink font-semibold' : 'hover:bg-paper'
      }`}
    >
      {move.san}
    </button>
  );
}
