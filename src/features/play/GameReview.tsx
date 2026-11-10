import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalyseRequest, EngineLine, PositionEval } from '../../engine/uci';
import { fr } from '../../i18n/fr';
import { sideToMove } from '../../lib/chess';
import { START_FEN } from '../../lib/position';
import { ChessBoard } from '../../ui/ChessBoard';
import { loadOpenings } from '../openings/content';
import { ANALYSIS_MOVETIME_MS, LINES_MOVETIME_MS, reviewGameReport } from './analysis';
import { EngineLines } from './EngineLines';
import { clearlyBetter, variationPositions, type VariationPosition } from './engineLines';
import { EvaluationGraph } from './EvaluationGraph';
import { positionAt, type PlayState } from './game';
import { MoveSheet, MoveSheetSkeleton } from './MoveSheet';
import { moveLabel, scoreSheet } from './notation';
import { markOf, type GameReport, type MoveMark } from './review';
import { CLASS_LABEL, CLASS_TONE } from './reviewLabels';
import { ReviewSummary } from './ReviewSummary';

type ReviewState =
  | { status: 'running'; done: number; total: number }
  | { status: 'ready' }
  | { status: 'failed'; message: string };

const NO_DESTS = new Map<string, string[]>();
const ignoreMove = () => {};

/**
 * Reads the finished game back at full strength, then lets the user replay every move. The report
 * above the board tells the story and the score sheet marks the moves that decided it.
 */
export function GameReview({
  analyse,
  game,
  onNewGame,
}: {
  analyse: (fen: string, request: AnalyseRequest) => Promise<PositionEval>;
  game: PlayState;
  onNewGame: () => void;
}) {
  const [state, setState] = useState<ReviewState>({ status: 'running', done: 0, total: 0 });
  const [report, setReport] = useState<GameReport | null>(null);
  const [selectedPly, setSelectedPly] = useState(0);
  const [showBest, setShowBest] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lines, setLines] = useState<{ ply: number; result: PositionEval } | null>(null);
  const [linesPending, setLinesPending] = useState(false);
  const [linesFailed, setLinesFailed] = useState(false);
  const [variation, setVariation] = useState<{
    positions: VariationPosition[];
    index: number;
  } | null>(null);
  const boardHost = useRef<HTMLDivElement>(null);
  const linesRequest = useRef(0);
  const openings = useMemo(() => loadOpenings(), []);

  useEffect(() => {
    let cancelled = false;

    reviewGameReport((fen) => analyse(fen, { movetimeMs: ANALYSIS_MOVETIME_MS }), game, {
      openings,
      onProgress: (done, total) => {
        if (!cancelled) setState({ status: 'running', done, total });
      },
      cancelled: () => cancelled,
    }).then(
      (result) => {
        if (cancelled || result === null) return;
        setReport(result);
        setState({ status: 'ready' });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [analyse, game, attempt, openings]);

  const { moves, rows } = useMemo(
    () => scoreSheet(game.moves, game.startFen),
    [game.moves, game.startFen],
  );
  const livePly = moves.length;
  const movesByPly = useMemo(
    () => new Map((report?.moves ?? []).map((move) => [move.ply, move])),
    [report],
  );
  const marks = useMemo(() => {
    const map = new Map<number, MoveMark>();
    for (const move of report?.moves ?? []) {
      const mark = markOf(move.class);
      if (mark !== null && !move.book) map.set(move.ply, mark);
    }
    return map;
  }, [report]);

  const shownPly = Math.min(Math.max(selectedPly, 0), livePly);
  const shownMove = moves[shownPly - 1] ?? null;
  const selected = movesByPly.get(shownPly) ?? null;
  const canShowBest =
    selected !== null &&
    !selected.book &&
    selected.bestUci !== null &&
    selected.bestUci !== selected.uci;
  const best = showBest && canShowBest;
  const variationPosition = variation?.positions[variation.index] ?? null;
  const shown = useMemo(
    () =>
      variationPosition ??
      (best && selected
        ? { fen: selected.fenBefore, lastMove: selected.lastMoveBefore }
        : positionAt(game, shownPly)),
    [variationPosition, best, selected, game, shownPly],
  );
  const bestHint =
    !variationPosition && best && selected?.bestUci
      ? { from: selected.bestUci.slice(0, 2), to: selected.bestUci.slice(2, 4) }
      : null;

  const lineFen = selected?.fenBefore ?? positionAt(game, shownPly).fen;
  const lineResult = lines?.ply === shownPly ? lines.result : null;
  const shownLines: EngineLine[] = useMemo(() => {
    if (lineResult === null) return [];
    if (lineResult.lines !== undefined) return lineResult.lines;
    return lineResult.bestMove !== null && lineResult.score !== null
      ? [{ multipv: 1, score: lineResult.score, pv: [lineResult.bestMove] }]
      : [];
  }, [lineResult]);
  const only = clearlyBetter(shownLines);

  const selectionLabel =
    selected === null
      ? null
      : selected.book
        ? fr.play.analysis.book
        : selected.forced
          ? fr.play.analysis.forced
          : selected.class === 'unknown'
            ? null
            : CLASS_LABEL[selected.class];
  const selectionTone =
    selected === null
      ? ''
      : selected.book
        ? 'bg-line-soft text-ink-muted'
        : selected.forced
          ? 'bg-line text-ink-muted'
          : CLASS_TONE[selected.class];

  const retry = () => {
    setState({ status: 'running', done: 0, total: 0 });
    setReport(null);
    setSelectedPly(0);
    setShowBest(false);
    setLines(null);
    setLinesPending(false);
    setLinesFailed(false);
    setVariation(null);
    setAttempt((value) => value + 1);
  };

  const show = (ply: number) => {
    // A line search for the previous position must not land on the new one.
    linesRequest.current += 1;
    setLinesPending(false);
    setLinesFailed(false);
    setVariation(null);
    setSelectedPly(Math.min(Math.max(ply, 0), livePly));
    setShowBest(false);
  };

  const toggleBest = () => {
    // The best arrow shows the position before the move; a variation would hide it.
    setVariation(null);
    setShowBest((value) => !value);
  };

  const loadLines = () => {
    const ply = shownPly;
    const fen = selected?.fenBefore ?? positionAt(game, shownPly).fen;
    const request = linesRequest.current + 1;
    linesRequest.current = request;
    setLinesPending(true);
    setLinesFailed(false);
    analyse(fen, { movetimeMs: LINES_MOVETIME_MS, multipv: 2 }).then(
      (result) => {
        if (linesRequest.current !== request) return;
        setLines({ ply, result });
        setLinesPending(false);
      },
      () => {
        if (linesRequest.current !== request) return;
        setLinesFailed(true);
        setLinesPending(false);
      },
    );
  };

  const preview = (line: EngineLine) => {
    const positions = variationPositions(lineFen, line.pv);
    if (positions === null || positions.length < 2) return;
    setShowBest(false);
    setVariation({ positions, index: 0 });
  };

  const select = (ply: number) => {
    show(ply);
    // The sheet sits under the board on a phone: bring the board back into view.
    if (window.matchMedia('(max-width: 767px)').matches) {
      boardHost.current?.scrollIntoView({ block: 'center' });
    }
  };

  const progress =
    state.status === 'running'
      ? state.total === 0
        ? fr.play.analysis.starting
        : fr.play.analysis.progress
            .replace('{done}', String(state.done))
            .replace('{total}', String(state.total))
      : '';

  const line = variationPosition
    ? variationPosition.san === null
      ? fr.play.analysis.variationStart
      : fr.play.analysis.variationMove.replace('{move}', variationPosition.san)
    : shownMove
      ? best && selected
        ? `${fr.play.analysis.before.replace('{move}', moveLabel(shownMove))} · ${fr.play.analysis.best.replace('{move}', selected.bestSan ?? '')}`
        : `${moveLabel(shownMove)}${selectionLabel ? ` · ${selectionLabel}` : ''}${
            selected && !selected.book && selected.bestSan && selected.bestUci !== selected.uci
              ? ` · ${fr.play.analysis.best.replace('{move}', selected.bestSan)}`
              : ''
          }`
      : fr.play.analysis.startPosition;

  return (
    <>
      <h2 className="text-lg">{fr.play.analysis.title}</h2>

      {progress ? (
        <p className="text-ink-muted mt-1 text-sm" role="status">
          {progress}
        </p>
      ) : null}

      {state.status === 'running' ? (
        <div
          role="progressbar"
          aria-label={fr.play.analysis.progressLabel}
          aria-valuemin={0}
          aria-valuemax={state.total === 0 ? undefined : state.total}
          aria-valuenow={state.total === 0 ? undefined : state.done}
          className="bg-line mt-2 h-1.5 overflow-hidden rounded-full"
        >
          <div
            className={`bg-accent h-full rounded-full motion-reduce:transition-none ${
              state.total === 0
                ? 'w-1/4 animate-pulse motion-reduce:animate-none'
                : 'transition-[width]'
            }`}
            style={
              state.total === 0 ? undefined : { width: `${(state.done / state.total) * 100}%` }
            }
          />
        </div>
      ) : null}

      {state.status === 'failed' ? (
        <div
          role="alert"
          className="border-line bg-paper-raised mt-4 rounded-sm border p-4 text-center"
        >
          <p className="text-sm">{fr.play.analysis.failed}</p>
          {state.message ? (
            <p className="text-ink-muted mt-1 text-xs break-words">{state.message}</p>
          ) : null}
          <button
            type="button"
            onClick={retry}
            className="bg-accent mt-3 rounded-sm px-4 py-3 text-sm font-semibold text-white"
          >
            {fr.play.analysis.retry}
          </button>
        </div>
      ) : null}

      {report !== null && state.status === 'ready' ? <ReviewSummary report={report} /> : null}

      {report !== null && state.status === 'ready' ? (
        <EvaluationGraph
          points={report.evalCurve}
          moves={report.moves}
          selectedPly={shownPly}
          onSelect={select}
        />
      ) : null}

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_190px] md:items-start">
        <div className="min-w-0">
          <div
            ref={boardHost}
            aria-label={fr.play.board}
            className="border-line bg-paper-raised rounded-sm border p-2.5 sm:p-3"
          >
            <ChessBoard
              fen={shown.fen}
              orientation={game.userColor}
              turn={sideToMove(shown.fen)}
              lastMove={shown.lastMove}
              movable={false}
              dests={NO_DESTS}
              onMove={ignoreMove}
              hint={bestHint}
              hintBrush="hint"
            />
          </div>

          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-sm font-medium" aria-live="polite">
              {line}
            </p>
            {selectionLabel && !variationPosition ? (
              <span className={`shrink-0 rounded-xs px-2.5 py-1 text-xs ${selectionTone}`}>
                {selectionLabel}
              </span>
            ) : null}
          </div>

          {variation ? (
            <div className="bg-accent-soft mt-2 flex flex-wrap items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs">
              <p className="min-w-0 flex-1">
                {fr.play.analysis.variation
                  .replace('{index}', String(variation.index + 1))
                  .replace('{count}', String(variation.positions.length))}
              </p>
              <button
                type="button"
                onClick={() => setVariation({ ...variation, index: variation.index - 1 })}
                disabled={variation.index === 0}
                className="border-line text-ink min-h-11 rounded-xs border px-2 text-[0.6875rem] font-semibold disabled:opacity-50"
              >
                {fr.play.review.previous}
              </button>
              <button
                type="button"
                onClick={() => setVariation({ ...variation, index: variation.index + 1 })}
                disabled={variation.index === variation.positions.length - 1}
                className="border-line text-ink min-h-11 rounded-xs border px-2 text-[0.6875rem] font-semibold disabled:opacity-50"
              >
                {fr.play.review.next}
              </button>
              <button
                type="button"
                onClick={() => setVariation(null)}
                className="border-line text-ink min-h-11 rounded-xs border px-2 text-[0.6875rem] font-semibold"
              >
                {fr.play.analysis.closeVariation}
              </button>
            </div>
          ) : null}

          {canShowBest && !variationPosition ? (
            <button
              type="button"
              onClick={toggleBest}
              className="border-line text-ink mt-2 min-h-11 w-full rounded-xs border px-3 text-[0.6875rem] font-semibold"
            >
              {best ? fr.play.analysis.showPlayed : fr.play.analysis.showBest}
            </button>
          ) : null}

          {state.status === 'ready' ? (
            <div className="mt-2">
              {lineResult !== null ? (
                <EngineLines
                  fen={lineFen}
                  lines={shownLines}
                  sideToMove={sideToMove(lineFen)}
                  userColor={game.userColor}
                  only={only}
                  onPreview={preview}
                />
              ) : (
                <button
                  type="button"
                  onClick={loadLines}
                  disabled={linesPending}
                  className="border-line text-ink min-h-11 w-full rounded-xs border px-3 text-[0.6875rem] font-semibold disabled:opacity-50"
                >
                  {linesPending ? fr.play.analysis.linesPending : fr.play.analysis.showLines}
                </button>
              )}
              {linesFailed ? (
                <p className="text-bad mt-1 text-xs" role="alert">
                  {fr.play.analysis.linesFailed}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="min-w-0">
          {rows.length > 0 ? (
            state.status === 'running' ? (
              <MoveSheetSkeleton
                rowCount={rows.length}
                startNumber={rows[0]?.number ?? 1}
                listClassName="max-h-56 md:max-h-[40vh]"
              />
            ) : (
              <MoveSheet
                rows={rows}
                currentPly={shownPly}
                marks={marks}
                listClassName="max-h-56 md:max-h-[40vh]"
                onSelect={select}
                onStep={(delta) => show(shownPly + delta)}
              />
            )
          ) : null}
        </aside>
      </div>

      {game.startFen !== START_FEN ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={onNewGame}
            className="bg-accent w-full rounded-sm px-4 py-3 text-sm font-semibold text-white"
          >
            {fr.play.replayPosition}
          </button>
        </div>
      ) : null}
    </>
  );
}
