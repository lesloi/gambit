import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fr } from '../../i18n/fr';
import { loadPuzzles, selectPuzzles, type PuzzleFilters } from './content';
import { readPuzzleFilters, savePuzzleFilters } from './filterStorage';
import { PuzzlePlayer } from './PuzzlePlayer';
import { PuzzleSetup } from './PuzzleSetup';
import type { Puzzle } from './puzzle';

type LoadState =
  { status: 'loading' } | { status: 'ready'; puzzles: readonly Puzzle[] } | { status: 'failed' };

const NO_PUZZLES: readonly Puzzle[] = [];

/** A fresh order per start, so a second run of the same choices is not the same sequence. */
function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap]!, copy[index]!];
  }
  return copy;
}

export function PuzzleScreen({
  onExit,
  onReviewMistakes,
}: {
  onExit: () => void;
  onReviewMistakes: () => void;
}) {
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
              onReviewMistakes={onReviewMistakes}
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
