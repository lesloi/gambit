import { useEffect, useMemo, useRef, useState } from 'react';
import type { PositionEval } from '../../engine/uci';
import { fr } from '../../i18n/fr';
import { sideToMove } from '../../lib/chess';
import { START_FEN } from '../../lib/position';
import { ChessBoard } from '../../ui/ChessBoard';
import { ANALYSIS_MOVETIME_MS, findingsBySheetPly, reviewGame, type Finding } from './analysis';
import { positionAt, type PlayState } from './game';
import { MoveSheet, MoveSheetSkeleton } from './MoveSheet';
import { moveLabel, scoreSheet } from './notation';

type ReviewState =
  { status: 'running'; done: number; total: number } | { status: 'ready' } | { status: 'failed' };

const NO_DESTS = new Map<string, string[]>();
const ignoreMove = () => {};

function kindLabel(kind: Finding['kind']): string {
  return kind === 'missed-win' ? fr.play.analysis.missedWin : fr.play.analysis.blunder;
}

function kindClass(kind: Finding['kind']): string {
  return kind === 'missed-win' ? 'bg-accent-soft text-ink' : 'bg-bad-soft text-bad';
}

/**
 * Reads the finished game back at full strength, then lets the user replay every move. The
 * findings are marked in the score sheet; one shows the engine's choice as an arrow on the
 * position where the move could have been played better.
 */
export function GameReview({
  analyse,
  game,
  onNewGame,
}: {
  analyse: (fen: string, movetimeMs: number) => Promise<PositionEval>;
  game: PlayState;
  onNewGame: () => void;
}) {
  const [state, setState] = useState<ReviewState>({ status: 'running', done: 0, total: 0 });
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [selectedPly, setSelectedPly] = useState(0);
  const [showBest, setShowBest] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const boardHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    reviewGame((fen) => analyse(fen, ANALYSIS_MOVETIME_MS), game, {
      onProgress: (done, total) => {
        if (!cancelled) setState({ status: 'running', done, total });
      },
      cancelled: () => cancelled,
    }).then(
      (result) => {
        if (cancelled || result === null) return;
        setFindings(result);
        setState({ status: 'ready' });
      },
      () => {
        if (!cancelled) setState({ status: 'failed' });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [analyse, game, attempt]);

  const { moves, rows } = useMemo(
    () => scoreSheet(game.moves, game.startFen),
    [game.moves, game.startFen],
  );
  const livePly = moves.length;
  const findingsByPly = useMemo(() => findingsBySheetPly(findings), [findings]);
  const marks = useMemo(
    () => new Map([...findingsByPly].map(([ply, finding]) => [ply, finding.kind] as const)),
    [findingsByPly],
  );

  const shownPly = Math.min(Math.max(selectedPly, 0), livePly);
  const shownMove = moves[shownPly - 1] ?? null;
  const finding = findingsByPly.get(shownPly) ?? null;
  const best = showBest && finding !== null;
  const shown = useMemo(
    () =>
      best && finding
        ? { fen: finding.fen, lastMove: finding.lastMove }
        : positionAt(game, shownPly),
    [best, finding, game, shownPly],
  );

  const retry = () => {
    setState({ status: 'running', done: 0, total: 0 });
    setFindings([]);
    setSelectedPly(0);
    setShowBest(false);
    setAttempt((value) => value + 1);
  };

  const show = (ply: number) => {
    setSelectedPly(Math.min(Math.max(ply, 0), livePly));
    setShowBest(false);
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
      : state.status === 'ready' && findings.length === 0
        ? fr.play.analysis.empty
        : state.status === 'ready'
          ? findings.length === 1
            ? fr.play.analysis.finishedOne
            : fr.play.analysis.finishedMany.replace('{count}', String(findings.length))
          : '';

  const line = shownMove
    ? best && finding
      ? `${fr.play.analysis.before.replace('{move}', moveLabel(shownMove))} · ${fr.play.analysis.best.replace('{move}', finding.bestSan)}`
      : `${moveLabel(shownMove)}${finding ? ` · ${fr.play.analysis.best.replace('{move}', finding.bestSan)}` : ''}`
    : fr.play.analysis.startPosition;

  return (
    <>
      <h2 className="text-lg">{fr.play.analysis.title}</h2>

      <p className="text-ink-muted mt-2 text-sm" role="status">
        {progress}
      </p>

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
          <button
            type="button"
            onClick={retry}
            className="bg-accent mt-3 rounded-sm px-4 py-3 text-sm font-semibold text-white"
          >
            {fr.play.analysis.retry}
          </button>
        </div>
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
              hint={
                best && finding
                  ? { from: finding.bestUci.slice(0, 2), to: finding.bestUci.slice(2, 4) }
                  : null
              }
            />
          </div>

          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-sm font-medium" aria-live="polite">
              {line}
              {finding ? <span className="sr-only">, {kindLabel(finding.kind)}</span> : null}
            </p>
            {finding ? (
              <span
                className={`shrink-0 rounded-xs px-2.5 py-1 text-xs ${kindClass(finding.kind)}`}
              >
                {kindLabel(finding.kind)}
              </span>
            ) : null}
          </div>

          {finding ? (
            <button
              type="button"
              onClick={() => setShowBest((value) => !value)}
              className="border-line text-ink mt-2 min-h-11 w-full rounded-xs border px-3 text-[0.6875rem] font-semibold"
            >
              {best ? fr.play.analysis.showPlayed : fr.play.analysis.showBest}
            </button>
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

      <div className="mt-4">
        <button
          type="button"
          onClick={onNewGame}
          className="bg-accent w-full rounded-sm px-4 py-3 text-sm font-semibold text-white"
        >
          {game.startFen !== START_FEN ? fr.play.replayPosition : fr.play.newGame}
        </button>
      </div>
    </>
  );
}
