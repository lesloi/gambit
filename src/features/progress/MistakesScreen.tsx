import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { database, type Review } from '../../db/db';
import { fr } from '../../i18n/fr';
import { PuzzlePlayer } from '../puzzles/PuzzlePlayer';
import { loadPuzzleArchive } from '../puzzles/content';
import { themeLabel } from '../puzzles/labels';
import type { Puzzle } from '../puzzles/puzzle';
import { puzzleMistakes } from './mistakes';

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const NO_PUZZLES: readonly Puzzle[] = [];

type ArchiveState = 'loading' | 'ready' | 'failed';

interface Row {
  puzzle: Puzzle;
  /** Epoch milliseconds of the latest miss. */
  reviewedAt: number;
}

/**
 * The missed puzzles, from the journal, replayed one tap away. The journal is reread when a replay
 * ends, so a puzzle missed again moves to the top with today's date; the archive itself is loaded
 * once for the visit.
 */
export function MistakesScreen({ onExit }: { onExit: () => void }) {
  const [archive, setArchive] = useState<ArchiveState>('loading');
  const [puzzles, setPuzzles] = useState<readonly Puzzle[]>(NO_PUZZLES);
  const [reviews, setReviews] = useState<readonly Review[] | null>(null);
  const [reviewsFailed, setReviewsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const rowButtons = useRef(new Map<string, HTMLButtonElement | null>());
  const rowToFocus = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    loadPuzzleArchive().then(
      (loaded) => {
        if (!active) return;
        setPuzzles(loaded);
        setArchive('ready');
      },
      () => {
        if (active) setArchive('failed');
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    let active = true;
    database.reviews.toArray().then(
      (entries) => {
        if (!active) return;
        setReviews(entries);
        setReviewsFailed(false);
      },
      () => {
        if (active) setReviewsFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, refresh]);

  const rows = useMemo(() => {
    const byId = new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]));
    const list: Row[] = [];
    // The archive was just filtered by the same ids, so every mistake has its puzzle.
    for (const mistake of puzzleMistakes(reviews ?? [], new Set(byId.keys()))) {
      const puzzle = byId.get(mistake.puzzleId);
      if (puzzle) list.push({ puzzle, reviewedAt: mistake.reviewedAt });
    }
    return list;
  }, [puzzles, reviews]);

  const failed = archive === 'failed' || reviewsFailed;
  const loading = !failed && (archive === 'loading' || reviews === null);

  const current = playing === null ? -1 : rows.findIndex((row) => row.puzzle.id === playing);
  const playingRow = current >= 0 ? rows[current] : undefined;

  const leave = () => {
    rowToFocus.current = playing;
    setPlaying(null);
    setRefresh((value) => value + 1);
  };

  const next = () => {
    const following = rows[current + 1];
    if (following) {
      setPlaying(following.puzzle.id);
      setRefresh((value) => value + 1);
    } else {
      leave();
    }
  };

  // The list is back: hand the focus to the row the replay came from, which the refresh remounted.
  useEffect(() => {
    const id = rowToFocus.current;
    if (playing !== null || id === null) return;
    rowToFocus.current = null;
    rowButtons.current.get(id)?.focus();
  });

  const retry = () => {
    setArchive('loading');
    setReviews(null);
    setReviewsFailed(false);
    setAttempt((value) => value + 1);
  };

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-4 pb-6 sm:px-6">
        <header className="flex items-center gap-1">
          <button
            type="button"
            onClick={playing === null ? onExit : leave}
            aria-label={fr.progress.back}
            className="text-ink-muted hover:text-ink -ml-2 grid size-11 place-items-center rounded-full"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif text-lg">{fr.progress.title}</h1>
          {current >= 0 ? (
            <span className="border-line text-ink-muted ml-auto rounded-full border px-2.5 py-1 text-xs">
              {fr.progress.counter
                .replace('{index}', String(current + 1))
                .replace('{count}', String(rows.length))}
            </span>
          ) : null}
        </header>

        <div className="mt-4 flex-1">
          {failed ? (
            <div
              role="alert"
              className="border-line bg-paper-raised mt-6 rounded-2xl border p-4 text-center"
            >
              <p className="text-sm">{fr.puzzle.loadFailed}</p>
              <button
                type="button"
                onClick={retry}
                className="bg-accent mt-3 rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.puzzle.reload}
              </button>
            </div>
          ) : loading ? (
            <p role="status" className="text-ink-muted mt-6 text-center text-sm">
              {fr.puzzle.loading}
            </p>
          ) : playingRow ? (
            <PuzzlePlayer key={playingRow.puzzle.id} puzzle={playingRow.puzzle} onNext={next} />
          ) : rows.length === 0 ? (
            <p className="text-ink-muted text-sm">{fr.progress.empty}</p>
          ) : (
            <>
              <p className="text-ink-muted text-sm">{fr.progress.intro}</p>

              <ul className="mt-5 grid gap-3">
                {rows.map((row) => (
                  <li key={row.puzzle.id}>
                    <button
                      type="button"
                      onClick={() => setPlaying(row.puzzle.id)}
                      ref={(element) => {
                        rowButtons.current.set(row.puzzle.id, element);
                      }}
                      className="border-line bg-paper-raised hover:border-accent/40 flex min-h-11 w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {fr.progress.reportedOn.replace('{date}', DATE.format(row.reviewedAt))}
                        </span>
                        <span className="text-ink-muted mt-1 block text-sm leading-snug">
                          {row.puzzle.themes.slice(0, 3).map(themeLabel).join(' · ')}
                        </span>
                      </span>
                      <span className="border-line text-ink-muted shrink-0 rounded-full border px-2.5 py-1 text-xs">
                        {row.puzzle.rating}
                      </span>
                      <ChevronRight
                        size={18}
                        aria-hidden="true"
                        className="text-ink-muted shrink-0"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
