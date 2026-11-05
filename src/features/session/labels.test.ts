import { describe, expect, it } from 'vitest';
import {
  compactCountLabel,
  compactDueLabel,
  compactNewLabel,
  dueCountLabel,
  newCountLabel,
} from './labels';

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

describe('compact session counts', () => {
  it('says one or many due cards, and nothing when none are due', () => {
    expect(compactDueLabel(0)).toBe('');
    expect(compactDueLabel(1)).toBe('1 à revoir');
    expect(compactDueLabel(4)).toBe('4 à revoir');
  });

  it('says one or many new cards, and nothing when there are none', () => {
    expect(compactNewLabel(0)).toBe('');
    expect(compactNewLabel(1)).toBe('1 nouvelle');
    expect(compactNewLabel(5)).toBe('5 nouvelles');
  });

  it('joins the counts with a middle dot, dropping the empty side', () => {
    expect(compactCountLabel(8, 5)).toBe('8 à revoir · 5 nouvelles');
    expect(compactCountLabel(0, 5)).toBe('5 nouvelles');
    expect(compactCountLabel(8, 0)).toBe('8 à revoir');
    expect(compactCountLabel(0, 0)).toBe('');
  });
});
