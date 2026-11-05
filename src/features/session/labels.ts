import { fr } from '../../i18n/fr';

/** The counts the home and the session header show, in French with a singular where it fits. */
export function dueCountLabel(count: number): string {
  if (count <= 0) return fr.session.dueNone;
  if (count === 1) return fr.session.dueOne;
  return fr.session.dueMany.replace('{count}', String(count));
}

export function newCountLabel(count: number): string {
  if (count <= 0) return fr.session.newNone;
  if (count === 1) return fr.session.newOne;
  return fr.session.newMany.replace('{count}', String(count));
}

/** The home's shorter count: the card is narrow, and the nouns are already in the context. */
export function compactDueLabel(count: number): string {
  if (count <= 0) return '';
  if (count === 1) return fr.session.dueShortOne;
  return fr.session.dueShortMany.replace('{count}', String(count));
}

export function compactNewLabel(count: number): string {
  if (count <= 0) return '';
  if (count === 1) return fr.session.newShortOne;
  return fr.session.newShortMany.replace('{count}', String(count));
}

export function compactCountLabel(due: number, fresh: number): string {
  return [compactDueLabel(due), compactNewLabel(fresh)].filter((part) => part !== '').join(' · ');
}
