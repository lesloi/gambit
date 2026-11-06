import { fr } from '../i18n/fr';

/**
 * The only rating left to the user after a solve: a solve is written `good` when the attempt is
 * left, and this button demotes it to `again`. It is not offered after a miss, whose review is
 * already `again`. Once recorded the button becomes a status line, so the state is announced
 * rather than shown as a pressed toggle.
 */
export function AgainButton({
  recorded,
  disabled,
  onPress,
}: {
  recorded: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  if (recorded) {
    return (
      <p role="status" className="text-ink-muted flex min-h-11 items-center justify-center text-xs">
        {fr.rating.againRecorded}
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      className="border-line text-ink-muted hover:text-ink min-h-11 w-full rounded-sm border px-3 text-xs transition-colors disabled:opacity-60"
    >
      {fr.rating.again}
    </button>
  );
}
