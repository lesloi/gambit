import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { fr } from '../../i18n/fr';
import { moveLabel, type MovePair, type SheetMove } from './notation';

export type MoveMark = 'blunder' | 'missed-win';

const MARK_LABEL: Record<MoveMark, string> = {
  blunder: fr.play.analysis.blunder,
  'missed-win': fr.play.analysis.missedWin,
};

const MARK_DOT: Record<MoveMark, string> = {
  blunder: 'bg-bad',
  'missed-win': 'bg-accent',
};

const NO_MARKS: ReadonlyMap<number, MoveMark> = new Map();

/** The last position the sheet can show: the move count, the start being zero. */
function lastPly(rows: readonly MovePair[]): number {
  const last = rows[rows.length - 1];
  if (!last) return 0;
  return last.black?.ply ?? last.white.ply;
}

/**
 * The game as a two-column score sheet. A move reopens the position after it, and the current row
 * is kept inside the sheet's own scroll box, never the page.
 */
export function MoveSheet({
  rows,
  currentPly,
  marks = NO_MARKS,
  title = fr.play.sheet,
  follow = true,
  listRef,
  listClassName = 'max-h-40 md:max-h-[40vh]',
  onSelect,
  onStep,
}: {
  rows: readonly MovePair[];
  currentPly: number;
  /** Findings shown as a dot beside their move. */
  marks?: ReadonlyMap<number, MoveMark>;
  title?: string;
  /** Follows the current move while the user steps through the game. */
  follow?: boolean;
  /** Lets the caller scroll the sheet itself, as the live game does on its way back. */
  listRef?: RefObject<HTMLOListElement | null>;
  listClassName?: string;
  onSelect: (ply: number) => void;
  onStep: (delta: number) => void;
}) {
  const ownList = useRef<HTMLOListElement>(null);
  const list = listRef ?? ownList;
  const end = lastPly(rows);

  useEffect(() => {
    if (!follow) return;
    const box = list.current;
    const cell = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!box || !cell) return;

    const boxRect = box.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    if (cellRect.top < boxRect.top) box.scrollTop += cellRect.top - boxRect.top;
    else if (cellRect.bottom > boxRect.bottom) box.scrollTop += cellRect.bottom - boxRect.bottom;
  }, [follow, currentPly, list]);

  return (
    <div className="border-line bg-paper-raised rounded-sm border">
      <h2 className="border-line text-ink-muted border-b px-2.5 py-1.5 text-[0.625rem] font-semibold tracking-[0.12em] uppercase">
        {title}
      </h2>
      <ol ref={list} className={`overflow-y-auto py-1 text-xs ${listClassName}`}>
        {rows.map((pair) => (
          <li
            key={pair.number}
            className="grid grid-cols-[20px_1fr_1fr] items-center gap-1 px-1.5 tabular-nums"
          >
            <span className="text-ink-muted px-1 opacity-70">{pair.number}.</span>
            <SheetMoveButton
              move={pair.white}
              mark={marks.get(pair.white.ply)}
              current={pair.white.ply === currentPly}
              onSelect={onSelect}
            />
            {pair.black ? (
              <SheetMoveButton
                move={pair.black}
                mark={marks.get(pair.black.ply)}
                current={pair.black.ply === currentPly}
                onSelect={onSelect}
              />
            ) : (
              <span />
            )}
          </li>
        ))}
      </ol>
      <div className="border-line grid grid-cols-2 gap-1 border-t p-1.5">
        <button
          type="button"
          onClick={() => onStep(-1)}
          disabled={currentPly <= 0}
          className="border-line text-ink flex min-h-9 items-center justify-center gap-1 rounded-xs border px-1 text-[0.6875rem] font-semibold disabled:opacity-50"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {fr.play.review.previous}
        </button>
        <button
          type="button"
          onClick={() => onStep(1)}
          disabled={currentPly >= end}
          className="border-line text-ink flex min-h-9 items-center justify-center gap-1 rounded-xs border px-1 text-[0.6875rem] font-semibold disabled:opacity-50"
        >
          {fr.play.review.next}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Skeleton bars, cycled over the rows so the placeholder keeps the sheet's ragged look. */
const SKELETON_WIDTHS = ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5', 'w-2/3', 'w-1/4'];

/**
 * The score sheet's place while the game is being analysed. It keeps the layout from jumping and
 * gives the rows nothing to pick: the moves only become selectable once the findings are known.
 */
export function MoveSheetSkeleton({
  rowCount,
  listClassName = 'max-h-40 md:max-h-[40vh]',
}: {
  rowCount: number;
  listClassName?: string;
}) {
  return (
    <div className="border-line bg-paper-raised rounded-sm border" aria-hidden="true">
      <h2 className="border-line text-ink-muted border-b px-2.5 py-1.5 text-[0.625rem] font-semibold tracking-[0.12em] uppercase">
        {fr.play.sheet}
      </h2>
      <div className={`overflow-hidden py-1 ${listClassName}`}>
        {Array.from({ length: rowCount }, (_, index) => (
          <div
            key={index}
            className="grid min-h-8 grid-cols-[20px_1fr_1fr] items-center gap-1 px-1.5"
          >
            <span className="text-ink-muted px-1 text-xs tabular-nums opacity-70">
              {index + 1}.
            </span>
            <span
              className={`bg-line mx-1.5 h-2 animate-pulse rounded-xs motion-reduce:animate-none ${
                SKELETON_WIDTHS[(index * 2) % SKELETON_WIDTHS.length]
              }`}
            />
            <span
              className={`bg-line mx-1.5 h-2 animate-pulse rounded-xs motion-reduce:animate-none ${
                SKELETON_WIDTHS[(index * 2 + 1) % SKELETON_WIDTHS.length]
              }`}
            />
          </div>
        ))}
      </div>
      <div className="border-line grid grid-cols-2 gap-1 border-t p-1.5">
        <span className="border-line text-ink-muted flex min-h-9 items-center justify-center rounded-xs border px-1 text-[0.6875rem] font-semibold opacity-50">
          {fr.play.review.previous}
        </span>
        <span className="border-line text-ink-muted flex min-h-9 items-center justify-center rounded-xs border px-1 text-[0.6875rem] font-semibold opacity-50">
          {fr.play.review.next}
        </span>
      </div>
    </div>
  );
}

/**
 * A move in the score sheet. A 32px row stays above the 24px target minimum of WCAG 2.2 while a
 * forty-move game keeps a compact sheet; the whole cell is the button.
 */
function SheetMoveButton({
  move,
  mark,
  current,
  onSelect,
}: {
  move: SheetMove;
  mark?: MoveMark;
  current: boolean;
  onSelect: (ply: number) => void;
}) {
  return (
    <button
      type="button"
      aria-current={current ? 'true' : undefined}
      aria-label={mark ? `${moveLabel(move)}, ${MARK_LABEL[mark]}` : moveLabel(move)}
      onClick={() => onSelect(move.ply)}
      className={`flex min-h-8 items-center gap-1.5 rounded-xs px-1.5 text-left tabular-nums transition-colors ${
        current ? 'bg-accent-soft text-ink font-semibold' : 'hover:bg-paper'
      }`}
    >
      {mark ? (
        <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${MARK_DOT[mark]}`} />
      ) : null}
      {move.san}
    </button>
  );
}
