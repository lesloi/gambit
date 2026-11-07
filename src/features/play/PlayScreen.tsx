import { ChevronLeft, Lightbulb, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { database } from '../../db/db';
import { HINT_MOVETIME_MS, HINT_SKILL } from '../../engine/hint';
import { createMaiaEngine } from '../../engine/maiaEngine';
import { createStockfishEngine, type StockfishEngine } from '../../engine/stockfish';
import type { Engine, PositionEval } from '../../engine/uci';
import { fr } from '../../i18n/fr';
import { legalDests, promotionPieces, sideToMove, type PromotionPiece } from '../../lib/chess';
import type { GameReason, GameResult, Side } from '../../lib/position';
import { ChessBoard } from '../../ui/ChessBoard';
import { PromotionDialog, promotionAnchor } from '../../ui/PromotionDialog';
import { GameReview } from './GameReview';
import { MoveSheet } from './MoveSheet';
import { drawColor, PLAY_COLORS, type PlayColor } from './color';
import { moveLabel, scoreSheet } from './notation';
import { consumePremove, enqueuePremove, type Premove } from './premoves';
import {
  afterMove,
  createClock,
  flagged,
  formatClock,
  pauseClock,
  remainingMs,
  startClock,
  stopClock,
  type ClockState,
} from './clock';
import {
  clearDraft,
  draftFromGame,
  readDraft,
  resumeClock,
  resumeGame,
  saveDraft,
  type PlayDraft,
} from './draft';
import {
  engineTurnPly,
  flagSide,
  playMove,
  playUci,
  positionAt,
  showHint,
  startGame,
  type PlayState,
} from './game';
import { LEVELS, levelAt, levelIndex as levelIndexOf, type Level } from './level';
import { materialOf, type CapturedPiece, type Material, type MaterialColor } from './material';
import { gameRecord, saveGame } from './record';
import {
  readPlayColor,
  readPlayElo,
  readPlayTimeControl,
  savePlayColor,
  savePlayElo,
  savePlayTimeControl,
} from './settings';
import { formatTimeControl, TIME_CONTROLS, type TimeControl } from './timeControl';

type EngineState = 'loading' | 'ready' | 'failed';
type Saved = 'idle' | 'saved' | 'failed';

const NO_DESTS = new Map<string, string[]>();

/** Waits, so a move that took milliseconds can still read as a thought. */
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface PendingPromotion {
  from: string;
  to: string;
  options: PromotionPiece[];
}

export function PlayScreen({ onExit }: { onExit: () => void }) {
  const [elo, setElo] = useState(readPlayElo);
  const [controlIndex, setControlIndex] = useState(readPlayTimeControl);
  const [color, setColor] = useState(readPlayColor);
  const levelPosition = levelIndexOf(elo);
  const [gameKey, setGameKey] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [draft, setDraft] = useState<PlayDraft | null>(readDraft);
  const [resume, setResume] = useState<PlayDraft | null>(null);

  // The child saves on its way out, so the setup has to look at the draft again once it is gone.
  useEffect(() => {
    // Reading storage once the child has unmounted is a deliberate sync with an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!playing) setDraft(readDraft());
  }, [playing]);

  const start = () => {
    savePlayElo(levelAt(levelPosition).elo);
    savePlayTimeControl(controlIndex);
    savePlayColor(color);
    clearDraft();
    setDraft(null);
    setResume(null);
    setGameKey((key) => key + 1);
    setPlaying(true);
  };

  const resumeStoredGame = () => {
    if (draft === null) return;
    setResume(draft);
    setGameKey((key) => key + 1);
    setPlaying(true);
  };

  const newGame = () => {
    clearDraft();
    setDraft(null);
    setResume(null);
    setGameKey((key) => key + 1);
  };

  const level = resume ? levelAt(levelIndexOf(resume.level)) : levelAt(levelPosition);
  const control = resume
    ? { controlMs: resume.controlMs, incrementMs: resume.incrementMs }
    : TIME_CONTROLS[controlIndex];

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pt-4 pb-6 sm:px-6">
        <header className="flex items-center gap-1">
          <button
            type="button"
            onClick={playing ? () => setPlaying(false) : onExit}
            aria-label={fr.play.back}
            className="text-ink-muted hover:text-ink -ml-2 grid size-11 place-items-center rounded-full"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-[0.9375rem] font-semibold">{fr.play.title}</h1>
          {playing ? (
            <span className="border-line text-ink-muted ml-auto rounded-sm border px-2 py-0.5 text-[0.6875rem]">
              {fr.play.levelValue.replace('{elo}', String(level.elo))}
            </span>
          ) : null}
        </header>

        <div className="mt-4 flex-1">
          {playing ? (
            <PlayGame
              key={gameKey}
              level={level}
              control={control}
              color={color}
              initialDraft={resume}
              onNewGame={newGame}
            />
          ) : (
            <PlaySetup
              levelIndex={levelPosition}
              onLevelChange={(index) => setElo(LEVELS[index].elo)}
              controlIndex={controlIndex}
              onControlChange={setControlIndex}
              color={color}
              onColorChange={setColor}
              draft={draft}
              onStart={start}
              onResume={resumeStoredGame}
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
  color,
  onColorChange,
  draft,
  onStart,
  onResume,
}: {
  levelIndex: number;
  onLevelChange: (index: number) => void;
  controlIndex: number;
  onControlChange: (index: number) => void;
  color: PlayColor;
  onColorChange: (color: PlayColor) => void;
  draft: PlayDraft | null;
  onStart: () => void;
  onResume: () => void;
}) {
  const level = LEVELS[levelIndex];
  const levelText = fr.play.levelValue.replace('{elo}', String(level.elo));

  return (
    <>
      <p className="text-ink-muted text-sm">{fr.play.intro}</p>

      {draft ? (
        <section className="border-line bg-paper-raised mt-5 rounded-sm border p-4">
          <h2 className="text-sm font-semibold">{fr.play.resumeTitle}</h2>
          <p className="text-ink-muted mt-1 text-xs">
            {fr.play.resumeDetail
              .replace('{elo}', String(levelAt(levelIndexOf(draft.level)).elo))
              .replace(
                '{clock}',
                formatTimeControl({
                  controlMs: draft.controlMs,
                  incrementMs: draft.incrementMs,
                }),
              )
              .replace('{color}', fr.play.colors[draft.userColor])}
          </p>
          <button
            type="button"
            onClick={onResume}
            className="bg-accent mt-3 min-h-11 w-full rounded-sm px-4 text-sm font-semibold text-white"
          >
            {fr.play.resume}
          </button>
        </section>
      ) : null}

      <section className="border-line bg-paper-raised mt-5 rounded-sm border p-4">
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
            className="border-line bg-paper text-ink mt-3 min-h-11 w-full rounded-sm border px-3 text-sm"
          >
            {TIME_CONTROLS.map((control, index) => (
              <option key={index} value={index}>
                {formatTimeControl(control)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <label htmlFor="play-color" className="text-sm font-semibold">
            {fr.play.color}
          </label>
          <select
            id="play-color"
            value={color}
            onChange={(event) => onColorChange(event.target.value as PlayColor)}
            className="border-line bg-paper text-ink mt-3 min-h-11 w-full rounded-sm border px-3 text-sm"
          >
            {PLAY_COLORS.map((option) => (
              <option key={option} value={option}>
                {fr.play.colors[option]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="bg-accent mt-4 min-h-11 w-full rounded-sm px-4 text-sm font-semibold text-white"
        >
          {draft ? fr.play.newGame : fr.play.start}
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

function materialLabel(advantage: number): string {
  // An even material says nothing: the region stays mounted so a later advantage is announced.
  if (advantage === 0) return '';

  return (advantage > 0 ? fr.play.material.white : fr.play.material.black).replace(
    '{points}',
    String(Math.abs(advantage)),
  );
}

const REASON_LABEL: Record<GameReason, string> = {
  mate: fr.play.reasons.mate,
  stalemate: fr.play.reasons.stalemate,
  insufficient: fr.play.reasons.insufficient,
  'seventy-five-move': fr.play.reasons.seventyFiveMove,
  fivefold: fr.play.reasons.fivefold,
  flag: fr.play.reasons.flag,
  'flag-draw': fr.play.reasons.flagDraw,
};

function PlayGame({
  level,
  control,
  color,
  initialDraft,
  onNewGame,
}: {
  level: Level;
  control: TimeControl;
  color: PlayColor;
  initialDraft: PlayDraft | null;
  onNewGame: () => void;
}) {
  const { controlMs, incrementMs } = control;
  const [state, setState] = useState<PlayState>(() =>
    initialDraft ? resumeGame(initialDraft) : startGame(drawColor(color)),
  );
  const [clock, setClock] = useState<ClockState>(() =>
    initialDraft ? resumeClock(initialDraft) : createClock(controlMs, incrementMs),
  );
  const [now, setNow] = useState(() => Date.now());
  const [engineState, setEngineState] = useState<EngineState>('loading');
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [hintPending, setHintPending] = useState(false);
  const [saved, setSaved] = useState<Saved>('idle');
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [browsedPly, setBrowsedPly] = useState<number | null>(null);
  const [premoves, setPremoves] = useState<readonly Premove[]>([]);
  const premovesRef = useRef<readonly Premove[]>([]);
  const updatePremoves = useCallback((next: readonly Premove[]) => {
    premovesRef.current = next;
    setPremoves(next);
  }, []);
  const engine = useRef<StockfishEngine | null>(null);
  // Maia moves; Stockfish keeps the hints and the review. Two workers, one per job.
  const maia = useRef<Engine | null>(null);
  // Drawn once when the game mounts, so the same position offers the same move on a re-render.
  const gameSeed = useRef(0);
  useEffect(() => {
    gameSeed.current = Math.floor(Math.random() * 2 ** 31);
  }, []);
  const boardHost = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLOListElement>(null);
  const recorded = useRef(false);
  const startedAt = useRef<number | null>(initialDraft?.startedAt ?? null);
  const generation = useRef(0);
  const clockRef = useRef(clock);
  const stateRef = useRef(state);
  const engineStateRef = useRef<EngineState>('loading');
  // The engine turn already asked for, so a render never asks for the same position twice.
  const autoAsked = useRef<number | null>(null);
  const discarding = useRef(false);
  const consumedPly = useRef<number | null>(null);

  useEffect(() => {
    startedAt.current ??= Date.now();
  }, []);

  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);

  useEffect(() => {
    engineStateRef.current = engineState;
  }, [engineState]);

  // A draft follows the live game after every move and hint; a finished game leaves none.
  useEffect(() => {
    stateRef.current = state;
    const draft = draftFromGame(
      { state, clock, startedAt: startedAt.current ?? Date.now(), level: level.elo },
      Date.now(),
    );
    if (draft) saveDraft(draft);
    else clearDraft();
  }, [state, clock, level.elo]);

  // Reads the refs, so a page close or an unmount saves the time left at that instant.
  const saveNow = useCallback(
    (at = Date.now()) => {
      if (discarding.current) return;
      const draft = draftFromGame(
        {
          state: stateRef.current,
          clock: clockRef.current,
          startedAt: startedAt.current ?? at,
          level: level.elo,
        },
        at,
      );
      if (draft) saveDraft(draft);
    },
    [level.elo],
  );

  // A resumed clock waits for the engine: the closed time and the engine's load cost nothing.
  const startResumedClock = useCallback(() => {
    // A hidden page stays frozen, and so does a clock whose engine cannot play yet.
    if (document.visibilityState === 'hidden' || engineStateRef.current !== 'ready') return;
    const at = Date.now();
    setNow(at);
    const started = startClock(clockRef.current, at);
    if (started !== clockRef.current) {
      clockRef.current = started;
      setClock(started);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let instance: StockfishEngine;
    let maiaEngine: Engine;
    // A fresh worker has not been asked for the opening or the resumed position yet.
    autoAsked.current = null;
    engineStateRef.current = 'loading';
    try {
      instance = createStockfishEngine();
      maiaEngine = createMaiaEngine();
    } catch {
      engineStateRef.current = 'failed';
      queueMicrotask(() => {
        if (!active) return;
        updatePremoves([]);
        setEngineState('failed');
      });
      return;
    }
    engine.current = instance;
    maia.current = maiaEngine;

    // Only the engine that plays holds up the board. Stockfish still loads beside Maia for the
    // hints and the review; if it fails there, the game goes on and those stay unavailable.
    instance.prepare().catch(() => {});
    maiaEngine.prepare().then(
      () => {
        if (!active) return;
        engineStateRef.current = 'ready';
        setEngineState('ready');
        startResumedClock();
      },
      () => {
        engineStateRef.current = 'failed';
        if (!active) return;
        updatePremoves([]);
        setEngineState('failed');
      },
    );

    return () => {
      active = false;
      generation.current += 1;
      instance.stop();
      maiaEngine.stop();
      if (engine.current === instance) engine.current = null;
      if (maia.current === maiaEngine) maia.current = null;
    };
  }, [engineAttempt, startResumedClock, updatePremoves]);

  // Hidden means the clock stops paying: the page may be closed, frozen or put away for a while.
  useEffect(() => {
    const hide = () => {
      const at = Date.now();
      saveNow(at);
      const paused = pauseClock(clockRef.current, at);
      clockRef.current = paused;
      setNow(at);
      setClock(paused);
    };

    const show = () => {
      startResumedClock();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hide();
      else show();
    };
    const onPageHide = () => hide();
    const onPageShow = () => show();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      saveNow();
    };
  }, [saveNow, startResumedClock]);

  const { moves: played, rows: pairs } = useMemo(() => scoreSheet(state.moves), [state.moves]);
  const livePly = state.moves.length;
  const shownPly = browsedPly ?? livePly;
  const browsing = shownPly !== livePly;
  const shown = useMemo(() => positionAt(state, shownPly), [state, shownPly]);
  const shownMove = played[shownPly - 1] ?? null;

  const userTurn = sideToMove(state.fen) === state.userColor;
  const movable =
    state.outcome === 'playing' &&
    userTurn &&
    !thinking &&
    !hintPending &&
    pending === null &&
    engineState === 'ready' &&
    !browsing;
  // The engine's turn is when the user can queue premoves, which then play one by one on its replies.
  const premovable =
    state.outcome === 'playing' && !userTurn && engineState === 'ready' && !browsing;
  const dests = useMemo(() => (movable ? legalDests(state.fen) : NO_DESTS), [movable, state.fen]);
  const remaining = remainingMs(clock, now);
  const liveMaterial = useMemo(() => materialOf(state.fen, state.moves), [state.fen, state.moves]);
  const material = useMemo(
    () => (browsing ? materialOf(shown.fen, state.moves.slice(0, shownPly)) : liveMaterial),
    [browsing, shown.fen, state.moves, shownPly, liveMaterial],
  );

  const complete = useCallback(
    (after: PlayState) => {
      setState(after);
      setClock((current) => stopClock(current, Date.now()));
      // The result and its analysis button take over as soon as the game ends, even mid-review.
      setBrowsedPly(null);
      // The game can end while the promotion chooser waits, for instance at the flag.
      setPending(null);
      updatePremoves([]);
      // A finished game must not be resumable, even if the tab closes before the effect below.
      if (after.outcome === 'over') clearDraft();
      if (after.outcome !== 'over' || after.result === null || recorded.current) return;

      recorded.current = true;
      const record = gameRecord(after, {
        engine: 'maia',
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
    [controlMs, incrementMs, level.elo, updatePremoves],
  );

  const applyMove = useCallback(
    (after: PlayState, mover: Side, at: number): ClockState | null => {
      if (after.outcome === 'over') {
        complete(after);
        return null;
      }
      // A move that lands while the page is hidden must not start the next clock behind it.
      const moved = afterMove(clockRef.current, mover, at);
      const clock = document.visibilityState === 'hidden' ? pauseClock(moved, at) : moved;
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
      // A clock already at zero has lost before the engine can play, whatever it would answer.
      if (remainingMs(clock, Date.now())[engineSide] <= 0) {
        complete(flagSide(game, engineSide));
        return;
      }

      const request = generation.current;
      // Record the turn here, after a user move as well as from the effect below, so the effect
      // never asks a second time for a position already on its way to the engine.
      autoAsked.current = game.moves.length;
      setThinking(true);
      const engineMove = maia.current
        ? Promise.all([
            maia.current.bestMove(game.fen, {
              rating: level.elo,
              history: game.moves,
              temperature: 1,
              seed: gameSeed.current + game.moves.length,
            }),
            // Maia does not search, so the move lands in milliseconds. The pause is what her
            // level would spend thinking, and what her clock pays for the move.
            pause(level.movetimeMs),
          ]).then(([move]) => move)
        : Promise.reject(new Error('The Maia engine is not ready'));
      engineMove.then(
        (uci) => {
          if (request !== generation.current) return;
          setThinking(false);
          if (uci === null) {
            engineStateRef.current = 'failed';
            updatePremoves([]);
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
            engineStateRef.current = 'failed';
            updatePremoves([]);
            setEngineState('failed');
            return;
          }
          applyMove(after, sideToMove(game.fen), at);
        },
        () => {
          if (request !== generation.current) return;
          setThinking(false);
          engineStateRef.current = 'failed';
          updatePremoves([]);
          setEngineState('failed');
        },
      );
    },
    [applyMove, complete, level.elo, level.movetimeMs, updatePremoves],
  );

  // The engine's reply is the moment the queued premoves can play, one per turn. A premove the new
  // position refuses takes the rest of the queue with it.
  useEffect(() => {
    if (browsing || state.outcome !== 'playing' || sideToMove(state.fen) !== state.userColor) {
      return;
    }
    if (premoves.length === 0 || consumedPly.current === state.moves.length) return;
    consumedPly.current = state.moves.length;

    const at = Date.now();
    const late = flagged(clockRef.current, at);
    if (late !== null) {
      // The engine is not running on the user's turn, so there is nothing to cancel here.
      complete(flagSide(state, late));
      updatePremoves([]);
      return;
    }

    const result = consumePremove(state, premoves);
    updatePremoves(result.queue);
    if (!result.played) return;

    const clock = applyMove(result.state, sideToMove(state.fen), at);
    if (clock && result.state.outcome === 'playing') askEngine(result.state, clock);
  }, [state, premoves, browsing, applyMove, askEngine, complete, updatePremoves]);

  // The engine owes a move at the opening of a game the user plays as Black, after a resumed game,
  // and after a retry: a failed engine left the position unanswered, so it is asked again once the
  // fresh worker is ready.
  const engineTurn = engineTurnPly(state);
  useEffect(() => {
    if (engineState !== 'ready' || engineTurn === null) return;
    if (autoAsked.current === engineTurn) return;

    askEngine(state, clockRef.current);
  }, [engineState, engineTurn, state, askEngine]);

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

  const addPremove = useCallback(
    (from: string, to: string) => {
      const before = premovesRef.current;
      const next = enqueuePremove(before, { from, to });
      updatePremoves(next);
      return next.length > before.length;
    },
    [updatePremoves],
  );

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
    engineStateRef.current = 'loading';
    setEngineState('loading');
    setEngineAttempt((attempt) => attempt + 1);
  };

  // The review asks for a position rather than the engine itself: the ref is read when the search
  // starts, never during a render, and the game screen keeps owning the worker.
  const analysePosition = useCallback((fen: string, movetimeMs: number): Promise<PositionEval> => {
    const instance = engine.current;
    return instance
      ? instance.analyse(fen, { movetimeMs })
      : Promise.reject(new Error('The engine is not ready'));
  }, []);

  const clockRunning =
    state.outcome === 'playing' && clock.running !== null && clock.since !== null;

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

  const browse = (ply: number) => {
    const at = Math.min(Math.max(ply, 0), livePly);
    if (at < livePly) updatePremoves([]);
    setBrowsedPly(at >= livePly ? null : at);
  };

  const step = (delta: number) => {
    const target = shownPly + delta;
    browse(target);
    // The next step from the last past position is the way back to the game: the board takes the
    // focus, as it does through "Revenir à la partie".
    if (target >= livePly) boardHost.current?.focus();
  };

  const selectMove = (ply: number) => {
    browse(ply);
    // The sheet sits under the board on a phone: bring the board back into view.
    if (window.matchMedia('(max-width: 767px)').matches) {
      boardHost.current?.scrollIntoView({ block: 'center' });
    }
  };

  const backToGame = () => {
    setBrowsedPly(null);
    sheet.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
    boardHost.current?.focus();
  };

  const startReview = () => {
    setBrowsedPly(null);
    setReviewing(true);
  };

  // Starting over throws the game in progress away: its draft must not come back on the way out.
  const restart = () => {
    discarding.current = true;
    onNewGame();
  };

  if (reviewing) {
    return <GameReview analyse={analysePosition} game={state} onNewGame={restart} />;
  }

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

  // Stepping back to the start leaves no move to name, so the bar names the position instead.
  const reviewText = shownMove
    ? (state.outcome === 'playing'
        ? fr.play.review.whilePlaying
        : fr.play.review.afterGame
      ).replace('{move}', moveLabel(shownMove))
    : state.outcome === 'playing'
      ? fr.play.review.startWhilePlaying
      : fr.play.review.startAfterGame;

  return (
    <>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_190px] md:items-start">
        <div className="min-w-0">
          <div className="text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>
              {fr.play.clock} · {formatTimeControl(control)}
            </span>
            <span className="ml-auto">
              {fr.play.playingAs.replace('{color}', fr.play.colors[state.userColor])}
            </span>
            {state.assisted ? (
              <span className="border-line rounded-xs border px-1.5 py-0.5 text-[0.625rem] tracking-wide uppercase">
                {fr.play.assisted}
              </span>
            ) : null}
          </div>

          <div className="mt-1.5">
            <ClockRow
              side="black"
              ms={remaining.black}
              active={clock.running === 'black' && state.outcome === 'playing'}
              material={material}
            />

            <div
              ref={boardHost}
              tabIndex={-1}
              aria-label={fr.play.board}
              className="my-1 rounded-sm"
            >
              <ChessBoard
                fen={shown.fen}
                orientation={state.userColor}
                turn={sideToMove(shown.fen)}
                lastMove={shown.lastMove}
                movable={movable}
                premovable={premovable}
                premoves={premoves}
                onPremove={addPremove}
                dests={dests}
                hint={browsing ? null : state.hint}
                onMove={move}
                resetKey={resetKey}
              />
            </div>

            <ClockRow
              side="white"
              ms={remaining.white}
              active={clock.running === 'white' && state.outcome === 'playing'}
              material={material}
            />

            {browsing ? (
              <div className="bg-accent-soft mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-sm px-2.5 py-1 text-xs">
                <p role="status">{reviewText}</p>
                <button
                  type="button"
                  onClick={backToGame}
                  className="border-line text-ink min-h-11 shrink-0 rounded-sm border px-3 text-xs font-semibold"
                >
                  {fr.play.review.back}
                </button>
              </div>
            ) : null}

            <p className="sr-only" role="status">
              {materialLabel(liveMaterial.advantage)}
            </p>
          </div>

          <p className="mt-3 text-[0.8125rem] font-medium" role="status">
            {state.outcome === 'over' && state.result ? resultLabel(state.result) : status}
          </p>

          <p className="text-ink-muted mt-1 min-h-4 text-xs" role="status">
            {browsing
              ? ''
              : hintPending
                ? fr.play.hintPending
                : state.hint
                  ? fr.play.hintShown.replace('{move}', state.hint.san)
                  : ''}
          </p>

          {engineState === 'failed' && state.outcome === 'playing' ? (
            <div
              role="alert"
              className="bg-bad-soft text-bad mt-2 flex items-center justify-between gap-3 rounded-sm p-2.5"
            >
              <p className="text-xs">{fr.play.engineFailed}</p>
              <button
                type="button"
                onClick={retryEngine}
                className="border-bad/30 min-h-11 shrink-0 rounded-sm border px-3 text-xs font-semibold"
              >
                {fr.play.engineRetry}
              </button>
            </div>
          ) : null}

          {state.outcome === 'over' && state.result ? (
            <div className="border-line bg-paper-raised mt-3 rounded-sm border p-3">
              <p className="text-sm font-semibold">{resultLabel(state.result)}</p>
              <p className="text-ink-muted mt-1 text-xs">{REASON_LABEL[state.result.reason]}</p>
              {state.assisted ? (
                <p className="text-ink-muted mt-1 text-xs">{fr.play.analysis.assisted}</p>
              ) : null}
              {saved === 'saved' ? (
                <p className="text-ink-muted mt-1 text-xs">{fr.play.saved}</p>
              ) : null}
              {saved === 'failed' ? (
                <p className="text-bad mt-1 text-xs" role="alert">
                  {fr.play.saveFailed}
                </p>
              ) : null}

              {!state.assisted ? (
                engineState === 'failed' ? (
                  <p className="text-ink-muted mt-2 text-xs">{fr.play.analysis.unavailable}</p>
                ) : (
                  <button
                    type="button"
                    onClick={startReview}
                    disabled={engineState !== 'ready'}
                    className="bg-accent mt-2 min-h-11 w-full rounded-sm px-4 text-[0.8125rem] font-semibold text-white disabled:opacity-50"
                  >
                    {fr.play.analysis.start}
                  </button>
                )
              ) : null}

              <button
                type="button"
                onClick={restart}
                className="border-line text-ink mt-2 min-h-11 w-full rounded-sm border px-3 text-xs"
              >
                {fr.play.newGame}
              </button>
            </div>
          ) : null}
        </div>

        <aside className="min-w-0">
          {pairs.length > 0 ? (
            <MoveSheet
              rows={pairs}
              currentPly={shownPly}
              follow={browsing}
              listRef={sheet}
              onSelect={selectMove}
              onStep={step}
            />
          ) : null}

          {state.outcome === 'playing' ? (
            <div className="mt-2 grid gap-1.5">
              <button
                type="button"
                onClick={askHint}
                disabled={
                  browsing || !userTurn || thinking || hintPending || engineState !== 'ready'
                }
                className="border-line text-ink flex min-h-11 items-center justify-center gap-2 rounded-sm border px-3 text-xs disabled:opacity-50"
              >
                <Lightbulb size={15} aria-hidden="true" />
                {hintPending ? fr.play.hintPending : fr.play.hint}
              </button>
              <button
                type="button"
                onClick={restart}
                className="border-line text-ink-muted hover:text-ink flex min-h-11 items-center justify-center gap-2 rounded-sm border px-3 text-xs"
              >
                <RotateCcw size={15} aria-hidden="true" />
                {fr.play.newGame}
              </button>
            </div>
          ) : null}

          <p className="text-ink-muted mt-2 text-[0.6875rem] leading-relaxed">
            {state.assisted ? fr.play.analysis.assisted : fr.play.notAssisted}
          </p>
        </aside>
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

const PIECE_FILE: Record<CapturedPiece, string> = {
  p: 'P',
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
};

/** The pieces a side took belong to the other side, so the image takes the opposite colour. */
function capturedSource(side: MaterialColor, piece: CapturedPiece): string {
  return `/pieces/chessnut/${side === 'white' ? 'b' : 'w'}${PIECE_FILE[piece]}.svg`;
}

function CapturedPieces({
  side,
  pieces,
}: {
  side: MaterialColor;
  pieces: readonly CapturedPiece[];
}) {
  if (pieces.length === 0) return null;

  return (
    <span
      aria-hidden="true"
      className="bg-board-light flex shrink-0 items-center rounded-xs px-1 py-0.5"
    >
      {pieces.map((piece, index) => (
        <img
          key={`${piece}-${index}`}
          src={capturedSource(side, piece)}
          alt=""
          className={`size-4 shrink-0 ${index === 0 ? '' : '-ml-2'}`}
        />
      ))}
    </span>
  );
}

function ClockRow({
  side,
  ms,
  active,
  material,
}: {
  side: Side;
  ms: number;
  active: boolean;
  material: Material;
}) {
  const label = side === 'white' ? fr.play.clocks.white : fr.play.clocks.black;
  const advantage = side === 'white' ? material.advantage : -material.advantage;

  return (
    <div
      className={`flex items-center justify-between gap-3 py-0.5 text-xs ${
        active ? 'text-ink' : 'text-ink-muted'
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0">{side === 'white' ? fr.opening.white : fr.opening.black}</span>
        <CapturedPieces side={side} pieces={material.captured[side]} />
        {advantage > 0 ? (
          <span
            aria-hidden="true"
            className="text-ink shrink-0 text-[0.6875rem] font-semibold tabular-nums"
          >
            +{advantage}
          </span>
        ) : null}
      </span>
      <span
        className={`text-[0.9375rem] tabular-nums ${active ? 'text-ink font-semibold' : ''}`}
        role="timer"
        aria-label={label}
      >
        {formatClock(ms)}
      </span>
    </div>
  );
}
