import type { EngineLine } from '../../engine/uci';
import { fr } from '../../i18n/fr';
import type { Side } from '../../lib/position';
import { formatScore, pvToSan } from './engineLines';

/** The two engine lines for the shown position, with the first one in standard notation. */
export function EngineLines({
  fen,
  lines,
  sideToMove,
  userColor,
  only,
  onPreview,
}: {
  fen: string;
  lines: readonly EngineLine[];
  sideToMove: Side;
  userColor: Side;
  only: boolean;
  onPreview: (line: EngineLine) => void;
}) {
  return (
    <section className="border-line bg-paper-raised rounded-sm border p-2.5">
      <h3 className="text-xs font-semibold">{fr.play.analysis.engineLines}</h3>

      {lines.length === 0 ? (
        <p className="text-ink-muted mt-1 text-xs">{fr.play.analysis.noLines}</p>
      ) : (
        <ol className="mt-1.5 grid gap-1.5">
          {lines.map((line, index) => {
            const san = pvToSan(fen, line.pv, 7);
            return (
              <li
                key={line.multipv}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs"
              >
                <span className="text-ink-muted w-3 shrink-0 tabular-nums">{index + 1}.</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatScore(line.score, sideToMove, userColor)}
                </span>
                {index === 0 && only ? (
                  <span className="bg-ok-soft text-ok shrink-0 rounded-xs px-1.5 py-0.5 text-[0.625rem] font-semibold">
                    {fr.play.analysis.narrowlyBest}
                  </span>
                ) : null}
                <span className="text-ink-muted min-w-0 flex-1 break-words">
                  {san.join(' ') || '—'}
                </span>
                <button
                  type="button"
                  onClick={() => onPreview(line)}
                  disabled={line.pv.length === 0}
                  className="border-line text-ink min-h-11 shrink-0 rounded-xs border px-2 text-[0.625rem] font-semibold disabled:opacity-50"
                >
                  {fr.play.analysis.previewLine}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
