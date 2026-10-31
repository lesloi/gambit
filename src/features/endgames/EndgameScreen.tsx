import { ChevronLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Engine } from '../../engine/uci';
import { createStockfishEngine } from '../../engine/stockfish';
import { fr } from '../../i18n/fr';
import { legalDests, promotionPieces, sideToMove, type PromotionPiece } from '../../lib/chess';
import { ChessBoard } from '../../ui/ChessBoard';
import { PromotionDialog, promotionAnchor } from '../../ui/PromotionDialog';
import { GRADE, RatingButtons, type Rating } from '../../ui/RatingButtons';
import { loadEndgames } from './content';
import {
  playEndgameMove,
  restartEndgame,
  startEndgame,
  type Endgame,
  type EndgameEnd,
  type EndgameState,
} from './endgame';
import { missedEndgameRating, recordEndgameReview } from './record';

type EngineState = 'loading' | 'ready' | 'failed';

interface PendingPromotion {
  from: string;
  to: string;
  options: PromotionPiece[];
}

export function EndgameScreen({ onExit }: { onExit: () => void }) {
  const endgames = useMemo(() => loadEndgames(), []);
  const [selected, setSelected] = useState<Endgame | null>(null);

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-4 pb-6 sm:px-6">
        <header className="flex items-center gap-1">
          <button
            type="button"
            onClick={selected ? () => setSelected(null) : onExit}
            aria-label={fr.endgame.back}
            className="text-ink-muted hover:text-ink -ml-2 grid size-11 place-items-center rounded-full"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif text-lg">{fr.endgame.title}</h1>
          {selected ? (
            <span className="border-line text-ink-muted ml-auto rounded-full border px-2.5 py-1 text-xs">
              {selected.result === 'win' ? fr.endgame.win : fr.endgame.draw}
            </span>
          ) : null}
        </header>

        <div className="mt-4 flex-1">
          {selected ? (
            <EndgamePlayer key={selected.id} endgame={selected} onOther={() => setSelected(null)} />
          ) : (
            <EndgameList endgames={endgames} onPlay={setSelected} />
          )}
        </div>
      </div>
    </div>
  );
}

function EndgameList({
  endgames,
  onPlay,
}: {
  endgames: readonly Endgame[];
  onPlay: (endgame: Endgame) => void;
}) {
  if (endgames.length === 0) {
    return <p className="text-ink-muted text-sm">{fr.endgame.empty}</p>;
  }

  return (
    <>
      <p className="text-ink-muted text-sm">{fr.endgame.intro}</p>

      <ul className="mt-5 grid gap-3">
        {endgames.map((endgame) => (
          <li key={endgame.id} className="border-line bg-paper-raised rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{endgame.name}</h2>
                <p className="text-ink-muted mt-1 text-sm leading-snug">{endgame.goal}</p>
              </div>
              <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-[10px] tracking-wider uppercase">
                {endgame.result === 'win' ? fr.endgame.win : fr.endgame.draw}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onPlay(endgame)}
              className="bg-accent mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
            >
              {fr.endgame.play}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function endgameReason(end: EndgameEnd): string {
  switch (end.kind) {
    case 'mate':
      return fr.endgame.reasons.mate;
    case 'stalemate':
      return fr.endgame.reasons.stalemate;
    case 'insufficient':
      return fr.endgame.reasons.insufficient;
    case 'fifty-move':
      return fr.endgame.reasons.fiftyMove;
    case 'threefold':
      return fr.endgame.reasons.threefold;
  }
}

function EndgamePlayer({ endgame, onOther }: { endgame: Endgame; onOther: () => void }) {
  const [state, setState] = useState(() => startEndgame(endgame));
  const [engineState, setEngineState] = useState<EngineState>('loading');
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [rating, setRating] = useState<Rating | null>(null);
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const engine = useRef<Engine | null>(null);
  const boardHost = useRef<HTMLDivElement>(null);
  const recorded = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    let instance: Engine;
    try {
      instance = createStockfishEngine();
    } catch {
      queueMicrotask(() => {
        if (active) setEngineState('failed');
      });
      return;
    }
    engine.current = instance;

    instance.prepare().then(
      () => {
        if (active) setEngineState('ready');
      },
      () => {
        if (active) setEngineState('failed');
      },
    );

    return () => {
      active = false;
      instance.stop();
      if (engine.current === instance) engine.current = null;
    };
  }, [engineAttempt]);

  const userTurn = sideToMove(state.fen) === state.userColor;
  const movable = state.outcome === 'playing' && userTurn && !thinking && engineState === 'ready';
  const dests = useMemo(
    () => (movable ? legalDests(state.fen) : new Map<string, string[]>()),
    [movable, state.fen],
  );

  const restart = () => {
    generation.current += 1;
    engine.current?.cancel();
    setState(restartEndgame(state));
    setThinking(false);
    setRating(null);
    setPending(null);
    recorded.current = false;
    setResetKey((key) => key + 1);
    boardHost.current?.focus();
  };

  const applyTransition = (before: EndgameState, after: EndgameState) => {
    setState(after);
    const missed = missedEndgameRating(before.outcome, after.outcome);
    if (missed !== null && !recorded.current) {
      recorded.current = true;
      void recordEndgameReview(endgame.id, missed).catch(() => undefined);
    }
  };

  const askEngine = (base: EndgameState) => {
    const instance = engine.current;
    if (!instance) return;

    const request = generation.current;
    setThinking(true);
    instance.bestMove(base.fen).then(
      (uci) => {
        if (request !== generation.current) return;
        setThinking(false);
        if (uci === null) {
          setEngineState('failed');
          return;
        }

        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.slice(4) as PromotionPiece | '';
        const after = playEndgameMove(base, from, to, promotion || undefined);
        if (after === base) {
          // The engine named a move the board refuses; it can no longer be trusted for this game.
          setEngineState('failed');
          return;
        }
        applyTransition(base, after);
      },
      () => {
        if (request !== generation.current) return;
        setThinking(false);
        setEngineState('failed');
      },
    );
  };

  const playUserMove = (from: string, to: string, promotion?: PromotionPiece) => {
    const after = playEndgameMove(state, from, to, promotion);
    if (after === state) return;
    applyTransition(state, after);
    if (after.outcome === 'playing') askEngine(after);
  };

  const move = (from: string, to: string) => {
    const options = promotionPieces(state.fen, from, to);
    if (options.length > 0) {
      setPending({ from, to, options });
      return;
    }
    playUserMove(from, to);
  };

  const promote = (piece: PromotionPiece) => {
    if (!pending) return;
    const { from, to } = pending;
    setPending(null);
    playUserMove(from, to, piece);
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
      await recordEndgameReview(endgame.id, GRADE[value]);
      recorded.current = true;
    } catch {
      setRating(null);
    }
  };

  const retryEngine = () => {
    setEngineState('loading');
    setEngineAttempt((attempt) => attempt + 1);
  };

  return (
    <>
      <div className="mb-3">
        <h2 className="font-serif text-lg">{endgame.name}</h2>
        <p className="text-ink-muted mt-1 text-sm">{endgame.goal}</p>
      </div>

      <div className="border-line bg-paper-raised rounded-2xl border p-2.5 sm:p-3">
        <div ref={boardHost} tabIndex={-1} aria-label={fr.endgame.board} className="rounded-xl">
          <ChessBoard
            fen={state.fen}
            orientation={state.userColor}
            turn={sideToMove(state.fen)}
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
          {engineState === 'loading'
            ? fr.endgame.engineLoading
            : engineState === 'failed'
              ? fr.endgame.engineFailed
              : thinking
                ? fr.endgame.thinking
                : userTurn
                  ? fr.endgame.yourMove
                  : fr.endgame.thinking}
        </p>
        {state.outcome === 'playing' ? (
          <button
            type="button"
            onClick={restart}
            className="text-ink-muted hover:text-ink min-h-11 shrink-0 rounded-full px-3 text-xs"
          >
            {fr.endgame.restart}
          </button>
        ) : null}
      </div>

      {engineState === 'failed' && state.outcome === 'playing' ? (
        <div
          role="alert"
          className="bg-bad-soft text-bad mt-2 flex items-center justify-between gap-3 rounded-xl p-3"
        >
          <p className="text-xs">{fr.endgame.engineFailed}</p>
          <button
            type="button"
            onClick={retryEngine}
            className="border-bad/30 min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold"
          >
            {fr.endgame.engineRetry}
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        {state.outcome === 'solved' ? (
          <>
            <div role="status" className="bg-ok-soft text-ok rounded-xl p-4">
              <p className="text-sm font-semibold">{fr.endgame.solved}</p>
              {state.end ? (
                <p className="mt-1 text-xs opacity-80">{endgameReason(state.end)}</p>
              ) : null}
            </div>

            <div className="mt-4">
              <RatingButtons rating={rating} onRate={(value) => void rate(value)} />
            </div>

            <button
              type="button"
              onClick={onOther}
              className="bg-accent mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
            >
              {fr.endgame.other}
            </button>
          </>
        ) : null}

        {state.outcome === 'failed' ? (
          <>
            <div role="status" className="bg-bad-soft text-bad rounded-xl p-4">
              <p className="text-sm font-semibold">{fr.endgame.failed}</p>
              {state.end ? (
                <p className="mt-1 text-xs opacity-80">{endgameReason(state.end)}</p>
              ) : null}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={restart}
                className="bg-accent flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                {fr.endgame.retry}
              </button>
              <button
                type="button"
                onClick={onOther}
                className="border-line text-ink-muted flex-1 rounded-xl border px-4 py-3 text-sm"
              >
                {fr.endgame.other}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {pending ? (
        <PromotionDialog
          color={sideToMove(state.fen)}
          options={pending.options}
          measure={() => promotionAnchor(boardHost.current, pending.to, state.userColor)}
          onChoose={promote}
          onCancel={cancelPromotion}
        />
      ) : null}
    </>
  );
}
