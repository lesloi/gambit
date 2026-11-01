import { useEffect, useState } from 'react';
import { database } from '../../db/db';
import { journalMark } from '../../db/journal';
import { fr } from '../../i18n/fr';
import { BoardPreview } from '../../ui/BoardPreview';
import { SkipLink } from '../../ui/SkipLink';
import { loadSessionCatalog } from '../session/catalog';
import { clearSession, readSession } from '../session/cursor';
import { dueCountLabel, newCountLabel } from '../session/labels';
import { planSession } from '../session/plan';
import {
  NEW_CARD_CHOICES,
  readSessionSettings,
  saveSessionSettings,
  type SessionSettings,
} from '../session/settings';
import { RATING_BANDS, type PuzzleBand } from '../puzzles/content';
import { MODES } from './modes';

interface Preview {
  due: number;
  fresh: number;
  total: number;
}

export function HomePage({
  onStartSession,
  onStartPuzzle,
  onStartEndgame,
  onStartOpening,
  onShowCredits,
}: {
  onStartSession: () => void;
  onStartPuzzle: () => void;
  onStartEndgame: () => void;
  onStartOpening: () => void;
  onShowCredits: () => void;
}) {
  const [session] = useState(readSession);
  const [settings, setSettings] = useState(readSessionSettings);
  const [preview, setPreview] = useState<Preview | null>(null);

  const running = session !== null && session.completedAt === null ? session : null;
  const completed = session !== null && running === null ? session : null;
  const fresh = session === null;
  const nothingToDo = fresh && preview !== null && preview.total === 0;

  useEffect(() => {
    if (!fresh) return;
    let active = true;

    Promise.all([loadSessionCatalog(), database.reviews.toArray()]).then(
      ([catalog, reviews]) => {
        if (!active) return;
        const plan = planSession({
          reviews,
          catalog,
          startedAt: Date.now(),
          lastEntryId: journalMark(reviews),
          newCount: settings.newCards,
          band: settings.band,
        });
        setPreview({ due: plan.dueCount, fresh: plan.newCount, total: plan.cards.length });
      },
      () => {
        if (active) setPreview(null);
      },
    );

    return () => {
      active = false;
    };
  }, [fresh, settings.newCards, settings.band]);

  const changeSettings = (patch: Partial<SessionSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSessionSettings(next);
    setPreview(null);
  };

  const newCards = preview?.fresh ?? settings.newCards;
  const title = running
    ? fr.session.resumeTitle
    : completed
      ? fr.session.doneTitle
      : nothingToDo
        ? fr.session.emptyTitle
        : fr.session.readyTitle;
  const body = running
    ? fr.session.runningBody
        .replace('{done}', String(running.position))
        .replace('{total}', String(running.total))
    : completed
      ? fr.session.doneBody
      : nothingToDo
        ? fr.session.emptyBody
        : newCards === 0
          ? fr.session.readyBodyDueOnly
          : fr.session.readyBody.replace('{new}', newCountLabel(newCards));
  const action = running ? fr.session.resume : completed ? fr.session.restart : fr.session.start;

  return (
    <div className="min-h-dvh bg-paper">
      <SkipLink />

      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pt-8 pb-8 sm:px-8">
        <header>
          <h1 className="font-serif text-3xl leading-none tracking-tight">{fr.app.name}</h1>
          <p className="text-ink-muted mt-1 text-sm">{fr.app.tagline}</p>
        </header>

        <main id="main" className="flex-1">
          <section
            aria-labelledby="session-title"
            className="border-line bg-paper-raised mt-8 rounded-2xl border p-5 shadow-[0_1px_0_rgb(43_37_31_/_0.04)]"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <BoardPreview className="mx-auto w-56 shrink-0 sm:mx-0 sm:w-44" />
              <div className="min-w-0">
                <p className="text-accent text-[11px] tracking-[0.18em] uppercase">
                  {fr.home.sessionTitle}
                </p>
                <h2 id="session-title" className="mt-1 font-serif text-xl">
                  {title}
                </h2>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">{body}</p>

                {fresh && preview !== null ? (
                  <p className="text-ink-muted mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span>{dueCountLabel(preview.due)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{newCountLabel(preview.fresh)}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={onStartSession}
              disabled={nothingToDo}
              className="bg-accent mt-4 min-h-11 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-default disabled:opacity-50"
            >
              {action}
            </button>

            {running !== null ? (
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  onStartSession();
                }}
                className="text-ink-muted mt-2 min-h-11 w-full text-xs underline underline-offset-2"
              >
                {fr.session.restart}
              </button>
            ) : null}

            {running === null ? (
              <div className="border-line mt-4 grid gap-3 border-t pt-3 sm:grid-cols-2">
                <label
                  htmlFor="session-new-cards"
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-ink-muted text-xs">{fr.session.newCardsLabel}</span>
                  <select
                    id="session-new-cards"
                    value={settings.newCards}
                    onChange={(event) => changeSettings({ newCards: Number(event.target.value) })}
                    className="border-line bg-paper-raised text-ink min-h-11 rounded-lg border px-2 text-sm"
                  >
                    {NEW_CARD_CHOICES.map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor="session-band" className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted text-xs">{fr.session.bandLabel}</span>
                  <select
                    id="session-band"
                    value={settings.band}
                    onChange={(event) => changeSettings({ band: event.target.value as PuzzleBand })}
                    className="border-line bg-paper-raised text-ink min-h-11 rounded-lg border px-2 text-sm"
                  >
                    {RATING_BANDS.map((band) => (
                      <option key={band} value={band}>
                        {fr.puzzle.setup.ratings[band]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="train-title" className="mt-10">
            <h2 id="train-title" className="font-serif text-xl">
              {fr.home.trainTitle}
            </h2>
            <p className="text-ink-muted mt-1 text-sm">{fr.home.trainHint}</p>

            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {MODES.filter((mode) => mode.group === 'train').map(
                ({ id, icon: Icon, available }) => (
                  <li key={id} data-testid={`mode-${id}`}>
                    <button
                      type="button"
                      onClick={
                        id === 'puzzles'
                          ? onStartPuzzle
                          : id === 'endgames'
                            ? onStartEndgame
                            : id === 'openings'
                              ? onStartOpening
                              : undefined
                      }
                      disabled={!available}
                      className="border-line bg-paper-raised hover:border-accent/40 flex h-full w-full flex-col gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-default disabled:opacity-100"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          aria-hidden="true"
                          className="bg-accent-soft text-accent grid size-9 place-items-center rounded-lg"
                        >
                          <Icon size={18} strokeWidth={1.75} />
                        </span>
                        {available ? null : (
                          <span className="border-line text-ink-muted rounded-full border px-2 py-0.5 text-[10px] tracking-wider uppercase">
                            {fr.home.comingSoon}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{fr.modes[id].name}</h3>
                        <p className="text-ink-muted mt-1 text-sm leading-snug">
                          {fr.modes[id].goal}
                        </p>
                      </div>
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section aria-labelledby="play-title" className="mt-10">
            <h2 id="play-title" className="font-serif text-xl">
              {fr.home.playTitle}
            </h2>
            <p className="text-ink-muted mt-1 text-sm">{fr.home.playHint}</p>

            <ul className="mt-4">
              {MODES.filter((mode) => mode.group === 'play').map(
                ({ id, icon: Icon, available }) => (
                  <li
                    key={id}
                    data-testid={`mode-${id}`}
                    className="border-line bg-paper-raised flex items-start gap-3 rounded-xl border p-4"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-accent-soft text-accent grid size-9 shrink-0 place-items-center rounded-lg"
                    >
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold">{fr.modes[id].name}</h3>
                        {available ? null : (
                          <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-[10px] tracking-wider uppercase">
                            {fr.home.comingSoon}
                          </span>
                        )}
                      </div>
                      <p className="text-ink-muted mt-1 text-sm leading-snug">
                        {fr.modes[id].goal}
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>
        </main>

        <footer className="border-line text-ink-muted mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-5 text-xs">
          <span>{fr.home.privacy}</span>
          <span aria-hidden="true">·</span>
          <span>{fr.home.license}</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={onShowCredits}
            className="decoration-line hover:text-ink underline underline-offset-2"
          >
            {fr.home.credits}
          </button>
          <a
            className="decoration-line hover:text-ink ml-auto underline underline-offset-2"
            href="https://github.com/lesloi/gambit"
            rel="noreferrer"
          >
            {fr.home.source}
          </a>
        </footer>
      </div>
    </div>
  );
}
