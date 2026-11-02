import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  DEFAULT_THEME,
  isThemeChoice,
  readTheme,
  resolveScheme,
  saveTheme,
  THEME_STORAGE_KEY,
  type ThemeChoice,
} from './theme';

/** The two attributes the theme writes; records what each one received. */
function recorder() {
  const written: Record<string, string> = {};
  return {
    written,
    root: { setAttribute: (name: string, value: string) => void (written[name] = value) },
    meta: { setAttribute: (_name: string, value: string) => void (written.meta = value) },
  };
}

function storageWith(value: string | null) {
  return { getItem: () => value, setItem: () => {}, removeItem: () => {} };
}

describe('theme choice', () => {
  it('follows the device when nothing was chosen', () => {
    expect(readTheme(storageWith(null))).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe('system');
  });

  it('reads back what was saved', () => {
    let stored: string | null = null;
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => void (stored = value),
      removeItem: () => {},
    };

    saveTheme('dark', storage);

    expect(stored).toBe(JSON.stringify({ theme: 'dark' }));
    expect(readTheme(storage)).toBe('dark');
  });

  it('falls back to the device on an unknown or broken value', () => {
    expect(readTheme(storageWith('{"theme":"neon"}'))).toBe(DEFAULT_THEME);
    expect(readTheme(storageWith('{"theme":42}'))).toBe(DEFAULT_THEME);
    expect(readTheme(storageWith('not json'))).toBe(DEFAULT_THEME);
  });

  it('accepts only the three choices', () => {
    for (const choice of ['light', 'dark', 'system']) {
      expect(isThemeChoice(choice)).toBe(true);
    }
    expect(isThemeChoice('auto')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });

  it('keys the preference under its own name', () => {
    expect(THEME_STORAGE_KEY).toBe('gambit:theme');
  });
});

describe('painted scheme', () => {
  it('resolves a fixed choice whatever the device says', () => {
    const fixed: ThemeChoice[] = ['light', 'dark'];
    for (const choice of fixed) {
      expect(resolveScheme(choice, true)).toBe(choice);
      expect(resolveScheme(choice, false)).toBe(choice);
    }
  });

  it('follows the device when the choice is the system one', () => {
    expect(resolveScheme('system', true)).toBe('dark');
    expect(resolveScheme('system', false)).toBe('light');
  });

  it('writes the scheme on the root and the colour on the meta tag', () => {
    const painted = recorder();

    applyTheme('dark', painted, false);
    expect(painted.written['data-theme']).toBe('dark');
    expect(painted.written.meta).toBe('#191817');

    applyTheme('system', painted, false);
    expect(painted.written['data-theme']).toBe('light');
    expect(painted.written.meta).toBe('#fbfaf8');
  });
});
