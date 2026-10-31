import { Rating as FsrsRating, type Grade } from 'ts-fsrs';
import { fr } from '../i18n/fr';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

const RATINGS: readonly Rating[] = ['again', 'hard', 'good', 'easy'];

export const GRADE: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

const RATING_OPACITY: Record<Rating, string> = {
  again: 'bg-accent/40',
  hard: 'bg-accent/60',
  good: 'bg-accent/80',
  easy: 'bg-accent',
};

/**
 * The user's own rating after a solve. It is not offered after a miss: that attempt is already
 * rated `again` by the journal, and asking would invite rewriting the record.
 */
export function RatingButtons({
  rating,
  onRate,
}: {
  rating: Rating | null;
  onRate: (rating: Rating) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {RATINGS.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={rating === value}
          disabled={rating !== null}
          onClick={() => onRate(value)}
          className={`min-h-11 rounded-lg border px-1 py-2 text-[11px] transition-colors ${
            rating === value ? 'border-ok text-ink font-semibold' : 'border-line text-ink-muted'
          }`}
        >
          <span className={`mb-1.5 block h-0.5 rounded-full ${RATING_OPACITY[value]}`} />
          {fr.rating[value]}
        </button>
      ))}
    </div>
  );
}
