import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cardId } from '../../db/cards';
import { database } from '../../db/db';
import type { CardState } from '../../db/fsrs';
import { cardStates } from '../../db/journal';
import { fr } from '../../i18n/fr';
import { legalDests, promotionPieces, sideToMove, type PromotionPiece } from '../../lib/chess';
import { ChessBoard } from '../../ui/ChessBoard';
import { PromotionDialog, promotionAnchor } from '../../ui/PromotionDialog';
import { GRADE, RatingButtons, type Rating } from '../../ui/RatingButtons';
import { loadOpenings } from './content';
import {
  playOpeningMove,
  restartOpening,
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

function statusLabel(status: LineStatus): string {
  switch (status.kind) {
    case 'new':
      return fr.opening.status.new;
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
          <h1 className="font-serif text-lg">{fr.opening.title}</h1>
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

  const groups: readonly { color: LineColor; label: string }[] = [
    { color: 'white', label: fr.opening.white },
    { color: 'black', label: fr.opening.black },
  ];

  return (
    <>
      <p className="text-ink-muted text-sm">{fr.opening.intro}</p>

      {groups.map(({ color, label }) => {
        const group = lines.filter((line) => line.color === color);
        if (group.length === 0) return null;

        return (
          <section key={color} aria-labelledby={`opening-${color}`} className="mt-6">
            <h2 id={`opening-${color}`} className="font-serif text-lg">
              {label}
            </h2>

            <ul className="mt-3 grid gap-3">
              {group.map((line) => {
                const status = lineStatus(states.get(cardId('opening', line.id)) ?? null, now);
                return (
                  <li key={line.id} className="border-line bg-paper-raised rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold">{line.name}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] tracking-wider uppercase ${
                          status.kind === 'due'
                            ? 'bg-accent-soft text-accent'
                            : 'border-line text-ink-muted border'
                        }`}
                      >
                        {statusLabel(status)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onPlay(line)}
                      className="bg-accent mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                    >
                      {fr.opening.review}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
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
  const [rating, setRating] = useState<Rating | null>(null);
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
    setRating(null);
    setPending(null);
    recorded.current = false;
    setResetKey((key) => key + 1);
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

  const rate = async (value: Rating) => {
    if (rating) return;
    setRating(value);
    try {
      await recordOpeningReview(line.id, GRADE[value]);
      recorded.current = true;
      onReviewed();
    } catch {
      setRating(null);
    }
  };

  return (
    <>
      <div className="mb-3">
        <h2 className="font-serif text-lg">{line.name}</h2>
      </div>

      <div className="border-line bg-paper-raised rounded-2xl border p-2.5 sm:p-3">
        <div ref={boardHost} tabIndex={-1} aria-label={fr.opening.board} className="rounded-xl">
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
            className="text-ink-muted hover:text-ink min-h-11 shrink-0 rounded-full px-3 text-xs"
          >
            {fr.opening.restart}
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        {state.outcome === 'solved' ? (
          <>
            <div role="status" className="bg-ok-soft text-ok rounded-xl p-4">
              <p className="text-sm font-semibold">{fr.opening.solved}</p>
            </div>

            <div className="mt-4">
              <RatingButtons rating={rating} onRate={(value) => void rate(value)} />
            </div>

            <button
              type="button"
              onClick={onOther}
              className="bg-accent mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
            >
              {nextLabel}
            </button>
          </>
        ) : null}

        {state.outcome === 'failed' ? (
          <>
            <div role="status" className="bg-bad-soft text-bad rounded-xl p-4">
              <p className="text-sm font-semibold">{fr.opening.failed}</p>
              <p className="mt-1 text-xs opacity-80">
                {fr.opening.expectedMove.replace('{move}', state.expectedSan ?? '')}
              </p>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={restart}
                className="bg-accent flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.opening.retry}
              </button>
              <button
                type="button"
                onClick={onOther}
                className="border-line text-ink-muted flex-1 rounded-xl border px-4 py-3 text-sm"
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
