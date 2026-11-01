import { describe, expect, it } from 'vitest';
import { dueCountLabel, newCountLabel } from './labels';

describe('session counts', () => {
  it('says none, one or many due cards', () => {
    expect(dueCountLabel(0)).toBe('Aucune fiche à revoir');
    expect(dueCountLabel(1)).toBe('1 fiche à revoir');
    expect(dueCountLabel(4)).toBe('4 fiches à revoir');
  });

  it('says none, one or many new cards', () => {
    expect(newCountLabel(0)).toBe('Aucune nouvelle fiche');
    expect(newCountLabel(1)).toBe('1 nouvelle fiche');
    expect(newCountLabel(5)).toBe('5 nouvelles fiches');
  });
});
