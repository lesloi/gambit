import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREDITS } from './credits';

const root = new URL('../../../', import.meta.url);

describe('credits', () => {
  it('names every third party shipped as a folder of public', () => {
    const shipped = readdirSync(new URL('public/', root), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const folder of shipped) {
      const credited = CREDITS.some((credit) => credit.path.startsWith(`public/${folder}/`));
      expect(credited, folder).toBe(true);
    }
  });

  it('points every credit at the files it covers', () => {
    for (const credit of CREDITS) {
      expect(existsSync(new URL(credit.path, root)), credit.path).toBe(true);
    }
  });
});
