import { ChevronLeft } from 'lucide-react';
import { fr } from '../../i18n/fr';
import { SkipLink } from '../../ui/SkipLink';
import { CREDITS, creditText } from './credits';

export function CreditsPage({ onExit }: { onExit: () => void }) {
  return (
    <div className="min-h-dvh bg-paper">
      <SkipLink />

      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pt-8 pb-8 sm:px-8">
        <header className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            aria-label={fr.credits.back}
            className="text-ink-muted hover:text-ink -ml-2 grid size-11 place-items-center rounded-full"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif text-lg">{fr.credits.title}</h1>
        </header>

        <main id="main" className="mt-6 flex-1">
          <p className="text-ink-muted text-sm leading-relaxed">{fr.credits.intro}</p>

          <ul className="mt-6 grid gap-3">
            {CREDITS.map((credit) => (
              <li key={credit.id} className="border-line bg-paper-raised rounded-xl border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="text-sm font-semibold">
                    <a
                      href={credit.sourceUrl}
                      rel="noreferrer"
                      className="decoration-line hover:text-ink underline underline-offset-2"
                    >
                      {credit.name}
                    </a>
                  </h2>
                  <a
                    href={credit.licenceUrl}
                    rel="noreferrer"
                    aria-label={`${fr.credits.licence} ${credit.licence}`}
                    className="border-line text-ink-muted hover:text-ink rounded-full border px-2 py-0.5 text-[11px]"
                  >
                    {credit.licence}
                  </a>
                </div>

                <p className="text-ink-muted mt-1 text-sm leading-snug">{creditText(credit.id)}</p>
                {credit.notice ? (
                  <p className="text-ink-muted mt-2 text-xs">{credit.notice}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <p className="border-line text-ink-muted mt-8 border-t pt-5 text-xs">
            {fr.credits.codeLicence}
          </p>
        </main>
      </div>
    </div>
  );
}
