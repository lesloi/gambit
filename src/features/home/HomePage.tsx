import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { database } from '../../db/db';
import { journalMark } from '../../db/journal';
import { fr } from '../../i18n/fr';
import { BoardPreview } from '../../ui/BoardPreview';
import { SkipLink } from '../../ui/SkipLink';
import { ThemePicker } from '../../ui/ThemePicker';
import { readDraft } from '../play/draft';
import { levelAt, levelIndex } from '../play/level';
import { readPlayElo, readPlayTimeControl } from '../play/settings';
import { formatTimeControl, timeControlAt } from '../play/timeControl';
import { puzzleMistakes } from '../progress/mistakes';
import { RATING_BANDS, type PuzzleBand } from '../puzzles/content';
import { loadSessionCatalog } from '../session/catalog';
import { clearSession, readSession } from '../session/cursor';
import { compactCountLabel, compactDueLabel, compactNewLabel } from '../session/labels';
import { planSession } from '../session/plan';
import {
  NEW_CARD_CHOICES,
  readSessionSettings,
  saveSessionSettings,
  type SessionSettings,
} from '../session/settings';
import { MODES, type ModeId } from './modes';
import { dueCountsByMode } from './sessionPreview';

interface Preview {
  due: number;
  newCards: number;
  total: number;
  /** The due cards of the plan, per mode, for the trainer rows. */
  dueByMode: Record<ModeId, number>;
}

const EYEBROW = 'text-ink-muted text-[0.6875rem] font-semibold tracking-[0.12em] uppercase';
const MODE_ROW =
  'border-line-soft flex w-full items-center gap-3 border-b py-2.5 pr-1 text-left disabled:cursor-default';
const TODAY = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export function HomePage({
  onStartSession,
  onStartPuzzle,
  onStartEndgame,
  onStartOpening,
  onStartPlay,
  onShowMistakes,
  onShowCredits,
}: {
  onStartSession: () => void;
  onStartPuzzle: () => void;
  onStartEndgame: () => void;
  onStartOpening: () => void;
  onStartPlay: () => void;
  onShowMistakes: () => void;
  onShowCredits: () => void;
}) {
  const [session] = useState(readSession);
  const [settings, setSettings] = useState(readSessionSettings);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mistakes, setMistakes] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft] = useState(readDraft);
  const [playLevel] = useState(() => levelAt(levelIndex(draft ? draft.level : readPlayElo())));
  const [playControl] = useState(() =>
    draft
      ? { controlMs: draft.controlMs, incrementMs: draft.incrementMs }
      : timeControlAt(readPlayTimeControl()),
  );

  const running = session !== null && session.completedAt === null ? session : null;
  const completed = session !== null && running === null ? session : null;
  const fresh = session === null;
  const nothingToDo = fresh && preview !== null && preview.total === 0;

  const dueLeft = running === null ? 0 : Math.max(0, running.dueCount - running.position);
  const newLeft = running === null ? 0 : Math.max(0, running.total - running.position - dueLeft);
  const counts =
    running !== null
      ? compactCountLabel(dueLeft, newLeft)
      : fresh && preview !== null
        ? compactCountLabel(preview.due, preview.newCards)
        : '';

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
        : '';
  const action = running ? fr.session.resume : completed ? fr.session.restart : fr.session.start;

  const settingsSummary =
    settings.newCards === 0
      ? fr.home.settingsNone
      : `${compactNewLabel(settings.newCards)} · ${fr.puzzle.setup.ratings[settings.band]}`;
  const playDetail = `${fr.play.levelValue.replace('{elo}', String(playLevel.elo))} · ${formatTimeControl(playControl)}`;
  const playMode = MODES.find((mode) => mode.group === 'play');
  const PlayIcon = playMode?.icon;
  const mistakesLabel =
    mistakes === null || mistakes <= 0
      ? ''
      : mistakes === 1
        ? fr.home.mistakesOne
        : fr.home.mistakesMany.replace('{count}', String(mistakes));

  useEffect(() => {
    let active = true;

    Promise.all([loadSessionCatalog(), database.reviews.toArray()]).then(
      ([catalog, reviews]) => {
        if (!active) return;

        const missed = puzzleMistakes(reviews, new Set(catalog.puzzles.map((puzzle) => puzzle.id)));
        setMistakes(missed.length);

        if (!fresh) return;

        const plan = planSession({
          reviews,
          catalog,
          startedAt: Date.now(),
          lastEntryId: journalMark(reviews),
          newCount: settings.newCards,
          band: settings.band,
        });
        setPreview({
          due: plan.dueCount,
          newCards: plan.newCount,
          total: plan.cards.length,
          dueByMode: dueCountsByMode(plan.cards, plan.dueCount),
        });
      },
      () => {
        if (!active) return;
        setMistakes(null);
        if (fresh) setPreview(null);
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

  const startMode = (id: ModeId) => {
    if (id === 'puzzles') onStartPuzzle();
    else if (id === 'endgames') onStartEndgame();
    else if (id === 'openings') onStartOpening();
    else onStartPlay();
  };

  const trainModes = MODES.filter((mode) => mode.group === 'train');

  return (
    <div className="min-h-dvh bg-paper">
      <SkipLink />

      <header className="border-line border-b">
        <div className="mx-auto flex w-full max-w-2xl items-baseline justify-between gap-3 px-5 py-3">
          <h1 className="text-[0.9375rem] font-semibold tracking-tight">
            {fr.app.name.toLowerCase()}
            <span className="text-accent-ink">.</span>
          </h1>
          <p className="text-ink-muted text-xs">{TODAY.format(new Date())}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 pt-5 pb-8">
        <main id="main">
          <section aria-labelledby="session-title" className="mx-auto w-[min(100%,300px)]">
            <BoardPreview className="w-full" />

            <div className="border-line bg-paper-raised -mt-2.5 mx-3 rounded-sm border p-3">
              <p className={EYEBROW}>{fr.home.sessionTitle}</p>
              <h2 id="session-title" className="mt-1 text-lg leading-tight font-semibold">
                {title}
              </h2>
              {body !== '' ? (
                <p className="text-ink-muted mt-1 text-[0.8125rem] leading-relaxed">{body}</p>
              ) : null}

              {running !== null ? (
                <div
                  role="progressbar"
                  aria-label={fr.session.progressLabel}
                  aria-valuemin={0}
                  aria-valuemax={running.total}
                  aria-valuenow={running.position}
                  className="bg-line mt-2.5 h-1.5 overflow-hidden rounded-full"
                >
                  <div
                    className="bg-accent h-full rounded-full transition-[width] motion-reduce:transition-none"
                    style={{
                      width: `${running.total === 0 ? 0 : (running.position / running.total) * 100}%`,
                    }}
                  />
                </div>
              ) : null}

              {counts !== '' ? <p className="text-ink-muted mt-1 text-xs">{counts}</p> : null}

              <button
                type="button"
                onClick={onStartSession}
                disabled={nothingToDo}
                className="bg-accent mt-3 min-h-11 w-full rounded-sm px-4 text-[0.84375rem] font-semibold text-white disabled:cursor-default disabled:opacity-50"
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
                  className="text-ink-muted hover:text-ink mt-1 min-h-11 w-full text-xs underline underline-offset-2"
                >
                  {fr.session.restart}
                </button>
              ) : null}

              {running === null ? (
                <>
                  <button
                    type="button"
                    aria-expanded={settingsOpen}
                    aria-controls="session-settings"
                    onClick={() => setSettingsOpen((open) => !open)}
                    className="border-line text-ink-muted hover:text-ink mt-2 flex min-h-11 w-full items-center justify-between gap-2 border-t pt-2 text-left text-[0.71875rem]"
                  >
                    <span>{fr.home.settings}</span>
                    <span className="flex items-center gap-1 text-[0.65625rem]">
                      {settingsSummary}
                      <ChevronDown
                        size={14}
                        aria-hidden="true"
                        className={`transition-transform motion-reduce:transition-none ${settingsOpen ? 'rotate-180' : ''}`}
                      />
                    </span>
                  </button>

                  <div
                    id="session-settings"
                    className={settingsOpen ? 'mt-2 grid gap-2' : 'hidden'}
                  >
                    <label htmlFor="session-new-cards" className="block">
                      <span className="text-ink-muted block text-xs">
                        {fr.session.newCardsLabel}
                      </span>
                      <select
                        id="session-new-cards"
                        value={settings.newCards}
                        onChange={(event) =>
                          changeSettings({ newCards: Number(event.target.value) })
                        }
                        className="border-line bg-paper text-ink mt-1 min-h-11 w-full rounded-sm border px-2 text-sm"
                      >
                        {NEW_CARD_CHOICES.map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label htmlFor="session-band" className="block">
                      <span className="text-ink-muted block text-xs">{fr.session.bandLabel}</span>
                      <select
                        id="session-band"
                        value={settings.band}
                        onChange={(event) =>
                          changeSettings({ band: event.target.value as PuzzleBand })
                        }
                        className="border-line bg-paper text-ink mt-1 min-h-11 w-full rounded-sm border px-2 text-sm"
                      >
                        {RATING_BANDS.map((band) => (
                          <option key={band} value={band}>
                            {fr.puzzle.setup.ratings[band]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="train-title" className="mt-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="train-title" className={EYEBROW}>
                {fr.home.trainTitle}
              </h2>
              {preview !== null && preview.due > 0 ? (
                <span className="text-ink-muted text-[0.6875rem]">
                  {compactDueLabel(preview.due)}
                </span>
              ) : null}
            </div>

            <ol className="mt-1 list-none">
              {trainModes.map(({ id, available }, index) => {
                const due = preview === null ? 0 : preview.dueByMode[id];
                return (
                  <li key={id} data-testid={`mode-${id}`}>
                    <button
                      type="button"
                      onClick={() => startMode(id)}
                      disabled={!available}
                      className={MODE_ROW}
                    >
                      <span
                        aria-hidden="true"
                        className="text-ink-muted w-5 shrink-0 text-[0.625rem] font-semibold tabular-nums"
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{fr.modes[id].name}</span>
                        <span className="text-ink-muted mt-0.5 block text-xs leading-snug">
                          {fr.modes[id].goal}
                        </span>
                      </span>
                      {available ? (
                        <>
                          {due > 0 ? (
                            <span className="text-accent-ink shrink-0 text-[0.625rem] font-semibold whitespace-nowrap">
                              {compactDueLabel(due)}
                            </span>
                          ) : null}
                          <ChevronRight
                            size={16}
                            className="text-ink-muted shrink-0 opacity-60"
                            aria-hidden="true"
                          />
                        </>
                      ) : (
                        <span className="border-line text-ink-muted shrink-0 rounded-xs border px-1.5 py-0.5 text-[0.625rem] tracking-wide uppercase">
                          {fr.home.comingSoon}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          {playMode !== undefined && PlayIcon !== undefined ? (
            <button
              type="button"
              data-testid="mode-play"
              onClick={onStartPlay}
              disabled={!playMode.available}
              className="border-line bg-paper-raised mt-3 flex min-h-14 w-full items-center gap-3 rounded-sm border p-2.5 text-left disabled:cursor-default"
            >
              <span
                aria-hidden="true"
                className="bg-accent-soft text-accent-ink grid size-[1.875rem] shrink-0 place-items-center rounded-sm"
              >
                <PlayIcon size={17} strokeWidth={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {draft !== null ? fr.play.resumeTitle : fr.play.start}
                </span>
                <span className="text-ink-muted mt-0.5 block text-xs">{playDetail}</span>
              </span>
              {playMode.available ? (
                <ChevronRight
                  size={16}
                  className="text-ink-muted shrink-0 opacity-60"
                  aria-hidden="true"
                />
              ) : (
                <span className="border-line text-ink-muted shrink-0 rounded-xs border px-1.5 py-0.5 text-[0.625rem] tracking-wide uppercase">
                  {fr.home.comingSoon}
                </span>
              )}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onShowMistakes}
            className="text-ink-muted hover:text-ink mt-1 flex min-h-11 w-full items-center justify-between gap-3 px-0.5 text-left text-[0.71875rem]"
          >
            <span>
              <span className="text-ink font-semibold">{fr.progress.review}</span>
              {mistakesLabel !== '' ? <span> · {mistakesLabel}</span> : null}
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          <div className="mt-6">
            <ThemePicker />
          </div>

          <footer className="text-ink-muted mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.71875rem]">
            <span>{fr.home.privacy}</span>
            <span aria-hidden="true">·</span>
            <span>{fr.home.license}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onShowCredits}
              className="hover:text-ink underline underline-offset-2"
            >
              {fr.home.credits}
            </button>
            <a
              className="hover:text-ink ml-auto underline underline-offset-2"
              href="https://github.com/lesloi/gambit"
              rel="noreferrer"
            >
              {fr.home.source}
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
