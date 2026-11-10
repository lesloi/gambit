import { fr } from '../../i18n/fr';
import { START_FEN, type Side } from '../../lib/position';
import type { GameReport } from './review';
import type { OpeningReport } from './openingMatch';
import { CLASS_COUNT_TONE, CLASS_LABEL, CLASS_ORDER } from './reviewLabels';

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} %`;
}

function openingDetail(opening: OpeningReport, userColor: Side): string {
  const deviation = opening.deviation;
  if (deviation) {
    const detail =
      deviation.side === userColor
        ? fr.play.analysis.openingDeviation
        : fr.play.analysis.openingOpponentDeviation;
    return detail
      .replace('{ply}', String(deviation.ply))
      .replace('{played}', deviation.playedSan)
      .replace('{expected}', deviation.expectedSan);
  }

  if (opening.followed >= opening.line.moves.length) {
    return fr.play.analysis.openingLineEnded;
  }
  return fr.play.analysis.openingFollowed.replace('{ply}', String(opening.followed));
}

function AccuracyCard({
  label,
  accuracy,
  highlight = false,
}: {
  label: string;
  accuracy: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border p-2.5 ${
        highlight ? 'border-accent bg-accent-soft' : 'border-line-soft'
      }`}
    >
      <p className="text-ink-muted text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
        {label} · {fr.play.analysis.accuracy}
      </p>
      <p className="text-2xl font-semibold tabular-nums">{percent(accuracy)}</p>
    </div>
  );
}

/**
 * The shape of the game before the board: how accurately each side played, how the phases went,
 * and whether the game stayed in the repertoire.
 */
export function ReviewSummary({
  report,
  performance,
}: {
  report: GameReport;
  performance: number | null;
}) {
  return (
    <section className="border-line bg-paper-raised mt-3 rounded-sm border p-3">
      <h2 className="text-sm font-semibold">{fr.play.analysis.reviewTitle}</h2>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <AccuracyCard label={fr.play.analysis.you} accuracy={report.user.accuracy} highlight />
        <AccuracyCard label={fr.play.analysis.opponent} accuracy={report.opponent.accuracy} />
      </div>

      {performance !== null ? (
        <p className="text-ink-muted mt-2 text-xs">
          {fr.play.analysis.performance.replace('{elo}', String(performance))}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {CLASS_ORDER.map((kind) => (
          <div key={kind} className="border-line-soft rounded-xs border px-2 py-1.5">
            <p className="text-ink-muted text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
              {CLASS_LABEL[kind]}
            </p>
            <p className={`text-sm font-semibold tabular-nums ${CLASS_COUNT_TONE[kind]}`}>
              {report.user.counts[kind]}
            </p>
          </div>
        ))}
      </div>

      {report.user.bookMoves > 0 ? (
        <p className="text-ink-muted mt-2 text-xs">
          {fr.play.analysis.bookMoves.replace('{count}', String(report.user.bookMoves))}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(['opening', 'middlegame', 'endgame'] as const)
          .filter((phase) => phase !== 'opening' || report.startFen === START_FEN)
          .map((phase) => (
            <div key={phase} className="border-line-soft rounded-xs border px-2 py-1.5">
              <p className="text-ink-muted text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
                {fr.play.analysis.phases[phase]}
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {percent(report.user.phases[phase].accuracy)}
              </p>
            </div>
          ))}
      </div>

      {report.startFen === START_FEN && report.opening !== null ? (
        <div className="border-line-soft mt-3 rounded-xs border p-2.5">
          <p className="text-ink-muted text-[0.625rem] font-semibold tracking-[0.08em] uppercase">
            {fr.play.analysis.openingTitle}
          </p>
          <p className="mt-1 text-sm font-medium">{report.opening.line.name}</p>
          <p className="text-ink-muted mt-0.5 text-xs">
            {openingDetail(report.opening, report.userColor)}
          </p>
          <details className="mt-1.5">
            <summary className="text-ink-muted cursor-pointer text-xs">
              {fr.play.analysis.openingNote}
            </summary>
            <p className="text-ink-muted mt-1 text-xs leading-relaxed">
              {report.opening.line.note}
            </p>
          </details>
        </div>
      ) : null}
    </section>
  );
}
