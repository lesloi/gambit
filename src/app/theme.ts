import { browserStorage, type StorageLike } from '../lib/storage';

/** What the user asked for: a fixed scheme, or whatever the device uses. */
export type ThemeChoice = 'light' | 'dark' | 'system';

/** The scheme actually painted. */
export type Scheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'gambit:theme';

/** Following the device is the default: it is what most people already expect. */
export const DEFAULT_THEME: ThemeChoice = 'system';

export const THEME_COLORS: Record<Scheme, string> = {
  light: '#fbfaf8',
  dark: '#191817',
};

const CHOICES: readonly string[] = ['light', 'dark', 'system'];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && CHOICES.includes(value);
}

/** A preference, like the puzzle filters: losing it only costs the default. */
export function readTheme(storage: StorageLike | null = browserStorage()): ThemeChoice {
  if (!storage) return DEFAULT_THEME;

  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    if (raw === null) return DEFAULT_THEME;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return DEFAULT_THEME;
    }
    const { theme } = value as Record<string, unknown>;
    return isThemeChoice(theme) ? theme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(
  theme: ThemeChoice,
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme }));
  } catch {
    // A blocked storage only costs the preference; the screen keeps working.
  }
}

export function resolveScheme(theme: ThemeChoice, prefersDark: boolean): Scheme {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}

/** The two nodes the theme paints; a test stands in for them. */
export interface ThemeTarget {
  root: { setAttribute(name: string, value: string): void };
  meta: { setAttribute(name: string, value: string): void } | null;
}

/**
 * Paints the document. The attribute drives the tokens and the browser's own
 * widgets; the meta colours the phone's status bar.
 */
export function applyTheme(theme: ThemeChoice, target: ThemeTarget, prefersDark: boolean): Scheme {
  const scheme = resolveScheme(theme, prefersDark);
  target.root.setAttribute('data-theme', scheme);
  target.meta?.setAttribute('content', THEME_COLORS[scheme]);
  return scheme;
}

/** Paints the document for a choice, using the device's preference if it needs one. */
export function paint(choice: ThemeChoice): void {
  const target = documentTarget();
  if (target) applyTheme(choice, target, prefersDark());
}

/**
 * Keeps a "système" choice live while the app is open. The listener lives at the app level, not
 * in the picker: the device can flip while the user is in a game, far from the setting.
 */
export function watchSystemTheme(): () => void {
  if (typeof matchMedia !== 'function') return () => {};

  const query = matchMedia('(prefers-color-scheme: dark)');
  const repaint = () => {
    if (readTheme() === 'system') paint('system');
  };
  query.addEventListener('change', repaint);

  return () => query.removeEventListener('change', repaint);
}

/** The document as `applyTheme` expects it, in a browser only. */
export function documentTarget(): ThemeTarget | null {
  if (typeof document === 'undefined') return null;
  return {
    root: document.documentElement,
    meta: document.querySelector('meta[name="theme-color"]'),
  };
}

export function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}
