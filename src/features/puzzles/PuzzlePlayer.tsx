import { ChevronDown, Clock, Eye, Lightbulb } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Rating } from 'ts-fsrs';
import { leavingRating } from '../../db/journal';
import { fr } from '../../i18n/fr';
import { sideToMove } from '../../lib/chess';
import { AgainButton } from '../../ui/AgainButton';
import { ChessBoard } from '../../ui/ChessBoard';
import { PromotionDialog, promotionAnchor } from '../../ui/PromotionDialog';
import { hintNudge, themeLabel } from './labels';
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
import { elapsedMs, pauseClock, resumeClock, startClock } from './solveClock';
import { formatSolveTime } from './solveTime';

interface PendingPromotion {
  from: string;
  to: string;
  options: PromotionPiece[];
}

/** A secondary action of the puzzle screen: the pair of buttons under the board. */
const SECONDARY_ACTION =
  'border-line text-ink-muted hover:text-ink inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm border px-3 text-xs transition-colors';

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
  /** The hint of the position on the board: none, its sentence, or the piece it points at. */
  const [hint, setHint] = useState<'none' | 'text' | 'piece'>('none');
  /** Whether this attempt asked for help, which costs it the `good` grade. */
  const [assisted, setAssisted] = useState(false);
  const [again, setAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [resetKey, setResetKey] = useState(0);
  /** The ply the revealed line is showing; null means its final position. */
  const [browsedPly, setBrowsedPly] = useState<number | null>(null);
  /** Whether the solution sheet is open; null follows the outcome, open once it was revealed. */
  const [sheetOpen, setSheetOpen] = useState<boolean | null>(null);
  const [clock, setClock] = useState(() =>
    startClock(Date.now(), document.visibilityState === 'visible'),
  );
  const [now, setNow] = useState(() => Date.now());
  const sheetId = useId();
  const boardHost = useRef<HTMLDivElement>(null);
  const attemptRecorded = useRef(false);
  /** This attempt's journal write, so a tap on "next" cannot read the journal before it lands. */
  const pendingWrite = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    boardHost.current?.focus();
  }, []);

  const orientation = useMemo(() => sideToMove(puzzle.fen), [puzzle]);
  const storedSheet = useMemo(() => solutionSheet(puzzle), [puzzle]);
  // Only a revealed puzzle has a line to read: a solve keeps its motifs in the band, not the moves.
  const sheet = state.outcome === 'revealed' ? storedSheet : null;
  const shown = sheet && browsedPly !== null ? (sheet.plies[browsedPly - 1] ?? null) : null;
  const shownPly = sheet ? (browsedPly ?? sheet.plies.length) : 0;
  const shownFen = shown?.fen ?? state.fen;
  const turn = useMemo(() => sideToMove(shownFen), [shownFen]);
  const dests = useMemo(
    () => (state.outcome === 'playing' ? legalDests(state.fen) : new Map<string, string[]>()),
    [state.fen, state.outcome],
  );

  // The clock measures the attempt, not the time the tab spent in the background: it runs while the
  // puzzle is open and visible, and freezes at the verdict. The listener is removed once the attempt
  // is over, so hiding a solved puzzle cannot restart the frozen clock.
  useEffect(() => {
    if (state.outcome !== 'playing') return;
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        setClock((value) => pauseClock(value, Date.now()));
        return;
      }
      setClock((value) => resumeClock(value, Date.now()));
      setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [state.outcome]);

  useEffect(() => {
    if (state.outcome !== 'playing') return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [state.outcome]);

  const timeLabel = formatSolveTime(elapsedMs(clock, now));
  const sheetVisible = sheetOpen ?? state.outcome === 'revealed';

  const reset = () => {
    setState(startPuzzle(puzzle));
    setHint('none');
    // Replaying from a verdict follows the answer the band or the line just showed: the retry is
    // assisted even when no hint was asked. `reset` is only reachable from `failed` and
    // `revealed`, the two outcomes that show it.
    setAssisted((value) => value || state.outcome !== 'playing');
    setAgain(false);
    setBusy(false);
    setPending(null);
    setBrowsedPly(null);
    setSheetOpen(null);
    setClock(startClock(Date.now(), document.visibilityState === 'visible'));
    setNow(Date.now());
    attemptRecorded.current = false;
  };

  const toggleSheet = () => {
    const next = !sheetVisible;
    setSheetOpen(next);
    // Closing the sheet puts the board back on the final position, the one the verdict speaks for.
    if (!next) setBrowsedPly(null);
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
   * A solved attempt is written `good`, or `hard` when a hint helped, as the user leaves it. The
   * button waits for the write so a second tap cannot skip a card, and a failed write keeps the
   * screen open rather than dropping the attempt. A miss already wrote its own review, so leaving
   * it writes nothing.
   */
  const proceed = async () => {
    if (busy) return;
    setBusy(true);

    const missed = pendingWrite.current;
    pendingWrite.current = null;
    if (missed) await missed;

    const grade = leavingRating(state.outcome, attemptRecorded.current, assisted);
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

  // The first outcome freezes the clock; revealing after a miss keeps the time of the miss.
  const settle = (outcome: PuzzleOutcome) => {
    if (outcome !== 'playing') setClock((value) => pauseClock(value, Date.now()));
  };

  const applyMove = (from: string, to: string, promotion?: PromotionPiece) => {
    const next = playMove(state, from, to, promotion);
    setState(next);
    settle(next.outcome);
    recordMissed(state.outcome, next.outcome);
    // The ringed piece belongs to the move just played: the next position gets its own hint.
    setHint((value) => (value === 'piece' ? 'text' : value));
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
    settle(next.outcome);
    // The line opens on the move the puzzle wanted, not on the position it ends in.
    setBrowsedPly(1);
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

  // The band is the one place the attempt speaks: whose move it is, then a nudge or a verdict.
  const hintSquare =
    hint === 'piece' && state.outcome === 'playing' ? (state.expected?.slice(0, 2) ?? null) : null;
  const hintLabel =
    hint === 'piece' ? fr.puzzle.hintShown : hint === 'text' ? fr.puzzle.hintPiece : fr.puzzle.hint;
  const stateLabel =
    state.outcome === 'solved'
      ? fr.puzzle.solved
      : state.outcome === 'playing'
        ? turn === 'white'
          ? fr.puzzle.whiteToMove
          : fr.puzzle.blackToMove
        : fr.puzzle.failed;
  const themeList = puzzle.themes.map(themeLabel).join(' · ');
  const detail =
    state.outcome === 'solved'
      ? assisted
        ? `${themeList} · ${fr.puzzle.assisted}`
        : themeList
      : state.outcome === 'revealed'
        ? themeList
        : state.outcome === 'failed'
          ? fr.puzzle.bestMove.replace('{move}', state.bestSan ?? '')
          : hint !== 'none'
            ? hintNudge(puzzle.themes)
            : null;
  // What a screen reader hears. The turn and the clock are left out: the first flips on every
  // move and the second ticks, so a live region holding them would talk all the time.
  const announcement =
    state.outcome === 'solved'
      ? `${fr.puzzle.solved}${assisted ? `, ${fr.puzzle.assisted}` : ''}. ${themeList}`
      : state.outcome === 'failed'
        ? `${fr.puzzle.failed}. ${fr.puzzle.bestMove.replace('{move}', state.bestSan ?? '')}`
        : state.outcome === 'revealed'
          ? `${fr.puzzle.failed}. ${themeList}`
          : hint === 'piece' && hintSquare
            ? fr.puzzle.hintSquare.replace('{square}', hintSquare)
            : hint === 'text'
              ? hintNudge(puzzle.themes)
              : '';
  const tone =
    state.outcome === 'solved'
      ? 'border-ok-soft bg-ok-soft text-ok'
      : state.outcome === 'failed' || state.outcome === 'revealed'
        ? 'border-bad-soft bg-bad-soft text-bad'
        : 'border-line bg-paper-raised text-ink';

  return (
    <>
      <div className={`flex items-start gap-3 rounded-sm border px-3 py-2.5 ${tone}`}>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {state.outcome === 'playing' ? (
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full border ${
                  turn === 'black'
                    ? 'border-board-label bg-board-label'
                    : 'border-board-dark bg-board-light'
                }`}
              />
            ) : null}
            {stateLabel}
          </p>
          {detail ? (
            <p
              className={`mt-1 flex items-start gap-1.5 text-xs ${
                state.outcome === 'playing' ? 'text-ink-muted' : 'opacity-80'
              }`}
            >
              {hint !== 'none' && state.outcome === 'playing' ? (
                <Lightbulb
                  size={13}
                  aria-hidden="true"
                  className="text-accent-ink mt-px shrink-0"
                />
              ) : null}
              <span>{detail}</span>
            </p>
          ) : null}
        </div>
        <p className="text-ink-muted flex shrink-0 items-center gap-1 text-xs tabular-nums">
          <Clock size={13} aria-hidden="true" />
          <span className="sr-only">{fr.puzzle.solveTime} : </span>
          {timeLabel}
        </p>
        {/* A verdict or a nudge is announced once; the turn and the clock stay out of it. */}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </div>

      {/* Full bleed on a phone, where the board is the screen; a framed panel from `sm` up. */}
      <div className="-mx-4 border-line bg-paper border-y mt-3 sm:mx-0 sm:rounded-sm sm:border sm:bg-paper-raised sm:p-3">
        <div ref={boardHost} tabIndex={-1} aria-label={fr.puzzle.board} className="rounded-sm">
          <ChessBoard
            fen={shownFen}
            orientation={orientation}
            turn={turn}
            lastMove={shown?.lastMove ?? state.lastMove}
            movable={state.outcome === 'playing'}
            dests={dests}
            onMove={move}
            mark={hintSquare}
            resetKey={resetKey}
          />
        </div>
      </div>

      {state.outcome === 'playing' ? (
        <div className="mt-3 flex gap-2">
          {/* The used hint keeps its focus: a disabled button would drop it from the tab order. */}
          <button
            type="button"
            onClick={() => {
              if (hint === 'none') {
                setHint('text');
                // The first sentence is already help: this attempt no longer earns `good`.
                setAssisted(true);
              } else {
                setHint('piece');
              }
            }}
            aria-disabled={hint === 'piece'}
            className={`${SECONDARY_ACTION} ${hint === 'piece' ? 'opacity-50' : ''}`}
          >
            <Lightbulb size={15} aria-hidden="true" />
            {hintLabel}
          </button>
          <button type="button" onClick={reveal} className={SECONDARY_ACTION}>
            <Eye size={15} aria-hidden="true" />
            {fr.puzzle.showSolution}
          </button>
        </div>
      ) : null}

      {state.outcome === 'solved' ? (
        <div className="mt-3 grid grid-cols-5 gap-2">
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
      ) : null}

      {state.outcome === 'failed' ? (
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
      ) : null}

      {state.outcome === 'revealed' ? (
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
      ) : null}

      {sheet ? (
        <div className="mt-3">
          <SolutionMoves
            rows={sheet.rows}
            shownPly={shownPly}
            onSelect={browse}
            open={sheetVisible}
            onToggle={toggleSheet}
            listId={sheetId}
          />
        </div>
      ) : null}

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
 * The line as a score sheet, two moves per row, opened with the button that titles it. Every move is
 * a button so the board can show the position it reached; the rows stay mounted when closed so the
 * button keeps the list it controls.
 */
function SolutionMoves({
  rows,
  shownPly,
  onSelect,
  open,
  onToggle,
  listId,
}: {
  rows: readonly SolutionRow[];
  shownPly: number;
  onSelect: (ply: number) => void;
  open: boolean;
  onToggle: () => void;
  listId: string;
}) {
  return (
    <div className="border-line bg-paper-raised rounded-sm border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className={`hover:bg-paper flex min-h-11 w-full items-center justify-between gap-2 px-3 transition-colors ${
          open ? 'border-line rounded-t-sm border-b' : 'rounded-sm'
        }`}
      >
        <span className="text-accent-ink text-[0.6875rem] tracking-widest uppercase">
          {fr.puzzle.solutionTitle}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`text-ink-muted transition-transform motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <ol id={listId} hidden={!open} className="py-1 text-sm" aria-label={fr.puzzle.solutionTitle}>
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
