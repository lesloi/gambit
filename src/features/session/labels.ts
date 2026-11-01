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
