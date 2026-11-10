import type { MouseEvent } from 'react';
import { fr } from '../../i18n/fr';
import type { EvalPoint, MoveClass, MoveReview } from './review';

const WIDTH = 320;
const HEIGHT = 112;
const PAD_X = 8;
const PAD_Y = 8;

const MARKED: readonly MoveClass[] = ['inaccuracy', 'mistake', 'blunder', 'missed-win'];

function markerColor(kind: MoveClass): string {
  if (kind === 'best') return 'var(--ok)';
  if (kind === 'missed-win') return 'var(--accent)';
  if (kind === 'inaccuracy') return 'var(--ink-muted)';
  return 'var(--bad)';
}

/**
 * The winning chance across the game, the user above the middle. The line is the story; the dots
 * are the moves worth stopping at. The graph is a pointer shortcut, never the only way in: the key
 * moments and the score sheet are the keyboard path.
 */
export function EvaluationGraph({
  points,
  moves,
  selectedPly,
  onSelect,
}: {
  points: readonly EvalPoint[];
  moves: readonly MoveReview[];
  selectedPly: number;
  onSelect: (ply: number) => void;
}) {
  if (points.length < 2) return null;

  const maxPly = points.length - 1;
  const x = (ply: number) => PAD_X + (ply / maxPly) * (WIDTH - PAD_X * 2);
  const y = (win: number) => PAD_Y + ((100 - win) / 100) * (HEIGHT - PAD_Y * 2);

  const segments: string[] = [];
  let current: string[] = [];
  for (const point of points) {
    if (point.userWin === null) {
      if (current.length > 0) segments.push(current.join(' '));
      current = [];
      continue;
    }
    current.push(`${x(point.ply)},${y(point.userWin)}`);
  }
  if (current.length > 0) segments.push(current.join(' '));

  const markers = moves.filter(
    (move) => !move.book && MARKED.includes(move.class) && points[move.ply]?.userWin != null,
  );

  const selectAt = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const ply = Math.round(ratio * maxPly);
    onSelect(Math.max(0, Math.min(maxPly, ply)));
  };

  return (
    <figure className="mt-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-28 w-full cursor-pointer"
        aria-hidden="true"
        onClick={selectAt}
      >
        <rect x={0} y={0} width={WIDTH} height={HEIGHT / 2} fill="var(--accent-soft)" />
        <rect x={0} y={HEIGHT / 2} width={WIDTH} height={HEIGHT / 2} fill="var(--bad-soft)" />
        <line
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={y(50)}
          y2={y(50)}
          stroke="var(--line)"
          strokeDasharray="3 3"
        />
        {segments.map((segment, index) => (
          <polyline
            key={index}
            points={segment}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {markers.map((move) => (
          <circle
            key={move.ply}
            cx={x(move.ply)}
            cy={y(points[move.ply]!.userWin!)}
            r={2.5}
            fill={markerColor(move.class)}
          />
        ))}
        <line
          x1={x(Math.min(Math.max(selectedPly, 0), maxPly))}
          x2={x(Math.min(Math.max(selectedPly, 0), maxPly))}
          y1={PAD_Y}
          y2={HEIGHT - PAD_Y}
          stroke="var(--accent)"
          strokeWidth={1}
          opacity={0.7}
        />
      </svg>
      <figcaption className="text-ink-muted mt-1 text-[0.6875rem] leading-relaxed">
        {fr.play.analysis.evaluationCaption}
      </figcaption>
    </figure>
  );
}
