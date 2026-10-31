import { fr } from '../i18n/fr';

/**
 * Hidden above the viewport rather than with `sr-only`: the clipped box that `sr-only` builds
 * cannot be undone by the focus utilities alone, which left the focused link invisible.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="bg-paper-raised absolute -top-24 left-4 z-10 rounded-md px-3 py-2 shadow focus:top-4"
    >
      {fr.home.skipToContent}
    </a>
  );
}
