import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { database } from '../../db/db';
import { journalMark } from '../../db/journal';
import { fr } from '../../i18n/fr';
import { EndgamePlayer } from '../endgames/EndgameScreen';
import { OpeningPlayer } from '../openings/OpeningScreen';
import type { PuzzleBand } from '../puzzles/content';
import { PuzzlePlayer } from '../puzzles/PuzzlePlayer';
import { loadSessionCatalog } from './catalog';
import {
  advanceCursor,
  clearSession,
  readSession,
  resumeCursor,
  saveSession,
  type SessionCursor,
} from './cursor';
import { dueCountLabel, newCountLabel } from './labels';
import { planSession, type SessionPlan } from './plan';
import { readSessionSettings } from './settings';

type Basis =
  | { mode: 'resume'; cursor: SessionCursor }
  | { mode: 'new'; startedAt: number; newCount: number; band: PuzzleBand };

type SessionState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'empty' }
  | { status: 'ready'; plan: SessionPlan; cursor: SessionCursor };

/**
 * The daily session: the queue is derived from the journal pinned when the session started, and a
 * scalar cursor carries the position between visits. See GLOSSARY.md and DECISIONS.md#persistence.
 */
export function SessionScreen({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // The screen keeps the same basis across a retry, so a failed catalog load does not plan a
  // different session. A new visit reads the cursor again.
  const basis = useRef<Basis | null>(null);

  useEffect(() => {
    if (basis.current === null) {
      const stored = readSession();
      if (stored !== null && stored.completedAt === null) {
        basis.current = { mode: 'resume', cursor: stored };
      } else {
        const settings = readSessionSettings();
        basis.current = {
          mode: 'new',
          startedAt: Date.now(),
          newCount: settings.newCards,
          band: settings.band,
        };
      }
    }

    let active = true;

    (async () => {
      try {
        const [catalog, reviews] = await Promise.all([
          loadSessionCatalog(),
          database.reviews.toArray(),
        ]);
        if (!active) return;

        const start = basis.current!;
        const startedAt = start.mode === 'resume' ? start.cursor.startedAt : start.startedAt;
        const newCount = start.mode === 'resume' ? start.cursor.newCount : start.newCount;
        const band = start.mode === 'resume' ? start.cursor.band : start.band;
        const lastEntryId =
          start.mode === 'resume' ? start.cursor.lastEntryId : journalMark(reviews);

        const plan = planSession({
          reviews,
          catalog,
          startedAt,
          lastEntryId,
          newCount,
          band,
        });

        if (plan.cards.length === 0) {
          clearSession();
          setState({ status: 'empty' });
          return;
        }

        const cursor =
          start.mode === 'resume'
            ? resumeCursor(start.cursor, plan, Date.now())
            : {
                startedAt,
                lastEntryId,
                position: 0,
                newCount,
                band,
                total: plan.cards.length,
                dueCount: plan.dueCount,
                completedAt: null,
              };
        saveSession(cursor);
        setState({ status: 'ready', plan, cursor });
      } catch {
        if (active) setState({ status: 'failed' });
      }
    })();

    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  };

  const advance = () => {
    if (state.status !== 'ready') return;
    const cursor = advanceCursor(state.cursor, state.plan.cards.length, Date.now());
    saveSession(cursor);
    setState({ ...state, cursor });
  };

  const card = state.status === 'ready' ? state.plan.cards[state.cursor.position] : undefined;
  const completed =
    state.status === 'ready' &&
    (state.cursor.completedAt !== null || state.cursor.position >= state.cursor.total);
  const last = state.status === 'ready' && state.cursor.position + 1 >= state.cursor.total;
  const dueLeft =
    state.status === 'ready' ? Math.max(0, state.cursor.dueCount - state.cursor.position) : 0;
  const newLeft =
    state.status === 'ready' ? state.cursor.total - state.cursor.position - dueLeft : 0;
  const nextLabel = last ? fr.session.finish : fr.session.next;

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-4 pb-6 sm:px-6">
        <header className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExit}
            aria-label={fr.session.exit}
            className="text-ink-muted hover:text-ink -ml-2 grid size-11 place-items-center rounded-full"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif text-lg">{fr.session.title}</h1>
          {state.status === 'ready' ? (
            <span className="border-line text-ink-muted ml-auto rounded-full border px-2.5 py-1 text-xs">
              {state.cursor.position} / {state.cursor.total}
            </span>
          ) : null}
        </header>

        {state.status === 'ready' && !completed ? (
          <div
            role="progressbar"
            aria-label={fr.session.progressLabel}
            aria-valuemin={0}
            aria-valuemax={state.cursor.total}
            aria-valuenow={state.cursor.position}
            className="bg-line mt-2 h-1.5 overflow-hidden rounded-full"
          >
            <div
              className="bg-accent h-full rounded-full transition-[width] motion-reduce:transition-none"
              style={{ width: `${(state.cursor.position / state.cursor.total) * 100}%` }}
            />
          </div>
        ) : null}

        {state.status === 'ready' && !completed ? (
          <p className="text-ink-muted mt-1 text-xs">
            {dueCountLabel(dueLeft)} · {newCountLabel(newLeft)}
          </p>
        ) : null}

        <div className="mt-4 flex-1">
          {state.status === 'loading' ? (
            <p className="text-ink-muted mt-6 text-sm" role="status">
              {fr.session.preparing}
            </p>
          ) : null}

          {state.status === 'failed' ? (
            <div className="mt-6">
              <p className="text-sm" role="alert">
                {fr.session.loadFailed}
              </p>
              <button
                type="button"
                onClick={retry}
                className="bg-accent mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.session.retry}
              </button>
            </div>
          ) : null}

          {state.status === 'empty' || (state.status === 'ready' && !completed && !card) ? (
            <div className="mt-6">
              <h2 className="font-serif text-xl">{fr.session.emptyTitle}</h2>
              <p className="text-ink-muted mt-2 text-sm">{fr.session.emptyBody}</p>
              <button
                type="button"
                onClick={onExit}
                className="border-line text-ink-muted mt-4 w-full rounded-xl border px-4 py-3 text-sm"
              >
                {fr.session.backHome}
              </button>
            </div>
          ) : null}

          {state.status === 'ready' && completed ? (
            <div className="mt-6">
              <h2 className="font-serif text-2xl">{fr.session.doneTitle}</h2>
              <p className="text-ink-muted mt-2 text-sm">
                {fr.session.doneCards.replace('{count}', String(state.cursor.total))}
              </p>
              <button
                type="button"
                onClick={onExit}
                className="bg-accent mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.session.backHome}
              </button>
            </div>
          ) : null}

          {state.status === 'ready' && !completed && card?.kind === 'puzzle' ? (
            <PuzzlePlayer
              key={card.key}
              puzzle={card.puzzle}
              onNext={advance}
              nextLabel={nextLabel}
            />
          ) : null}

          {state.status === 'ready' && !completed && card?.kind === 'endgame' ? (
            <EndgamePlayer
              key={card.key}
              endgame={card.endgame}
              onOther={advance}
              nextLabel={nextLabel}
            />
          ) : null}

          {state.status === 'ready' && !completed && card?.kind === 'opening' ? (
            <OpeningPlayer
              key={card.key}
              line={card.line}
              onReviewed={() => undefined}
              onOther={advance}
              nextLabel={nextLabel}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
