import { fr } from '../../i18n/fr';
import { LENGTH_FILTERS, RATING_BANDS, type PuzzleFilters } from './content';

const CHIP =
  'border-line text-ink-muted inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-ink has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2';

const LEGEND = 'text-accent text-[11px] tracking-[0.18em] uppercase';

export interface PuzzleSetupProps {
  filters: PuzzleFilters;
  status: 'loading' | 'ready' | 'failed';
  /** How many puzzles the current choices leave. */
  matches: number;
  onChange: (filters: PuzzleFilters) => void;
  onStart: () => void;
  onRetry: () => void;
  onReviewMistakes: () => void;
}

/** The step between the mode and the board: what the picks cost, before the first puzzle. */
export function PuzzleSetup({
  filters,
  status,
  matches,
  onChange,
  onStart,
  onRetry,
  onReviewMistakes,
}: PuzzleSetupProps) {
  const ready = status === 'ready';
  const empty = ready && matches === 0;

  return (
    <div>
      <p className="text-ink-muted text-sm">{fr.puzzle.setup.intro}</p>

      <fieldset className="mt-6">
        <legend className={LEGEND}>{fr.puzzle.setup.length}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LENGTH_FILTERS.map((length) => (
            <label key={length} className={CHIP}>
              <input
                type="radio"
                name="puzzle-length"
                value={length}
                checked={filters.length === length}
                onChange={() => onChange({ ...filters, length })}
                className="sr-only"
              />
              {fr.puzzle.setup.lengths[length]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className={LEGEND}>{fr.puzzle.setup.difficulty}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className={CHIP}>
            <input
              type="radio"
              name="puzzle-rating"
              value="any"
              checked={filters.rating === 'any'}
              onChange={() => onChange({ ...filters, rating: 'any' })}
              className="sr-only"
            />
            {fr.puzzle.setup.ratings.any}
          </label>
          {RATING_BANDS.map((band) => (
            <label key={band} className={CHIP}>
              <input
                type="radio"
                name="puzzle-rating"
                value={band}
                checked={filters.rating === band}
                onChange={() => onChange({ ...filters, rating: band })}
                className="sr-only"
              />
              {fr.puzzle.setup.ratings[band]}
            </label>
          ))}
        </div>
      </fieldset>

      {status === 'failed' ? (
        <div
          role="alert"
          className="border-line bg-paper-raised mt-6 rounded-2xl border p-4 text-center"
        >
          <p className="text-sm">{fr.puzzle.loadFailed}</p>
          <button
            type="button"
            onClick={onRetry}
            className="bg-accent mt-3 rounded-xl px-4 py-3 text-sm font-semibold text-white"
          >
            {fr.puzzle.reload}
          </button>
        </div>
      ) : (
        <div className="mt-6">
          {/* The live region exists from the start: a screen reader announces the text it gains. */}
          <p role="status" className="text-ink-muted text-center text-sm">
            {status === 'loading' ? fr.puzzle.loading : empty ? fr.puzzle.setup.noMatch : ''}
          </p>
          <button
            type="button"
            onClick={onStart}
            disabled={!ready || empty}
            className="bg-accent mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {fr.puzzle.setup.start}
          </button>
        </div>
      )}

      {/* Replaying a miss is a deliberate act, not another way to start a session: a quiet link. */}
      <button
        type="button"
        onClick={onReviewMistakes}
        className="decoration-line text-ink-muted hover:text-ink mt-4 min-h-11 w-full text-sm underline underline-offset-2"
      >
        {fr.progress.review}
      </button>
    </div>
  );
}
