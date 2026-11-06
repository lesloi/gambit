import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Rating } from 'ts-fsrs';
import { cardId } from '../../db/cards';
import { database } from '../../db/db';
import type { CardState } from '../../db/fsrs';
import { cardStates, leavingRating } from '../../db/journal';
import { fr } from '../../i18n/fr';
import { legalDests, promotionPieces, sideToMove, type PromotionPiece } from '../../lib/chess';
import { AgainButton } from '../../ui/AgainButton';
import { ChessBoard } from '../../ui/ChessBoard';
import { PromotionDialog, promotionAnchor } from '../../ui/PromotionDialog';
import { loadOpenings } from './content';
import {
  playOpeningMove,
  restartOpening,
  rewindOpening,
  startOpening,
  type LineColor,
  type OpeningLine,
} from './opening';
import { missedOpeningRating, recordOpeningReview } from './record';

type LineStatus = { kind: 'new' } | { kind: 'due' } | { kind: 'scheduled'; due: number };

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

interface PendingPromotion {
  from: string;
  to: string;
  options: PromotionPiece[];
}

/** The line's state comes from the journal: new, due, or waiting for its next review. */
function lineStatus(state: CardState | null, now: number): LineStatus {
  if (!state) return { kind: 'new' };
  if (state.due <= now) return { kind: 'due' };
  return { kind: 'scheduled', due: state.due };
}

/** A new line has no badge: the list is already the repertoire to learn, not a queue of news. */
function statusLabel(status: LineStatus): string | null {
  switch (status.kind) {
    case 'new':
      return null;
    case 'due':
      return fr.opening.status.due;
    case 'scheduled':
      return fr.opening.status.scheduled.replace('{date}', DATE.format(status.due));
  }
}

export function OpeningScreen({ onExit }: { onExit: () => void }) {
  const lines = useMemo(() => loadOpenings(), []);
  const [selected, setSelected] = useState<OpeningLine | null>(null);
  const [states, setStates] = useState<ReadonlyMap<string, CardState>>(new Map());
  const [now, setNow] = useState(() => Date.now());

  // The list reads the journal; a review is appended in the player, which asks for a refresh.
  useEffect(() => {
    let active = true;
    cardStates(database).then(
      (next) => {
        if (!active) return;
        setStates(next);
        setNow(Date.now());
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [selected]);

  const refreshStates = () => {
    void cardStates(database).then(
      (next) => {
        setStates(next);
        setNow(Date.now());
      },
      () => undefined,
    );
  };

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-4 pb-6 sm:px-6">
        <header className="flex items-center gap-1">
          <button
            type="button"
            onClick={selected ? () => setSelected(null) : onExit}
            aria-label={fr.opening.back}
            className="text-ink-muted hover:text-ink -ml-2 grid size-11 place-items-center rounded-full"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-lg">{fr.opening.title}</h1>
          {selected ? (
            <span className="border-line text-ink-muted ml-auto rounded-full border px-2.5 py-1 text-xs">
              {selected.color === 'white' ? fr.opening.white : fr.opening.black}
            </span>
          ) : null}
        </header>

        <div className="mt-4 flex-1">
          {selected ? (
            <OpeningPlayer
              key={selected.id}
              line={selected}
              onReviewed={refreshStates}
              onOther={() => setSelected(null)}
            />
          ) : (
            <OpeningList lines={lines} states={states} now={now} onPlay={setSelected} />
          )}
        </div>
      </div>
    </div>
  );
}

function OpeningList({
  lines,
  states,
  now,
  onPlay,
}: {
  lines: readonly OpeningLine[];
  states: ReadonlyMap<string, CardState>;
  now: number;
  onPlay: (line: OpeningLine) => void;
}) {
  if (lines.length === 0) {
    return <p className="text-ink-muted text-sm">{fr.opening.empty}</p>;
  }

  const groups: readonly { color: LineColor; heading: string }[] = [
    { color: 'white', heading: fr.opening.white },
    { color: 'black', heading: fr.opening.black },
  ];

  return (
    <>
      <p className="text-ink-muted text-sm">{fr.opening.intro}</p>

      <div className="mt-4 grid gap-4">
        {groups.map(({ color, heading }) => {
          const group = lines.filter((line) => line.color === color);
          if (group.length === 0) return null;
          const count = (group.length === 1 ? fr.opening.lineOne : fr.opening.lineMany).replace(
            '{count}',
            String(group.length),
          );

          return (
            <section key={color} aria-labelledby={`opening-${color}`}>
              <div className="border-line bg-paper-raised overflow-hidden rounded-sm border">
                <div className="border-line flex items-baseline justify-between border-b px-3.5 py-3">
                  <h2
                    id={`opening-${color}`}
                    className="text-ink-muted text-[0.6875rem] font-semibold tracking-[0.12em] uppercase"
                  >
                    {heading}
                  </h2>
                  <span className="text-ink-muted text-[0.6875rem]">{count}</span>
                </div>

                <ul>
                  {group.map((line) => {
                    const status = lineStatus(states.get(cardId('opening', line.id)) ?? null, now);
                    const statusText = statusLabel(status);
                    return (
                      <li key={line.id} className="border-line-soft border-b last:border-b-0">
                        <button
                          type="button"
                          onClick={() => onPlay(line)}
                          className="flex min-h-12 w-full items-center gap-3 px-3.5 text-left"
                        >
                          <span className="min-w-0 flex-1 text-sm font-semibold">{line.name}</span>
                          {statusText !== null ? (
                            <span
                              className={`shrink-0 whitespace-nowrap ${
                                status.kind === 'due'
                                  ? 'text-accent-ink text-[0.625rem] font-semibold'
                                  : 'text-ink-muted text-[0.6875rem]'
                              }`}
                            >
                              {statusText}
                            </span>
                          ) : null}
                          <ChevronRight
                            size={16}
                            className="text-ink-muted shrink-0 opacity-60"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export function OpeningPlayer({
  line,
  onReviewed,
  onOther,
  nextLabel = fr.opening.other,
}: {
  line: OpeningLine;
  onReviewed: () => void;
  onOther: () => void;
  nextLabel?: string;
}) {
  const [state, setState] = useState(() => startOpening(line));
  const [again, setAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const boardHost = useRef<HTMLDivElement>(null);
  const recorded = useRef(false);

  const turn = sideToMove(state.fen);
  const movable = state.outcome === 'playing' && turn === state.userColor;
  const dests = useMemo(
    () => (movable ? legalDests(state.fen) : new Map<string, string[]>()),
    [movable, state.fen],
  );

  const restart = () => {
    setState(restartOpening(state));
    setAgain(false);
    setBusy(false);
    setPending(null);
    recorded.current = false;
    setResetKey((key) => key + 1);
    boardHost.current?.focus();
  };

  // The miss's review is already written; the rewind reopens the board, not the attempt.
  const rewind = () => {
    const next = rewindOpening(state);
    if (next === state) return;
    setState(next);
    setPending(null);
    boardHost.current?.focus();
  };

  const applyMove = (from: string, to: string, promotion?: PromotionPiece) => {
    const next = playOpeningMove(state, from, to, promotion);
    if (next === state) return;
    setState(next);

    const missed = missedOpeningRating(state.outcome, next.outcome);
    if (missed !== null && !recorded.current) {
      recorded.current = true;
      void recordOpeningReview(line.id, missed).then(onReviewed, () => undefined);
    }
  };

  const move = (from: string, to: string) => {
    const options = promotionPieces(state.fen, from, to);
    if (options.length > 0) {
      setPending({ from, to, options });
      return;
    }
    applyMove(from, to);
  };

  const promote = (piece: PromotionPiece) => {
    if (!pending) return;
    const { from, to } = pending;
    setPending(null);
    applyMove(from, to, piece);
  };

  // The pawn waits on the promotion square while the chooser is open; a cancel has to put it back.
  const cancelPromotion = () => {
    setPending(null);
    setResetKey((key) => key + 1);
    boardHost.current?.focus();
  };

  // The "again" review is appended once and never edited, and the list is refreshed afterwards so
  // its due date is the one just written. A write that fails is not surfaced: the button stays.
  const rateAgain = async () => {
    if (recorded.current || busy) return;
    recorded.current = true;
    setBusy(true);
    try {
      await recordOpeningReview(line.id, Rating.Again);
      setAgain(true);
      onReviewed();
    } catch {
      recorded.current = false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * A solved line is written `good` when the user leaves it, after the list may have read the
   * journal. The button waits for the write so a second tap cannot skip a line, and a failed write
   * keeps the screen open rather than dropping the attempt.
   */
  const leave = async () => {
    if (busy) return;
    setBusy(true);

    const grade = leavingRating(state.outcome, recorded.current);
    if (grade !== null) {
      recorded.current = true;
      try {
        await recordOpeningReview(line.id, grade);
      } catch {
        recorded.current = false;
        setBusy(false);
        return;
      }
      onReviewed();
    }

    setBusy(false);
    onOther();
  };

  return (
    <>
      <div className="mb-3">
        <h2 className="text-lg">{line.name}</h2>
        <p className="text-ink-muted mt-1 text-sm">{line.note}</p>
      </div>

      <div className="border-line bg-paper-raised rounded-sm border p-2.5 sm:p-3">
        <div ref={boardHost} tabIndex={-1} aria-label={fr.opening.board} className="rounded-sm">
          <ChessBoard
            fen={state.fen}
            orientation={state.userColor}
            turn={turn}
            lastMove={state.lastMove}
            movable={movable}
            dests={dests}
            onMove={move}
            resetKey={resetKey}
          />
        </div>
      </div>

      <div className="mt-4 flex min-h-11 items-center justify-between gap-3">
        <p className="text-sm font-medium" role="status">
          {state.outcome === 'playing' ? fr.opening.yourMove : ''}
        </p>
        {state.outcome === 'playing' ? (
          <button
            type="button"
            onClick={restart}
            className="text-ink-muted hover:text-ink min-h-11 shrink-0 rounded-sm px-3 text-xs"
          >
            {fr.opening.restart}
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        {state.outcome === 'solved' ? (
          state.corrected ? (
            <>
              <div role="status" className="border-line bg-paper-raised rounded-sm border p-4">
                <p className="text-sm font-semibold">{fr.opening.corrected}</p>
                <p className="mt-1 text-xs opacity-80">{fr.opening.correctedNote}</p>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={restart}
                  className="border-line text-ink-muted flex-1 rounded-sm border px-4 py-3 text-sm"
                >
                  {fr.opening.retry}
                </button>
                <button
                  type="button"
                  onClick={() => void leave()}
                  className="bg-accent flex-1 rounded-sm px-4 py-3 text-sm font-semibold text-white"
                >
                  {nextLabel}
                </button>
              </div>
            </>
          ) : (
            <>
              <div role="status" className="bg-ok-soft text-ok rounded-sm px-3 py-2">
                <p className="text-sm font-semibold">{fr.opening.solved}</p>
              </div>

              <div className="mt-4 grid grid-cols-5 gap-2">
                <div className="col-span-2">
                  <AgainButton recorded={again} disabled={busy} onPress={() => void rateAgain()} />
                </div>
                <button
                  type="button"
                  onClick={() => void leave()}
                  disabled={busy}
                  className="bg-accent col-span-3 rounded-sm px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {nextLabel}
                </button>
              </div>
            </>
          )
        ) : null}

        {state.outcome === 'failed' ? (
          <>
            <div role="status" className="bg-bad-soft text-bad rounded-sm p-4">
              <p className="text-sm font-semibold">{fr.opening.failed}</p>
              <p className="mt-1 text-xs opacity-80">
                {fr.opening.expectedMove.replace('{move}', state.expectedSan ?? '')}
              </p>
            </div>

            <button
              type="button"
              onClick={rewind}
              className="bg-accent mt-3 w-full rounded-sm px-4 py-3 text-sm font-semibold text-white"
            >
              {fr.opening.rewind}
            </button>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={restart}
                className="border-line text-ink-muted flex-1 rounded-sm border px-4 py-3 text-sm"
              >
                {fr.opening.retry}
              </button>
              <button
                type="button"
                onClick={() => void leave()}
                className="border-line text-ink-muted flex-1 rounded-sm border px-4 py-3 text-sm"
              >
                {nextLabel}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {pending ? (
        <PromotionDialog
          color={turn}
          options={pending.options}
          measure={() => promotionAnchor(boardHost.current, pending.to, state.userColor)}
          onChoose={promote}
          onCancel={cancelPromotion}
        />
      ) : null}
    </>
  );
}
