import { Chess } from 'chess.js';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Rating as FsrsRating, type Grade } from 'ts-fsrs';
import { fr } from '../../i18n/fr';
import { ChessBoard } from '../../ui/ChessBoard';
import { loadPuzzles, puzzleLength, selectPuzzles, type PuzzleFilters } from './content';
import { readPuzzleFilters, savePuzzleFilters } from './filterStorage';
import { lengthLabel, themeLabel } from './labels';
import { PromotionDialog, type PromotionAnchor } from './PromotionDialog';
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
import { PuzzleSetup } from './PuzzleSetup';
import { missedAttemptRating, recordPuzzleReview } from './record';

const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
type Rating = (typeof RATINGS)[number];
const GRADE: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};
const RATING_OPACITY: Record<Rating, string> = {
  again: 'bg-accent/40',
  hard: 'bg-accent/60',
  good: 'bg-accent/80',
  easy: 'bg-accent',
};

type LoadState =
  { status: 'loading' } | { status: 'ready'; puzzles: readonly Puzzle[] } | { status: 'failed' };

const NO_PUZZLES: readonly Puzzle[] = [];

interface PendingPromotion {
  from: string;
  to: string;
  options: PromotionPiece[];
}

/** The viewport centre of a square, for the board as it is oriented on screen. */
function promotionAnchor(
  host: HTMLElement | null,
  square: string,
  orientation: 'white' | 'black',
): PromotionAnchor | null {
  if (!host) return null;

  const bounds = host.getBoundingClientRect();
  const size = bounds.width / 8;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const column = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 8 - rank : rank - 1;
  return {
    x: bounds.left + (column + 0.5) * size,
    y: bounds.top + (row + 0.5) * size,
    size,
  };
}

function sideToMove(fen: string): 'white' | 'black' {
  return new Chess(fen).turn() === 'w' ? 'white' : 'black';
}

/** A fresh order per start, so a second run of the same choices is not the same sequence. */
function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

export function PuzzleScreen({ onExit }: { onExit: () => void }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<PuzzleFilters>(readPuzzleFilters);
  const [phase, setPhase] = useState<'setup' | 'play'>('setup');
  const [session, setSession] = useState<{
    pool: readonly Puzzle[];
    index: number;
  } | null>(null);
  const [started, setStarted] = useState(0);

  useEffect(() => {
    let active = true;
    loadPuzzles().then(
      (puzzles) => {
        if (!active) return;
        setLoad({ status: 'ready', puzzles });
      },
      () => {
        if (active) setLoad({ status: 'failed' });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const puzzles = load.status === 'ready' ? load.puzzles : NO_PUZZLES;
  const matches = useMemo(() => selectPuzzles(puzzles, filters), [puzzles, filters]);
  const puzzle = phase === 'play' && session ? session.pool[session.index] : null;

  const changeFilters = (next: PuzzleFilters) => {
    setFilters(next);
    savePuzzleFilters(next);
  };

  const start = () => {
    if (matches.length === 0) return;
    setSession({ pool: shuffle(matches), index: 0 });
    setStarted((value) => value + 1);
    setPhase('play');
  };

  const next = () => {
    if (!session) return;
    setSession({
      ...session,
      index: (session.index + 1) % session.pool.length,
    });
    setStarted((value) => value + 1);
  };

  const retry = () => {
    setLoad({ status: 'loading' });
    setAttempt((value) => value + 1);
  };

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-4 pb-6 sm:px-6">
        <header className="flex items-center gap-1">
          <button
            type="button"
            onClick={phase === 'play' ? () => setPhase('setup') : onExit}
            aria-label={fr.puzzle.back}
            className="text-ink-muted hover:text-ink -ml-2 grid size-11 place-items-center rounded-full"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif text-lg">
            {phase === 'play' ? fr.puzzle.counter : fr.puzzle.title}
          </h1>
          {puzzle ? (
            <span className="border-line text-ink-muted ml-auto rounded-full border px-2.5 py-1 text-xs">
              {fr.puzzle.difficulty} {puzzle.rating}
            </span>
          ) : null}
        </header>

        <div className="mt-4 flex-1">
          {phase === 'setup' ? (
            <PuzzleSetup
              filters={filters}
              status={load.status}
              matches={matches.length}
              onChange={changeFilters}
              onStart={start}
              onRetry={retry}
            />
          ) : null}

          {phase === 'play' && puzzle ? (
            <PuzzlePlayer key={started} puzzle={puzzle} onNext={next} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PuzzlePlayer({ puzzle, onNext }: { puzzle: Puzzle; onNext: () => void }) {
  const [state, setState] = useState(() => startPuzzle(puzzle));
  const [hint, setHint] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const boardHost = useRef<HTMLDivElement>(null);
  const attemptRecorded = useRef(false);

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
    try {
      await recordPuzzleReview(puzzle.id, GRADE[value]);
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
    void recordPuzzleReview(puzzle.id, missed).catch(() => undefined);
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

            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {RATINGS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={rating === value}
                  disabled={rating !== null}
                  onClick={() => void rate(value)}
                  className={`rounded-lg border px-1 py-2 text-[11px] transition-colors ${
                    rating === value
                      ? 'border-ok text-ink font-semibold'
                      : 'border-line text-ink-muted'
                  }`}
                >
                  <span className={`mb-1.5 block h-0.5 rounded-full ${RATING_OPACITY[value]}`} />
                  {fr.puzzle.rating[value]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onNext}
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
                onClick={onNext}
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
