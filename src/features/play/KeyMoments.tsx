import { fr } from '../../i18n/fr';
import { moveLabel } from './notation';
import type { MoveReview } from './review';
import { CLASS_LABEL, CLASS_TONE } from './reviewLabels';

function winLabel(move: MoveReview): string {
  if (move.winBefore === null || move.winAfter === null) return '—';
  return `${Math.round(move.winBefore)} % → ${Math.round(move.winAfter)} %`;
}

/** The moves that turned the game, in order, with the position one tap away. */
export function KeyMoments({
  moments,
  onSelect,
}: {
  moments: readonly MoveReview[];
  onSelect: (ply: number) => void;
}) {
  return (
    <section className="mt-3">
      <h2 className="text-sm font-semibold">{fr.play.analysis.keyMoments}</h2>
      <p className="text-ink-muted mt-0.5 text-xs">{fr.play.analysis.keyMomentsIntro}</p>

      {moments.length === 0 ? (
        <p className="text-ink-muted mt-2 text-xs">{fr.play.analysis.noMoments}</p>
      ) : (
        <ul className="mt-1.5">
          {moments.map((move) => {
            const label = moveLabel({
              number: move.moveNumber,
              side: move.side,
              san: move.san,
              ply: move.ply,
            });
            return (
              <li key={move.ply} className="border-line-soft border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(move.ply)}
                  className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2 text-left"
                >
                  <span className="text-sm font-medium tabular-nums">{label}</span>
                  <span
                    className={`rounded-xs px-1.5 py-0.5 text-[0.625rem] ${CLASS_TONE[move.class]}`}
                  >
                    {CLASS_LABEL[move.class]}
                  </span>
                  <span className="text-ink-muted text-xs tabular-nums">{winLabel(move)}</span>
                  {move.bestSan !== null && move.bestUci !== move.uci ? (
                    <span className="text-ink-muted w-full text-xs">
                      {fr.play.analysis.best.replace('{move}', move.bestSan)}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
