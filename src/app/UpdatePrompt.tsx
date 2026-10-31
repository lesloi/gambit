import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { fr } from '../i18n/fr';

/**
 * A deploy leaves its worker waiting until the user accepts, so nothing reloads the page under an
 * exercise in progress. The accepted worker claims the page (`clientsClaim` in `vite.config.ts`),
 * and the resulting controller change is what reloads it.
 */
export function UpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // No timer: an idle app makes no request. Returning to the app is when a deploy matters.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void registration.update().catch(() => undefined);
        }
      });
    },
  });
  const [open, setOpen] = needRefresh;
  const [updating, setUpdating] = useState(false);

  const reload = () => {
    setUpdating(true);
    // The wrapper only reloads when it recognised an update, which misses a deploy during the
    // first session. The controller change fires either way.
    navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    });
    void updateServiceWorker(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="status"
        className={
          open
            ? 'border-line bg-paper-raised pointer-events-auto mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border p-4 shadow-lg sm:flex-row sm:items-center'
            : 'sr-only'
        }
      >
        {open ? (
          <>
            <p className="text-sm">{fr.pwa.updateAvailable}</p>
            <div className="flex gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border-line text-ink-muted min-h-11 flex-1 rounded-xl border px-4 text-sm sm:flex-none"
              >
                {fr.pwa.later}
              </button>
              <button
                type="button"
                onClick={reload}
                disabled={updating}
                className="bg-accent min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 sm:flex-none"
              >
                {updating ? fr.pwa.updating : fr.pwa.reload}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
