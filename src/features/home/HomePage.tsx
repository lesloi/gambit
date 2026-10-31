import { fr } from '../../i18n/fr';
import { BoardPreview } from '../../ui/BoardPreview';
import { MODES } from './modes';

export function HomePage({ onStartPuzzle }: { onStartPuzzle: () => void }) {
  return (
    <div className="min-h-dvh bg-paper">
      <a
        href="#main"
        className="focus:bg-paper-raised focus:absolute focus:top-4 focus:left-4 focus:z-10 focus:rounded-md focus:px-3 focus:py-2 focus:shadow sr-only"
      >
        {fr.home.skipToContent}
      </a>

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
                  {fr.home.sessionEmptyTitle}
                </h2>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  {fr.home.sessionEmptyBody}
                </p>
              </div>
            </div>
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
                      onClick={id === 'puzzles' ? onStartPuzzle : undefined}
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
