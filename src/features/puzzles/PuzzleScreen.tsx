import { Chess } from 'chess.js';
import { ChevronLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fr } from '../../i18n/fr';
import { ChessBoard } from '../../ui/ChessBoard';
import { DEMO_PUZZLES } from './demo';
import { legalDests, playMove, revealSolution, startPuzzle } from './puzzle';

const puzzle = DEMO_PUZZLES[0];

const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
type Rating = (typeof RATINGS)[number];
const RATING_OPACITY: Record<Rating, string> = {
  again: 'bg-accent/40',
  hard: 'bg-accent/60',
  good: 'bg-accent/80',
  easy: 'bg-accent',
};

function themeLabel(theme: string): string {
  return (fr.puzzle.themes as Record<string, string>)[theme] ?? theme;
}

export function PuzzleScreen({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState(() => startPuzzle(puzzle));
  const [hint, setHint] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);

  const turn = useMemo(
    () => (new Chess(state.fen).turn() === 'w' ? 'white' : 'black'),
    [state.fen],
  );
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
  }, []);

  const reset = () => {
    setState(startPuzzle(puzzle));
    setHint(false);
    setRating(null);
  };

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-4 pb-6 sm:px-6">
        <header className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExit}
            aria-label={fr.puzzle.back}
            className="text-ink-muted hover:text-ink -ml-2 grid size-11 place-items-center rounded-full"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif text-lg">
            {fr.puzzle.counter} 1 / {DEMO_PUZZLES.length}
          </h1>
        </header>

        <div className="border-line bg-paper-raised mt-3 rounded-2xl border p-2.5 sm:p-3">
          <ChessBoard
            fen={state.fen}
            orientation="white"
            turn={turn}
            lastMove={state.lastMove}
            movable={state.outcome === 'playing'}
            dests={dests}
            onMove={(from, to) => setState((current) => playMove(current, from, to))}
          />
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
                onClick={() => setState((current) => revealSolution(current))}
                className="text-ink-muted hover:text-ink rounded-full px-3 py-2 text-xs"
              >
                {fr.puzzle.showSolution}
              </button>
            </div>
          ) : null}
        </div>

        {hint && state.outcome === 'playing' ? (
          <p className="text-ink-muted mt-1 text-xs">
            {fr.puzzle.hintPrefix} {puzzle.themes.map(themeLabel).join(' · ')}
          </p>
        ) : null}

        <div className="mt-4 flex-1">
          {state.outcome === 'solved' ? (
            <>
              <div className="bg-ok-soft text-ok rounded-xl p-4">
                <p className="text-sm font-semibold">{fr.puzzle.solved}</p>
                <p className="mt-1 text-xs opacity-80">
                  {puzzle.themes.map(themeLabel).join(' · ')} · {puzzle.rating}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-1.5">
                {RATINGS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={rating === value}
                    onClick={() => setRating(value)}
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
                onClick={onExit}
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
                  onClick={() => setState((current) => revealSolution(current))}
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

              <button
                type="button"
                onClick={reset}
                className="bg-accent mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.puzzle.retry}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
