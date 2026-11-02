import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { paint, readTheme, saveTheme, type ThemeChoice } from '../app/theme';
import { fr } from '../i18n/fr';

const CHOICES: readonly { choice: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { choice: 'light', label: fr.appearance.light, icon: Sun },
  { choice: 'dark', label: fr.appearance.dark, icon: Moon },
  { choice: 'system', label: fr.appearance.system, icon: Monitor },
];

export function ThemePicker() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme);

  const choose = (next: ThemeChoice) => {
    setChoice(next);
    saveTheme(next);
    paint(next);
  };

  return (
    <div className="border-line flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y py-3">
      <div>
        <p className="text-[0.78125rem] font-semibold">{fr.appearance.label}</p>
        <p className="text-ink-muted mt-0.5 text-[0.71875rem]">{fr.appearance.hint}</p>
      </div>

      <div
        role="group"
        aria-label={fr.appearance.label}
        className="border-line flex gap-0.5 rounded-sm border p-0.5"
      >
        {CHOICES.map(({ choice: value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={choice === value}
            onClick={() => choose(value)}
            className={`flex min-h-11 items-center gap-1.5 rounded-xs px-2.5 text-[0.71875rem] font-semibold ${
              choice === value ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
