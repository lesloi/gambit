import { ChevronLeft, Lightbulb, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { database } from '../../db/db';
import type { Engine } from '../../engine/uci';
import { createStockfishEngine } from '../../engine/stockfish';
import { fr } from '../../i18n/fr';
import { legalDests, promotionPieces, sideToMove, type PromotionPiece } from '../../lib/chess';
import type { GameReason, GameResult, Side } from '../../lib/position';
import { ChessBoard } from '../../ui/ChessBoard';
import { PromotionDialog, promotionAnchor } from '../../ui/PromotionDialog';
import {
  afterMove,
  createClock,
  flagged,
  formatClock,
  remainingMs,
  stopClock,
  type ClockState,
} from './clock';
import { flagSide, playMove, playUci, showHint, startGame, type PlayState } from './game';
import { HINT_MOVETIME_MS, HINT_SKILL, LEVELS, type Level } from './level';
import { thinkTimeMs } from './pacing';
import { gameRecord, saveGame } from './record';
import { readPlayLevel, readPlayTimeControl, savePlayLevel, savePlayTimeControl } from './settings';
import { formatTimeControl, TIME_CONTROLS, type TimeControl } from './timeControl';

type EngineState = 'loading' | 'ready' | 'failed';
type Saved = 'idle' | 'saved' | 'failed';

interface PendingPromotion {
  from: string;
  to: string;
  options: PromotionPiece[];
}

export function PlayScreen({ onExit }: { onExit: () => void }) {
  const [levelIndex, setLevelIndex] = useState(readPlayLevel);
  const [controlIndex, setControlIndex] = useState(readPlayTimeControl);
  const [gameKey, setGameKey] = useState(0);
  const [playing, setPlaying] = useState(false);

  const start = () => {
    savePlayLevel(levelIndex);
    savePlayTimeControl(controlIndex);
    setGameKey((key) => key + 1);
    setPlaying(true);
  };

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pt-4 pb-6 sm:px-6">
        <header className="flex items-center gap-1">
          <button
            type="button"
            onClick={playing ? () => setPlaying(false) : onExit}
            aria-label={fr.play.back}
            className="text-ink-muted hover:text-ink -ml-2 grid size-11 place-items-center rounded-full"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif text-lg">{fr.play.title}</h1>
          {playing ? (
            <span className="border-line text-ink-muted ml-auto rounded-full border px-2.5 py-1 text-xs">
              {fr.play.levelValue.replace('{elo}', String(LEVELS[levelIndex].elo))}
            </span>
          ) : null}
        </header>

        <div className="mt-4 flex-1">
          {playing ? (
            <PlayGame
              key={gameKey}
              level={LEVELS[levelIndex]}
              control={TIME_CONTROLS[controlIndex]}
              onNewGame={() => setGameKey((key) => key + 1)}
              onChangeLevel={() => setPlaying(false)}
            />
          ) : (
            <PlaySetup
              levelIndex={levelIndex}
              onLevelChange={setLevelIndex}
              controlIndex={controlIndex}
              onControlChange={setControlIndex}
              onStart={start}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PlaySetup({
  levelIndex,
  onLevelChange,
  controlIndex,
  onControlChange,
  onStart,
}: {
  levelIndex: number;
  onLevelChange: (index: number) => void;
  controlIndex: number;
  onControlChange: (index: number) => void;
  onStart: () => void;
}) {
  const level = LEVELS[levelIndex];
  const levelText = fr.play.levelValue.replace('{elo}', String(level.elo));

  return (
    <>
      <p className="text-ink-muted text-sm">{fr.play.intro}</p>

      <section className="border-line bg-paper-raised mt-5 rounded-2xl border p-5">
        <label htmlFor="play-level" className="text-sm font-semibold">
          {fr.play.level}
        </label>
        <input
          id="play-level"
          type="range"
          min={0}
          max={LEVELS.length - 1}
          step={1}
          value={levelIndex}
          onChange={(event) => onLevelChange(Number(event.target.value))}
          aria-valuetext={levelText}
          className="accent-accent mt-3 h-11 w-full"
        />
        <div className="text-ink-muted flex justify-between text-xs">
          <span>{LEVELS[0].elo}</span>
          <span>{LEVELS[LEVELS.length - 1].elo}</span>
        </div>
        <p className="mt-2 text-sm font-medium" aria-live="polite">
          {levelText}
        </p>

        <div className="mt-5">
          <label htmlFor="play-time-control" className="text-sm font-semibold">
            {fr.play.clock}
          </label>
          <select
            id="play-time-control"
            value={controlIndex}
            onChange={(event) => onControlChange(Number(event.target.value))}
            className="border-line bg-paper-raised text-ink mt-3 min-h-11 w-full rounded-lg border px-3 text-sm"
          >
            {TIME_CONTROLS.map((control, index) => (
              <option key={index} value={index}>
                {formatTimeControl(control)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="bg-accent mt-4 min-h-11 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
        >
          {fr.play.start}
        </button>
      </section>
    </>
  );
}

function resultLabel(result: GameResult): string {
  if (result.winner === 'white') return fr.play.whiteWins;
  if (result.winner === 'black') return fr.play.blackWins;
  return fr.play.draw;
}

const REASON_LABEL: Record<GameReason, string> = {
  mate: fr.play.reasons.mate,
  stalemate: fr.play.reasons.stalemate,
  insufficient: fr.play.reasons.insufficient,
  'fifty-move': fr.play.reasons.fiftyMove,
  threefold: fr.play.reasons.threefold,
  flag: fr.play.reasons.flag,
};

function PlayGame({
  level,
  control,
  onNewGame,
  onChangeLevel,
}: {
  level: Level;
  control: TimeControl;
  onNewGame: () => void;
  onChangeLevel: () => void;
}) {
  const { controlMs, incrementMs } = control;
  const [state, setState] = useState(startGame);
  const [clock, setClock] = useState(() => createClock(controlMs, incrementMs));
  const [now, setNow] = useState(() => Date.now());
  const [engineState, setEngineState] = useState<EngineState>('loading');
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [hintPending, setHintPending] = useState(false);
  const [saved, setSaved] = useState<Saved>('idle');
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const engine = useRef<Engine | null>(null);
  const boardHost = useRef<HTMLDivElement>(null);
  const recorded = useRef(false);
  const startedAt = useRef<number | null>(null);
  const generation = useRef(0);
  const clockRef = useRef(clock);

  useEffect(() => {
    startedAt.current ??= Date.now();
  }, []);

  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);

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
      generation.current += 1;
      instance.stop();
      if (engine.current === instance) engine.current = null;
    };
  }, [engineAttempt]);

  const userTurn = sideToMove(state.fen) === state.userColor;
  const movable =
    state.outcome === 'playing' &&
    userTurn &&
    !thinking &&
    !hintPending &&
    pending === null &&
    engineState === 'ready';
  const dests = useMemo(
    () => (movable ? legalDests(state.fen) : new Map<string, string[]>()),
    [movable, state.fen],
  );
  const remaining = remainingMs(clock, now);

  const complete = useCallback(
    (after: PlayState) => {
      setState(after);
      setClock((current) => stopClock(current, Date.now()));
      // The game can end while the promotion chooser waits, for instance at the flag.
      setPending(null);
      if (after.outcome !== 'over' || after.result === null || recorded.current) return;

      recorded.current = true;
      const record = gameRecord(after, {
        level: level.elo,
        controlMs,
        incrementMs,
        startedAt: startedAt.current ?? Date.now(),
        endedAt: Date.now(),
      });
      saveGame(database, record).then(
        () => setSaved('saved'),
        () => setSaved('failed'),
      );
    },
    [controlMs, incrementMs, level.elo],
  );

  const applyMove = useCallback(
    (after: PlayState, mover: Side, at: number): ClockState | null => {
      if (after.outcome === 'over') {
        complete(after);
        return null;
      }
      const clock = afterMove(clockRef.current, mover, at);
      setState(after);
      setNow(at);
      setClock(clock);
      return clock;
    },
    [complete],
  );

  const askEngine = useCallback(
    (game: PlayState, clock: ClockState) => {
      const instance = engine.current;
      if (!instance) return;

      const engineSide = sideToMove(game.fen);
      const budget = thinkTimeMs(control, remainingMs(clock, Date.now())[engineSide]);
      // A clock already at zero has lost before the engine can look: `go movetime 0` would search
      // until the adapter's timeout instead of ending the game.
      if (budget === 0) {
        complete(flagSide(game, engineSide));
        return;
      }

      const request = generation.current;
      setThinking(true);
      instance.bestMove(game.fen, { skill: level.skill, movetimeMs: budget }).then(
        (uci) => {
          if (request !== generation.current) return;
          setThinking(false);
          if (uci === null) {
            setEngineState('failed');
            return;
          }

          const at = Date.now();
          const late = flagged(clockRef.current, at);
          if (late !== null) {
            generation.current += 1;
            complete(flagSide(game, late));
            return;
          }

          const after = playUci(game, uci);
          if (after === game) {
            // The engine named a move the board refuses; it can no longer be trusted for this game.
            setEngineState('failed');
            return;
          }
          applyMove(after, sideToMove(game.fen), at);
        },
        () => {
          if (request !== generation.current) return;
          setThinking(false);
          setEngineState('failed');
        },
      );
    },
    [applyMove, complete, control, level.skill],
  );

  const playUserMove = (from: string, to: string, promotion?: PromotionPiece) => {
    const at = Date.now();
    const late = flagged(clock, at);
    if (late !== null) {
      generation.current += 1;
      engine.current?.cancel();
      setThinking(false);
      complete(flagSide(state, late));
      return;
    }

    const after = playMove(state, from, to, promotion);
    if (after === state) return;
    const next = applyMove(after, sideToMove(state.fen), at);
    if (next && after.outcome === 'playing') askEngine(after, next);
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

  const askHint = () => {
    const instance = engine.current;
    if (!instance || state.outcome !== 'playing' || !userTurn || thinking || hintPending) return;

    const request = generation.current;
    setHintPending(true);
    instance.bestMove(state.fen, { skill: HINT_SKILL, movetimeMs: HINT_MOVETIME_MS }).then(
      (uci) => {
        if (request !== generation.current) return;
        setHintPending(false);
        if (uci !== null) setState((current) => showHint(current, uci));
      },
      () => {
        if (request === generation.current) setHintPending(false);
      },
    );
  };

  const retryEngine = () => {
    generation.current += 1;
    engine.current?.cancel();
    setThinking(false);
    setHintPending(false);
    setEngineState('loading');
    setEngineAttempt((attempt) => attempt + 1);
  };

  const clockRunning = state.outcome === 'playing' && clock.running !== null;

  useEffect(() => {
    if (!clockRunning) return;

    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);

      const side = flagged(clock, at);
      if (side === null) return;

      generation.current += 1;
      engine.current?.cancel();
      setThinking(false);
      setHintPending(false);
      complete(flagSide(state, side));
    }, 250);

    return () => clearInterval(timer);
  }, [clockRunning, clock, state, complete]);

  const status =
    engineState === 'loading'
      ? fr.play.engineLoading
      : engineState === 'failed'
        ? fr.play.engineFailed
        : thinking || hintPending
          ? fr.play.thinking
          : userTurn
            ? fr.play.yourMove
            : fr.play.thinking;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-muted text-sm">
          {fr.play.clock} · {formatTimeControl(control)}
        </p>
        {state.assisted ? (
          <span className="border-line text-ink-muted rounded-full border px-2 py-0.5 text-[10px] tracking-wider uppercase">
            {fr.play.assisted}
          </span>
        ) : null}
      </div>

      <div className="border-line bg-paper-raised mt-2 rounded-2xl border p-2.5 sm:p-3">
        <ClockRow
          side="black"
          ms={remaining.black}
          active={clock.running === 'black' && state.outcome === 'playing'}
        />

        <div ref={boardHost} tabIndex={-1} aria-label={fr.play.board} className="my-2 rounded-xl">
          <ChessBoard
            fen={state.fen}
            orientation={state.userColor}
            turn={sideToMove(state.fen)}
            lastMove={state.lastMove}
            movable={movable}
            dests={dests}
            hint={state.hint}
            onMove={move}
            resetKey={resetKey}
          />
        </div>

        <ClockRow
          side="white"
          ms={remaining.white}
          active={clock.running === 'white' && state.outcome === 'playing'}
        />
      </div>

      <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
        <p className="text-sm font-medium" role="status">
          {state.outcome === 'over' && state.result ? resultLabel(state.result) : status}
        </p>
      </div>

      {engineState === 'failed' && state.outcome === 'playing' ? (
        <div
          role="alert"
          className="bg-bad-soft text-bad mt-2 flex items-center justify-between gap-3 rounded-xl p-3"
        >
          <p className="text-xs">{fr.play.engineFailed}</p>
          <button
            type="button"
            onClick={retryEngine}
            className="border-bad/30 min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold"
          >
            {fr.play.engineRetry}
          </button>
        </div>
      ) : null}

      <p className="mt-2 min-h-5 text-xs" role="status">
        {hintPending
          ? fr.play.hintPending
          : state.hint
            ? fr.play.hintShown.replace('{move}', state.hint.san)
            : ''}
      </p>

      {state.outcome === 'over' && state.result ? (
        <div className="mt-2">
          <div className="border-line bg-paper-raised rounded-xl border p-4">
            <p className="text-sm font-semibold">{resultLabel(state.result)}</p>
            <p className="text-ink-muted mt-1 text-xs">{REASON_LABEL[state.result.reason]}</p>
            {state.assisted ? (
              <p className="text-ink-muted mt-1 text-xs">{fr.play.assisted}</p>
            ) : null}
            {saved === 'saved' ? (
              <p className="text-ink-muted mt-1 text-xs">{fr.play.saved}</p>
            ) : null}
            {saved === 'failed' ? (
              <p className="text-bad mt-1 text-xs" role="alert">
                {fr.play.saveFailed}
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onNewGame}
              className="bg-accent flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white"
            >
              {fr.play.newGame}
            </button>
            <button
              type="button"
              onClick={onChangeLevel}
              className="border-line text-ink-muted flex-1 rounded-xl border px-4 py-3 text-sm"
            >
              {fr.play.changeSettings}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={askHint}
            disabled={!userTurn || thinking || hintPending || engineState !== 'ready'}
            className="border-line text-ink flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm disabled:opacity-50"
          >
            <Lightbulb size={16} aria-hidden="true" />
            {hintPending ? fr.play.hintPending : fr.play.hint}
          </button>
          <button
            type="button"
            onClick={onNewGame}
            className="border-line text-ink-muted flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm"
          >
            <RotateCcw size={16} aria-hidden="true" />
            {fr.play.newGame}
          </button>
        </div>
      )}

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

function ClockRow({ side, ms, active }: { side: Side; ms: number; active: boolean }) {
  const label = side === 'white' ? fr.play.clocks.white : fr.play.clocks.black;

  return (
    <div
      className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
        active ? 'bg-accent-soft text-ink font-semibold' : 'text-ink-muted'
      }`}
    >
      <span>{side === 'white' ? fr.opening.white : fr.opening.black}</span>
      <span className="tabular-nums" role="timer" aria-label={label}>
        {formatClock(ms)}
      </span>
    </div>
  );
}
